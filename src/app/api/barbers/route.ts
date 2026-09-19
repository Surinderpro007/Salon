import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { barberSchema } from "@/lib/validators";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";
import { parseJsonArray, toJsonArray } from "@/lib/utils";
import { assertSalonOwnerAccess } from "@/lib/salon-access";

function serializeBarber(b: {
  skills: string;
  workingDays: string;
  [key: string]: unknown;
}) {
  return {
    ...b,
    skills: parseJsonArray(b.skills),
    workingDays: parseJsonArray(b.workingDays),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const salonId = searchParams.get("salonId");
    const id = searchParams.get("id");

    if (id) {
      const barber = await prisma.barber.findUnique({
        where: { id },
        include: {
          salon: true,
          barberServices: { include: { service: true } },
        },
      });
      if (!barber) return jsonError("Barber not found", 404);
      return jsonOk({
        barber: {
          ...serializeBarber(barber),
          services: barber.barberServices.map((bs) => bs.service),
        },
      });
    }

    if (!salonId) return jsonError("salonId required");
    const barbers = await prisma.barber.findMany({
      where: { salonId },
      include: { barberServices: { include: { service: true } } },
      orderBy: { name: "asc" },
    });

    return jsonOk({
      barbers: barbers.map((b) => ({
        ...serializeBarber(b),
        services: b.barberServices.map((bs) => bs.service),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth([Role.SUPER_ADMIN, Role.SALON_OWNER]);
    const body = await req.json();
    const salonId = body.salonId as string;
    if (!salonId) return jsonError("salonId required");
    await assertSalonOwnerAccess(session, salonId);
    const data = barberSchema.parse(body);

    const salon = await prisma.salon.findUnique({ where: { id: salonId } });
    if (!salon) return jsonError("Salon not found", 404);

    const barber = await prisma.$transaction(async (tx) => {
      const created = await tx.barber.create({
        data: {
          salonId,
          name: data.name,
          profilePhoto: data.profilePhoto || null,
          bio: data.bio || "",
          yearsExperience: data.yearsExperience,
          specialization: data.specialization,
          skills: toJsonArray(data.skills || []),
          rating: data.rating ?? 4.5,
          workingDays: toJsonArray(data.workingDays),
          workStartTime: data.workStartTime,
          workEndTime: data.workEndTime,
          breakStartTime: data.breakStartTime || null,
          breakEndTime: data.breakEndTime || null,
          status: data.status || "ACTIVE",
        },
      });

      if (data.serviceIds?.length) {
        await tx.barberService.createMany({
          data: data.serviceIds.map((serviceId) => ({
            barberId: created.id,
            serviceId,
          })),
        });
      }

      return created;
    });

    return jsonOk({ barber: serializeBarber(barber) }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth([Role.SUPER_ADMIN, Role.SALON_OWNER]);
    const body = await req.json();
    const id = body.id as string;
    if (!id) return jsonError("Barber id required");
    const existing = await prisma.barber.findUnique({ where: { id } });
    if (!existing) return jsonError("Barber not found", 404);
    await assertSalonOwnerAccess(session, existing.salonId);
    const data = barberSchema.partial().parse(body);

    const barber = await prisma.$transaction(async (tx) => {
      const updated = await tx.barber.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.profilePhoto !== undefined && { profilePhoto: data.profilePhoto }),
          ...(data.bio !== undefined && { bio: data.bio }),
          ...(data.yearsExperience !== undefined && {
            yearsExperience: data.yearsExperience,
          }),
          ...(data.specialization !== undefined && {
            specialization: data.specialization,
          }),
          ...(data.skills !== undefined && { skills: toJsonArray(data.skills) }),
          ...(data.rating !== undefined && { rating: data.rating }),
          ...(data.workingDays !== undefined && {
            workingDays: toJsonArray(data.workingDays),
          }),
          ...(data.workStartTime !== undefined && { workStartTime: data.workStartTime }),
          ...(data.workEndTime !== undefined && { workEndTime: data.workEndTime }),
          ...(data.breakStartTime !== undefined && {
            breakStartTime: data.breakStartTime,
          }),
          ...(data.breakEndTime !== undefined && { breakEndTime: data.breakEndTime }),
          ...(data.status !== undefined && { status: data.status }),
        },
      });

      if (data.serviceIds !== undefined) {
        await tx.barberService.deleteMany({ where: { barberId: id } });
        if (data.serviceIds.length) {
          await tx.barberService.createMany({
            data: data.serviceIds.map((serviceId) => ({
              barberId: id,
              serviceId,
            })),
          });
        }
      }

      return updated;
    });

    return jsonOk({ barber: serializeBarber(barber) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth([Role.SUPER_ADMIN, Role.SALON_OWNER]);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return jsonError("Barber id required");
    const existing = await prisma.barber.findUnique({ where: { id } });
    if (!existing) return jsonError("Barber not found", 404);
    await assertSalonOwnerAccess(session, existing.salonId);
    await prisma.barber.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
