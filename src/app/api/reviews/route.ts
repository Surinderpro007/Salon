import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { reviewSchema } from "@/lib/validators";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/reviews?salonId=...   -> public list of reviews for a salon
// GET /api/reviews?bookingId=... -> the review (if any) for one booking
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const salonId = searchParams.get("salonId");
    const bookingId = searchParams.get("bookingId");

    if (bookingId) {
      const session = await requireAuth();
      const review = await prisma.review.findUnique({
        where: { bookingId },
      });
      if (
        review &&
        session.role !== Role.SUPER_ADMIN &&
        review.customerId !== session.id
      ) {
        return jsonError("Forbidden", 403);
      }
      return jsonOk({ review });
    }

    if (!salonId) return jsonError("salonId or bookingId is required");

    const reviews = await prisma.review.findMany({
      where: { salonId },
      include: {
        customer: { select: { name: true } },
        barber: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const count = reviews.length;
    const average =
      count === 0
        ? 0
        : Math.round(
            (reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10
          ) / 10;

    return jsonOk({ reviews, average, count });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/reviews -> customer leaves a review for a COMPLETED booking
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth([Role.CUSTOMER]);
    const body = await req.json();
    const data = reviewSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: { review: true },
    });

    if (!booking) return jsonError("Booking not found", 404);
    if (booking.customerId !== session.id) return jsonError("Forbidden", 403);
    if (booking.status !== "COMPLETED") {
      return jsonError("You can only review a completed appointment");
    }
    if (booking.review) {
      return jsonError("You have already reviewed this appointment");
    }

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          bookingId: booking.id,
          customerId: session.id,
          salonId: booking.salonId,
          barberId: booking.barberId,
          rating: data.rating,
          comment: data.comment || "",
        },
      });

      const salonReviews = await tx.review.findMany({
        where: { salonId: booking.salonId },
        select: { rating: true },
      });
      const salonAvg =
        salonReviews.reduce((sum, r) => sum + r.rating, 0) / salonReviews.length;
      await tx.salon.update({
        where: { id: booking.salonId },
        data: { rating: Math.round(salonAvg * 10) / 10 },
      });

      const barberReviews = await tx.review.findMany({
        where: { barberId: booking.barberId },
        select: { rating: true },
      });
      const barberAvg =
        barberReviews.reduce((sum, r) => sum + r.rating, 0) / barberReviews.length;
      await tx.barber.update({
        where: { id: booking.barberId },
        data: { rating: Math.round(barberAvg * 10) / 10 },  
      });

      const salon = await tx.salon.findUnique({ where: { id: booking.salonId } });
      if (salon?.ownerId) {
        await tx.notification.create({
          data: {
            userId: salon.ownerId,
            title: "New review received",
            message: `${session.name} left a ${data.rating}-star review for ${salon.name}.`,
          },
        });
      }

      return created;
    });

    return jsonOk({ review, message: "Thanks for your review!" }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}