import { NextRequest } from "next/server";
import { ListingStatus, Role, VerificationStatus } from "@prisma/client";
import { getSession, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { salonSchema } from "@/lib/validators";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";
import { parseJsonArray, toJsonArray, isSalonOpenNow } from "@/lib/utils";
import { assertSalonOwnerAccess } from "@/lib/salon-access";

function serializeSalon(s: {
  id: string;
  ownerId?: string | null;
  name: string;
  description?: string;
  logo: string | null;
  images: string;
  address: string;
  city: string;
  contactNumber: string;
  openingTime: string;
  closingTime: string;
  workingDays: string;
  status: string;
  listingStatus?: string;
  rejectionReason?: string | null;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  verificationStatus?: string;
  verificationMessage?: string | null;
  verificationRejectionReason?: string | null;
  verificationRequestedAt?: Date | null;
  verifiedAt?: Date | null;
  isPremium?: boolean;
  rating: number;
  category: string;
  createdAt: Date;
  services?: { price: number; name: string; status: string }[];
  _count?: { barbers: number; services: number };
  owner?: { id: string; name: string; email: string } | null;
}) {
  const images = parseJsonArray(s.images);
  const workingDays = parseJsonArray(s.workingDays);
  const activeServices = (s.services || []).filter((x) => x.status === "ACTIVE");
  const startingPrice =
    activeServices.length > 0 ? Math.min(...activeServices.map((x) => x.price)) : null;

  return {
    ...s,
    images,
    workingDays,
    isVerified: s.verificationStatus === VerificationStatus.VERIFIED,
    isPremium: Boolean(s.isPremium),
    isOpen: isSalonOpenNow(workingDays, s.openingTime, s.closingTime),
    startingPrice,
    availableServices: activeServices.map((x) => x.name),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const q = searchParams.get("q")?.trim() || "";
    const city = searchParams.get("city")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const status = searchParams.get("status");
    const listingStatus = searchParams.get("listingStatus");
    const verificationStatus = searchParams.get("verificationStatus");
    const admin = searchParams.get("admin") === "1";
    const owner = searchParams.get("owner") === "1";
    const session = await getSession();

    if (id) {
      const salon = await prisma.salon.findUnique({
        where: { id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          barbers: {
            include: {
              barberServices: { include: { service: true } },
            },
            orderBy: { name: "asc" },
          },
          services: {
            include: {
              barberServices: { include: { barber: true } },
            },
            orderBy: { price: "asc" },
          },
        },
      });
      if (!salon) return jsonError("Salon not found", 404);

      const isAdmin = session?.role === Role.SUPER_ADMIN;
      const isOwner =
        session?.role === Role.SALON_OWNER && salon.ownerId === session.id;
      const isPublic =
        salon.listingStatus === ListingStatus.APPROVED && salon.status === "ACTIVE";

      if (!admin && !owner && !isAdmin && !isOwner && !isPublic) {
        return jsonError("Salon not found", 404);
      }
      if (owner && !isAdmin && !isOwner) {
        return jsonError("Forbidden", 403);
      }

      return jsonOk({
        salon: {
          ...serializeSalon(salon),
          barbers: salon.barbers.map((b) => ({
            ...b,
            skills: parseJsonArray(b.skills),
            workingDays: parseJsonArray(b.workingDays),
            services: b.barberServices.map((bs) => bs.service),
          })),
          services: salon.services.map((svc) => ({
            ...svc,
            barbers: svc.barberServices.map((bs) => bs.barber),
          })),
        },
      });
    }

    // Owner's salons
    if (owner) {
      const sess = await requireAuth([Role.SALON_OWNER, Role.SUPER_ADMIN]);
      const where: Record<string, unknown> =
        sess.role === Role.SUPER_ADMIN && searchParams.get("all") === "1"
          ? {}
          : { ownerId: sess.id };

      const salons = await prisma.salon.findMany({
        where,
        include: {
          services: { select: { price: true, name: true, status: true } },
          _count: { select: { barbers: true, services: true, bookings: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return jsonOk({ salons: salons.map(serializeSalon) });
    }

    // Admin list
    if (admin) {
      await requireAuth([Role.SUPER_ADMIN]);
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (listingStatus) where.listingStatus = listingStatus;
      if (verificationStatus) where.verificationStatus = verificationStatus;
      if (q) {
        where.OR = [
          { name: { contains: q } },
          { city: { contains: q } },
          { address: { contains: q } },
          { category: { contains: q } },
        ];
      }
      if (city) where.city = { contains: city };
      if (category) where.category = { contains: category };

      const salons = await prisma.salon.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          services: { select: { price: true, name: true, status: true } },
          _count: { select: { barbers: true, services: true } },
        },
        orderBy: [{ listingStatus: "asc" }, { createdAt: "desc" }],
      });
      return jsonOk({ salons: salons.map(serializeSalon) });
    }

    // Public: only approved + active
    const where: Record<string, unknown> = {
      status: "ACTIVE",
      listingStatus: ListingStatus.APPROVED,
    };

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { city: { contains: q } },
        { address: { contains: q } },
        { category: { contains: q } },
      ];
    }
    if (city) where.city = { contains: city };
    if (category) where.category = { contains: category };

    const salons = await prisma.salon.findMany({
      where,
      include: {
        services: { select: { price: true, name: true, status: true } },
        _count: { select: { barbers: true, services: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonOk({ salons: salons.map(serializeSalon) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth([Role.SUPER_ADMIN, Role.SALON_OWNER]);
    const body = await req.json();
    const data = salonSchema.parse(body);

    const salon = await prisma.salon.create({
      data: {
        ownerId: session.role === Role.SALON_OWNER ? session.id : body.ownerId || null,
        name: data.name,
        description: data.description || "",
        logo: data.logo || null,
        images: toJsonArray(data.images || []),
        address: data.address,
        city: data.city,
        contactNumber: data.contactNumber,
        openingTime: data.openingTime,
        closingTime: data.closingTime,
        workingDays: toJsonArray(data.workingDays),
        status: data.status || "ACTIVE",
        listingStatus:
          session.role === Role.SUPER_ADMIN
            ? ListingStatus.APPROVED
            : ListingStatus.DRAFT,
        category: data.category || "Unisex",
        rating: data.rating ?? 0,
        reviewedAt: session.role === Role.SUPER_ADMIN ? new Date() : null,
      },
    });

    return jsonOk({ salon: serializeSalon({ ...salon, services: [] }) }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth([Role.SUPER_ADMIN, Role.SALON_OWNER]);
    const body = await req.json();
    const id = body.id as string;
    if (!id) return jsonError("Salon id required");

    const existing = await prisma.salon.findUnique({ where: { id } });
    if (!existing) return jsonError("Salon not found", 404);

    await assertSalonOwnerAccess(session, id);

    // Listing approval actions (super admin only)
    if (body.action === "approve" || body.action === "reject") {
      if (session.role !== Role.SUPER_ADMIN) {
        return jsonError("Forbidden", 403);
      }
      if (existing.listingStatus !== ListingStatus.PENDING_APPROVAL) {
        return jsonError("Salon is not awaiting approval");
      }

      const approved = body.action === "approve";
      const salon = await prisma.$transaction(async (tx) => {
        const updated = await tx.salon.update({
          where: { id },
          data: {
            listingStatus: approved
              ? ListingStatus.APPROVED
              : ListingStatus.REJECTED,
            rejectionReason: approved ? null : body.rejectionReason || "Rejected by admin",
            reviewedAt: new Date(),
            status: approved ? "ACTIVE" : existing.status,
          },
          include: {
            services: { select: { price: true, name: true, status: true } },
            owner: { select: { id: true, name: true, email: true } },
          },
        });

        if (updated.ownerId) {
          await tx.notification.create({
            data: {
              userId: updated.ownerId,
              title: approved ? "Salon listing approved" : "Salon listing rejected",
              message: approved
                ? `Your salon "${updated.name}" is now live on TrimBook.`
                : `Your salon "${updated.name}" was not approved.${
                    body.rejectionReason ? ` Reason: ${body.rejectionReason}` : ""
                  }`,
            },
          });
        }

        return updated;
      });

      return jsonOk({ salon: serializeSalon(salon) });
    }

    // Owner submits for approval
    if (body.action === "submit") {
      if (session.role !== Role.SALON_OWNER && session.role !== Role.SUPER_ADMIN) {
        return jsonError("Forbidden", 403);
      }
      if (
        existing.listingStatus !== ListingStatus.DRAFT &&
        existing.listingStatus !== ListingStatus.REJECTED
      ) {
        return jsonError("Only draft or rejected salons can be submitted");
      }

      const barberCount = await prisma.barber.count({ where: { salonId: id } });
      const serviceCount = await prisma.service.count({ where: { salonId: id } });
      if (barberCount < 1 || serviceCount < 1) {
        return jsonError("Add at least one staff member and one service before submitting");
      }

      const salon = await prisma.$transaction(async (tx) => {
        const updated = await tx.salon.update({
          where: { id },
          data: {
            listingStatus: ListingStatus.PENDING_APPROVAL,
            submittedAt: new Date(),
            rejectionReason: null,
          },
          include: {
            services: { select: { price: true, name: true, status: true } },
            owner: { select: { id: true, name: true, email: true } },
          },
        });

        const admins = await tx.user.findMany({
          where: { role: Role.SUPER_ADMIN },
          select: { id: true },
        });
        if (admins.length) {
          await tx.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              title: "Salon listing request",
              message: `${updated.owner?.name || "A salon owner"} submitted "${updated.name}" for approval.`,
            })),
          });
        }

        return updated;
      });

      return jsonOk({
        salon: serializeSalon(salon),
        message: "Listing request submitted to Super Admin.",
      });
    }

    // Owner requests verified badge
    if (body.action === "request-verification") {
      if (existing.listingStatus !== ListingStatus.APPROVED) {
        return jsonError("Salon must be listed/approved before requesting verification");
      }
      if (existing.verificationStatus === VerificationStatus.VERIFIED) {
        return jsonError("Salon is already verified");
      }
      if (existing.verificationStatus === VerificationStatus.PENDING) {
        return jsonError("Verification request is already pending review");
      }

      const message =
        typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";

      const salon = await prisma.$transaction(async (tx) => {
        const updated = await tx.salon.update({
          where: { id },
          data: {
            verificationStatus: VerificationStatus.PENDING,
            verificationMessage: message || null,
            verificationRejectionReason: null,
            verificationRequestedAt: new Date(),
          },
          include: {
            services: { select: { price: true, name: true, status: true } },
            owner: { select: { id: true, name: true, email: true } },
          },
        });

        const admins = await tx.user.findMany({
          where: { role: Role.SUPER_ADMIN },
          select: { id: true },
        });
        if (admins.length) {
          await tx.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              title: "Verified badge request",
              message: `${updated.owner?.name || "A salon owner"} requested a Verified badge for "${updated.name}".`,
            })),
          });
        }

        return updated;
      });

      return jsonOk({
        salon: serializeSalon(salon),
        message: "Verification request sent to Super Admin.",
      });
    }

    // Super Admin: approve / reject verification
    if (
      body.action === "approve-verification" ||
      body.action === "reject-verification"
    ) {
      if (session.role !== Role.SUPER_ADMIN) {
        return jsonError("Forbidden", 403);
      }
      if (existing.verificationStatus !== VerificationStatus.PENDING) {
        return jsonError("No pending verification request for this salon");
      }

      const approved = body.action === "approve-verification";
      const salon = await prisma.$transaction(async (tx) => {
        const updated = await tx.salon.update({
          where: { id },
          data: {
            verificationStatus: approved
              ? VerificationStatus.VERIFIED
              : VerificationStatus.REJECTED,
            verificationRejectionReason: approved
              ? null
              : body.rejectionReason || "Verification request was not approved",
            verifiedAt: approved ? new Date() : null,
          },
          include: {
            services: { select: { price: true, name: true, status: true } },
            owner: { select: { id: true, name: true, email: true } },
          },
        });

        if (updated.ownerId) {
          await tx.notification.create({
            data: {
              userId: updated.ownerId,
              title: approved ? "Verified badge granted" : "Verification declined",
              message: approved
                ? `Congratulations! "${updated.name}" is now Verified on TrimBook.`
                : `Your verification request for "${updated.name}" was declined.${
                    body.rejectionReason ? ` Reason: ${body.rejectionReason}` : ""
                  }`,
            },
          });
        }

        return updated;
      });

      return jsonOk({ salon: serializeSalon(salon) });
    }

    // Super Admin: grant/revoke verified or premium anytime
    if (
      body.action === "set-verified" ||
      body.action === "set-premium" ||
      body.action === "revoke-verified"
    ) {
      if (session.role !== Role.SUPER_ADMIN) {
        return jsonError("Forbidden", 403);
      }

      let data: Record<string, unknown> = {};
      if (body.action === "set-verified") {
        data = {
          verificationStatus: VerificationStatus.VERIFIED,
          verificationRejectionReason: null,
          verifiedAt: new Date(),
        };
      } else if (body.action === "revoke-verified") {
        data = {
          verificationStatus: VerificationStatus.NONE,
          verifiedAt: null,
          verificationMessage: null,
          verificationRejectionReason: null,
        };
      } else if (body.action === "set-premium") {
        data = { isPremium: Boolean(body.isPremium) };
      }

      const salon = await prisma.$transaction(async (tx) => {
        const updated = await tx.salon.update({
          where: { id },
          data,
          include: {
            services: { select: { price: true, name: true, status: true } },
            owner: { select: { id: true, name: true, email: true } },
          },
        });

        if (updated.ownerId && body.action === "set-premium") {
          await tx.notification.create({
            data: {
              userId: updated.ownerId,
              title: updated.isPremium ? "Premium badge granted" : "Premium badge removed",
              message: updated.isPremium
                ? `"${updated.name}" now has a Premium badge.`
                : `Premium badge was removed from "${updated.name}".`,
            },
          });
        }

        if (updated.ownerId && body.action === "set-verified") {
          await tx.notification.create({
            data: {
              userId: updated.ownerId,
              title: "Verified badge granted",
              message: `"${updated.name}" is now Verified on TrimBook.`,
            },
          });
        }

        return updated;
      });

      return jsonOk({ salon: serializeSalon(salon) });
    }

    const data = salonSchema.partial().parse(body);

    // If owner edits an approved salon materially, keep approved; if rejected/draft stay
    const salon = await prisma.salon.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.logo !== undefined && { logo: data.logo }),
        ...(data.images !== undefined && { images: toJsonArray(data.images) }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.contactNumber !== undefined && { contactNumber: data.contactNumber }),
        ...(data.openingTime !== undefined && { openingTime: data.openingTime }),
        ...(data.closingTime !== undefined && { closingTime: data.closingTime }),
        ...(data.workingDays !== undefined && {
          workingDays: toJsonArray(data.workingDays),
        }),
        ...(data.status !== undefined &&
          session.role === Role.SUPER_ADMIN && { status: data.status }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.rating !== undefined &&
          session.role === Role.SUPER_ADMIN && { rating: data.rating }),
      },
      include: {
        services: { select: { price: true, name: true, status: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    return jsonOk({ salon: serializeSalon(salon) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth([Role.SUPER_ADMIN, Role.SALON_OWNER]);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return jsonError("Salon id required");
    await assertSalonOwnerAccess(session, id);
    await prisma.salon.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
