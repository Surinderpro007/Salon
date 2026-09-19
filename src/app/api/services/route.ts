import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serviceSchema } from "@/lib/validators";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";
import { assertSalonOwnerAccess } from "@/lib/salon-access";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const salonId = searchParams.get("salonId");
    const id = searchParams.get("id");

    if (id) {
      const service = await prisma.service.findUnique({
        where: { id },
        include: { barberServices: { include: { barber: true } } },
      });
      if (!service) return jsonError("Service not found", 404);
      return jsonOk({
        service: {
          ...service,
          barbers: service.barberServices.map((bs) => bs.barber),
        },
      });
    }

    if (!salonId) return jsonError("salonId required");
    const services = await prisma.service.findMany({
      where: { salonId },
      include: { barberServices: { include: { barber: true } } },
      orderBy: { price: "asc" },
    });

    return jsonOk({
      services: services.map((s) => ({
        ...s,
        barbers: s.barberServices.map((bs) => bs.barber),
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
    const data = serviceSchema.parse(body);

    const salon = await prisma.salon.findUnique({ where: { id: salonId } });
    if (!salon) return jsonError("Salon not found", 404);

    const service = await prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          salonId,
          name: data.name,
          description: data.description || "",
          price: data.price,
          duration: data.duration,
          status: data.status || "ACTIVE",
        },
      });

      if (data.barberIds?.length) {
        await tx.barberService.createMany({
          data: data.barberIds.map((barberId) => ({
            barberId,
            serviceId: created.id,
          })),
        });
      }

      return created;
    });

    return jsonOk({ service }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth([Role.SUPER_ADMIN, Role.SALON_OWNER]);
    const body = await req.json();
    const id = body.id as string;
    if (!id) return jsonError("Service id required");
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) return jsonError("Service not found", 404);
    await assertSalonOwnerAccess(session, existing.salonId);
    const data = serviceSchema.partial().parse(body);

    const service = await prisma.$transaction(async (tx) => {
      const updated = await tx.service.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.duration !== undefined && { duration: data.duration }),
          ...(data.status !== undefined && { status: data.status }),
        },
      });

      if (data.barberIds !== undefined) {
        await tx.barberService.deleteMany({ where: { serviceId: id } });
        if (data.barberIds.length) {
          await tx.barberService.createMany({
            data: data.barberIds.map((barberId) => ({
              barberId,
              serviceId: id,
            })),
          });
        }
      }

      return updated;
    });

    return jsonOk({ service });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth([Role.SUPER_ADMIN, Role.SALON_OWNER]);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return jsonError("Service id required");
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) return jsonError("Service not found", 404);
    await assertSalonOwnerAccess(session, existing.salonId);
    await prisma.service.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
