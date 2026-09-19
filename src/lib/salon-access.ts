import { prisma } from "./prisma";
import { Role } from "@prisma/client";
import { AuthError, type SessionUser } from "./auth";

export async function assertSalonOwnerAccess(session: SessionUser, salonId: string) {
  if (session.role === Role.SUPER_ADMIN) return true;
  if (session.role !== Role.SALON_OWNER) {
    throw new AuthError("Forbidden", 403);
  }
  const salon = await prisma.salon.findFirst({
    where: { id: salonId, ownerId: session.id },
    select: { id: true },
  });
  if (!salon) throw new AuthError("Forbidden", 403);
  return true;
}

export async function getOwnedSalonIds(ownerId: string) {
  const salons = await prisma.salon.findMany({
    where: { ownerId },
    select: { id: true },
  });
  return salons.map((s) => s.id);
}

export function isPubliclyVisible(salon: {
  listingStatus: string;
  status: string;
}) {
  return salon.listingStatus === "APPROVED" && salon.status === "ACTIVE";
}
