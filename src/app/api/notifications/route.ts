import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";

export async function GET() {
  try {
    const session = await requireAuth();
    const notifications = await prisma.notification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unread = notifications.filter((n) => !n.read).length;
    return jsonOk({ notifications, unread });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    if (body.action === "read-all") {
      await prisma.notification.updateMany({
        where: { userId: session.id, read: false },
        data: { read: true },
      });
      return jsonOk({ ok: true });
    }

    if (body.id) {
      await prisma.notification.updateMany({
        where: { id: body.id, userId: session.id },
        data: { read: true },
      });
      return jsonOk({ ok: true });
    }

    return jsonError("Invalid request");
  } catch (err) {
    return handleApiError(err);
  }
}
