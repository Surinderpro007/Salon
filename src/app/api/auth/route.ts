import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  createSession,
  verifyPassword,
  destroySession,
  getSession,
} from "@/lib/auth";
import { registerSchema, loginSchema } from "@/lib/validators";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";
import { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "register") {
      const data = registerSchema.parse(body);
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) return jsonError("Email already registered", 409);

      const role =
        data.role === "SALON_OWNER" ? Role.SALON_OWNER : Role.CUSTOMER;

      const user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email.toLowerCase(),
          password: await hashPassword(data.password),
          phone: data.phone,
          role,
        },
      });

      await createSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      return jsonOk({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    }

    if (action === "login") {
      const data = loginSchema.parse(body);
      const user = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      if (!user || !(await verifyPassword(data.password, user.password))) {
        return jsonError("Invalid email or password", 401);
      }

      await createSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      return jsonOk({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    }

    if (action === "logout") {
      await destroySession();
      return jsonOk({ ok: true });
    }

    return jsonError("Unknown action");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return jsonOk({ user: null });
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, name: true, phone: true, role: true },
    });
    return jsonOk({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
