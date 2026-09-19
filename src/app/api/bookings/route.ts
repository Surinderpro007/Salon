import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import {
  getAvailableSlots,
  createBooking,
  cancelBooking,
  respondToBooking,
  markCompleted,
} from "@/lib/booking";
import { bookingSchema } from "@/lib/validators";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { formatDisplayDate, formatDisplayTime } from "@/lib/utils";
import { getOwnedSalonIds } from "@/lib/salon-access";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "slots") {
      const barberId = searchParams.get("barberId");
      const serviceId = searchParams.get("serviceId");
      const date = searchParams.get("date");
      if (!barberId || !serviceId || !date) {
        return jsonError("barberId, serviceId and date are required");
      }
      const result = await getAvailableSlots({ barberId, serviceId, date });
      return jsonOk(result);
    }

    const session = await requireAuth();

    const id = searchParams.get("id");
    if (id) {
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          salon: true,
          barber: true,
          service: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
        },
      });
      if (!booking) return jsonError("Booking not found", 404);
      const isOwner = booking.salon.ownerId === session.id;
      if (
        session.role !== Role.SUPER_ADMIN &&
        booking.customerId !== session.id &&
        !isOwner
      ) {
        return jsonError("Forbidden", 403);
      }
      return jsonOk({ booking });
    }

    // Admin: all bookings
    if (session.role === Role.SUPER_ADMIN && searchParams.get("admin") === "1") {
      const where: Record<string, unknown> = {};
      const salonId = searchParams.get("salonId");
      const barberId = searchParams.get("barberId");
      const date = searchParams.get("date");
      const customer = searchParams.get("customer");
      const status = searchParams.get("status");

      if (salonId) where.salonId = salonId;
      if (barberId) where.barberId = barberId;
      if (date) where.appointmentDate = date;
      if (status) where.status = status;
      if (customer) {
        where.customer = {
          OR: [
            { name: { contains: customer } },
            { email: { contains: customer } },
          ],
        };
      }

      const bookings = await prisma.booking.findMany({
        where,
        include: {
          salon: true,
          barber: true,
          service: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }],
      });
      return jsonOk({ bookings });
    }

    // Salon owner bookings
    if (
      session.role === Role.SALON_OWNER &&
      searchParams.get("owner") === "1"
    ) {
      const salonIds = await getOwnedSalonIds(session.id);
      const where: Record<string, unknown> = { salonId: { in: salonIds } };
      const salonId = searchParams.get("salonId");
      const status = searchParams.get("status");
      const date = searchParams.get("date");
      if (salonId) where.salonId = salonId;
      if (status) where.status = status;
      if (date) where.appointmentDate = date;

      const bookings = await prisma.booking.findMany({
        where,
        include: {
          salon: true,
          barber: true,
          service: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: [{ createdAt: "desc" }],
      });
      return jsonOk({ bookings });
    }

    // Customer bookings
    const scope = searchParams.get("scope") || "all";
    const today = new Date().toISOString().slice(0, 10);
    const where: Record<string, unknown> = { customerId: session.id };

    if (scope === "upcoming") {
      where.status = { in: ["PENDING", "CONFIRMED"] };
      where.OR = [
        { appointmentDate: { gt: today } },
        { appointmentDate: today },
      ];
    } else if (scope === "history") {
      where.OR = [
        { status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] } },
        {
          AND: [
            { appointmentDate: { lt: today } },
            { status: { in: ["PENDING", "CONFIRMED"] } },
          ],
        },
      ];
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        salon: true,
        barber: true,
        service: true,
        review: true,
      },
      orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
    });

    return jsonOk({ bookings });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth([Role.CUSTOMER]);
    const body = await req.json();
    const data = bookingSchema.parse(body);

    const booking = await createBooking({
      customerId: session.id,
      salonId: data.salonId,
      barberId: data.barberId,
      serviceId: data.serviceId,
      appointmentDate: data.appointmentDate,
      startTime: data.startTime,
      paymentMethod: data.paymentMethod,
    });

    const when = `${formatDisplayTime(data.startTime)} on ${formatDisplayDate(data.appointmentDate)}`;
    const message =
      booking.paymentMethod === "PAY_AT_SALON"
        ? `Appointment request sent for ${when}. Waiting for salon confirmation.`
        : `Slot reserved for ${when}. Complete the payment to confirm your request.`;

    return jsonOk({ booking, message }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const id = body.id as string;
    const action = body.action as string;

    if (!id) return jsonError("Booking id required");

    if (action === "cancel") {
      const booking = await cancelBooking(
        id,
        session.id,
        session.role === Role.SUPER_ADMIN
      );
      return jsonOk({ booking, message: "Appointment cancelled successfully." });
    }

    if (action === "accept" || action === "reject") {
      const booking = await respondToBooking({
        bookingId: id,
        actorId: session.id,
        isAdmin: session.role === Role.SUPER_ADMIN,
        decision: action,
        note: body.note,
      });
      return jsonOk({
        booking,
        message:
          action === "accept"
            ? "Appointment confirmed."
            : "Appointment request declined.",
      });
    }
        if (action === "complete") {
      const booking = await markCompleted({
        bookingId: id,
        actorId: session.id,
        isAdmin: session.role === Role.SUPER_ADMIN,
      });
      return jsonOk({ booking, message: "Appointment marked as completed." });
    }

    if (action === "status" && session.role === Role.SUPER_ADMIN) {
      const status = body.status;
      const allowed = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
      if (!allowed.includes(status)) return jsonError("Invalid status");
      const booking = await prisma.booking.update({
        where: { id },
        data: { status },
        include: { salon: true, barber: true, service: true, customer: true },
      });
      return jsonOk({ booking });
    }

    return jsonError("Unknown action");
  } catch (err) {
    return handleApiError(err);
  }
}
