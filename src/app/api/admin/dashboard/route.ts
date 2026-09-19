import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonOk } from "@/lib/api";

export async function GET() {
  try {
    await requireAuth([Role.SUPER_ADMIN]);
    const today = new Date().toISOString().slice(0, 10);

    const [
      totalSalons,
      activeSalons,
      pendingApprovals,
      totalCustomers,
      totalOwners,
      totalBarbers,
      totalServices,
      todayBookings,
      upcomingBookings,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      pendingVerificationCount,
      verifiedSalons,
      premiumSalons,
    ] = await Promise.all([
      prisma.salon.count(),
      prisma.salon.count({
        where: { status: "ACTIVE", listingStatus: "APPROVED" },
      }),
      prisma.salon.count({ where: { listingStatus: "PENDING_APPROVAL" } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.user.count({ where: { role: "SALON_OWNER" } }),
      prisma.barber.count(),
      prisma.service.count(),
      prisma.booking.count({
        where: {
          appointmentDate: today,
          status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
        },
      }),
      prisma.booking.count({
        where: {
          status: { in: ["PENDING", "CONFIRMED"] },
          appointmentDate: { gte: today },
        },
      }),
      prisma.booking.count({ where: { status: "COMPLETED" } }),
      prisma.booking.count({ where: { status: "CANCELLED" } }),
      prisma.booking.count({ where: { status: "PENDING" } }),
      prisma.salon.count({ where: { verificationStatus: "PENDING" } }),
      prisma.salon.count({ where: { verificationStatus: "VERIFIED" } }),
      prisma.salon.count({ where: { isPremium: true } }),
    ]);

    const recentBookings = await prisma.booking.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        salon: true,
        barber: true,
        service: true,
        customer: { select: { name: true, email: true } },
      },
    });

    const pendingSalons = await prisma.salon.findMany({
      where: { listingStatus: "PENDING_APPROVAL" },
      take: 8,
      orderBy: { submittedAt: "desc" },
      include: { owner: { select: { name: true, email: true } } },
    });

    const pendingVerificationSalons = await prisma.salon.findMany({
      where: { verificationStatus: "PENDING" },
      take: 8,
      orderBy: { verificationRequestedAt: "desc" },
      include: { owner: { select: { name: true, email: true } } },
    });

    return jsonOk({
      stats: {
        totalSalons,
        activeSalons,
        pendingApprovals,
        totalCustomers,
        totalOwners,
        totalBarbers,
        totalServices,
        todayBookings,
        upcomingBookings,
        completedBookings,
        cancelledBookings,
        pendingBookings,
        pendingVerifications: pendingVerificationCount,
        verifiedSalons,
        premiumSalons,
      },
      recentBookings,
      pendingSalons,
      pendingVerificationSalons,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
