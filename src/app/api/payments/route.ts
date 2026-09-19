import { NextRequest } from "next/server";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";
import { paymentActionSchema } from "@/lib/validators";
import {
  attachRazorpayOrder,
  markBookingPaid,
  releaseUnpaidBooking,
  BookingError,
} from "@/lib/booking";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function razorpayAuthHeader() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keyId.includes("xxxx") || keySecret.includes("your_")) {
    throw new BookingError(
      "Razorpay keys are not configured on the server. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.",
      500
    );
  }
  const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return { keyId, header: `Basic ${token}` };
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth([Role.CUSTOMER]);
    const body = await req.json();
    const data = paymentActionSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
    });
    if (!booking) return jsonError("Booking not found", 404);
    if (booking.customerId !== session.id) {
      return jsonError("Forbidden", 403);
    }

    if (data.action === "create-order") {
      if (booking.paymentMethod === "PAY_AT_SALON") {
        return jsonError("This booking is not set up for online payment");
      }
      if (booking.paymentStatus === "PAID") {
        return jsonError("This booking is already paid for");
      }

      const { keyId, header } = razorpayAuthHeader();

      const res = await fetch(`${RAZORPAY_API}/orders`, {
        method: "POST",
        headers: {
          Authorization: header,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Razorpay expects the amount in the smallest currency unit (paise)
          amount: Math.round(booking.price * 100),
          currency: "INR",
          receipt: booking.id,
          notes: { bookingId: booking.id, customerId: session.id },
        }),
      });

      const order = await res.json();
      if (!res.ok) {
        console.error("Razorpay order creation failed", order);
        return jsonError(
          order?.error?.description || "Could not start payment. Please try again.",
          502
        );
      }

      await attachRazorpayOrder(booking.id, order.id);

      return jsonOk({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId,
      });
    }

    if (data.action === "verify") {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = data;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return jsonError("Missing Razorpay payment details");
      }
      if (booking.razorpayOrderId !== razorpay_order_id) {
        return jsonError("Order does not match this booking", 400);
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        return jsonError("Razorpay is not configured on the server", 500);
      }

      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return jsonError("Payment verification failed", 400);
      }

      const updated = await markBookingPaid({
        bookingId: booking.id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });

      await prisma.notification.create({
        data: {
          userId: session.id,
          title: "Payment received",
          message: `Your payment of ₹${booking.price} was received. Your appointment request is still awaiting salon confirmation.`,
        },
      });

      return jsonOk({ booking: updated, message: "Payment successful." });
    }

    return jsonError("Unknown action");
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Used when the Razorpay checkout is closed/dismissed before completing payment,
 * or when payment.failed fires client-side — frees the reserved slot.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth([Role.CUSTOMER]);
    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get("bookingId");
    if (!bookingId) return jsonError("bookingId required");

    const booking = await releaseUnpaidBooking(bookingId, session.id);
    return jsonOk({ booking, message: "Slot released." });
  } catch (err) {
    return handleApiError(err);
  }
}
