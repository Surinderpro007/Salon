import { ListingStatus, Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonOk } from "@/lib/api";
import { getOwnedSalonIds } from "@/lib/salon-access";

export async function GET() {
  try {
    const session = await requireAuth([Role.SALON_OWNER]);
    const salonIds = await getOwnedSalonIds(session.id);
    const today = new Date().toISOString().slice(0, 10);

    const [
      salonCount,
      pendingListings,
      approvedListings,
      pendingBookings,
      confirmedBookings,
      todayBookings,
      totalStaff,
      totalServices,
    ] = await Promise.all([
      prisma.salon.count({ where: { ownerId: session.id } }),
      prisma.salon.count({
        where: { ownerId: session.id, listingStatus: ListingStatus.PENDING_APPROVAL },
      }),
      prisma.salon.count({
        where: { ownerId: session.id, listingStatus: ListingStatus.APPROVED },
      }),
      prisma.booking.count({
        where: { salonId: { in: salonIds }, status: "PENDING" },
      }),
      prisma.booking.count({
        where: { salonId: { in: salonIds }, status: "CONFIRMED" },
      }),
      prisma.booking.count({
        where: {
          salonId: { in: salonIds },
          appointmentDate: today,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      }),
      prisma.barber.count({ where: { salonId: { in: salonIds } } }),
      prisma.service.count({ where: { salonId: { in: salonIds } } }),
    ]);

    const recentRequests = await prisma.booking.findMany({
      where: { salonId: { in: salonIds }, status: "PENDING" },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        salon: true,
        barber: true,
        service: true,
        customer: { select: { name: true, email: true, phone: true } },
      },
    });

    const salons = await prisma.salon.findMany({
      where: { ownerId: session.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { barbers: true, services: true, bookings: true } },
      },
    });

    return jsonOk({
      stats: {
        salonCount,
        pendingListings,
        approvedListings,
        pendingBookings,
        confirmedBookings,
        todayBookings,
        totalStaff,
        totalServices,
      },
      recentRequests,
      salons,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
