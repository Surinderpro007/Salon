import {
  BookingStatus,
  EntityStatus,
  ListingStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "./prisma";
import {
  addDuration,
  formatDisplayDate,
  formatDisplayTime,
  generateSlots,
  getDayName,
  parseJsonArray,
  rangesOverlap,
  timeToMinutes,
} from "./utils";

export class BookingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function getAvailableSlots(params: {
  barberId: string;
  serviceId: string;
  date: string;
}) {
  const { barberId, serviceId, date } = params;

  const barber = await prisma.barber.findUnique({
    where: { id: barberId },
    include: {
      salon: true,
      barberServices: true,
    },
  });

  if (!barber) throw new BookingError("Barber not found", 404);
  if (barber.status !== EntityStatus.ACTIVE) {
    throw new BookingError("Barber is inactive");
  }
  if (
    barber.salon.status !== EntityStatus.ACTIVE ||
    barber.salon.listingStatus !== ListingStatus.APPROVED
  ) {
    throw new BookingError("Salon is not available for booking");
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new BookingError("Service not found", 404);
  if (service.status !== EntityStatus.ACTIVE) {
    throw new BookingError("Service is inactive");
  }
  if (service.salonId !== barber.salonId) {
    throw new BookingError("Service does not belong to this salon");
  }

  const provides = barber.barberServices.some((bs) => bs.serviceId === serviceId);
  if (!provides) {
    throw new BookingError("Selected barber does not provide this service");
  }

  const dayName = getDayName(date);
  const barberDays = parseJsonArray(barber.workingDays);
  const salonDays = parseJsonArray(barber.salon.workingDays);

  if (!barberDays.includes(dayName)) {
    return { slots: [], reason: "Barber is off on this day" };
  }
  if (!salonDays.includes(dayName)) {
    return { slots: [], reason: "Salon is closed on this day" };
  }

  const activeStatuses: BookingStatus[] = [
    BookingStatus.PENDING,
    BookingStatus.CONFIRMED,
    BookingStatus.COMPLETED,
  ];

  const bookings = await prisma.booking.findMany({
    where: {
      barberId,
      appointmentDate: date,
      status: { in: activeStatuses },
    },
    select: { startTime: true, endTime: true },
  });

  const slots = generateSlots({
    workStartTime: barber.workStartTime,
    workEndTime: barber.workEndTime,
    breakStartTime: barber.breakStartTime,
    breakEndTime: barber.breakEndTime,
    durationMinutes: service.duration,
    existingBookings: bookings,
  });

  return { slots, reason: null };
}

/**
 * Creates a PENDING appointment request.
 * Slot is reserved until salon accepts/rejects or customer cancels.
 */
export async function createBooking(params: {
  customerId: string;
  salonId: string;
  barberId: string;
  serviceId: string;
  appointmentDate: string;
  startTime: string;
  paymentMethod?: PaymentMethod;
}) {
  const {
    customerId,
    salonId,
    barberId,
    serviceId,
    appointmentDate,
    startTime,
    paymentMethod = PaymentMethod.PAY_AT_SALON,
  } = params;

  // Pay-at-salon needs nothing collected online; online methods start PENDING
  // until Razorpay confirms the payment.
  const paymentStatus =
    paymentMethod === PaymentMethod.PAY_AT_SALON
      ? PaymentStatus.UNPAID
      : PaymentStatus.PENDING;

  const [salon, barber, service] = await Promise.all([
    prisma.salon.findUnique({ where: { id: salonId } }),
    prisma.barber.findUnique({
      where: { id: barberId },
      include: { barberServices: true },
    }),
    prisma.service.findUnique({ where: { id: serviceId } }),
  ]);

  if (!salon) throw new BookingError("Salon not found", 404);
  if (!barber) throw new BookingError("Barber not found", 404);
  if (!service) throw new BookingError("Service not found", 404);

  if (
    salon.status !== EntityStatus.ACTIVE ||
    salon.listingStatus !== ListingStatus.APPROVED
  ) {
    throw new BookingError("Cannot book a salon that is not approved/active");
  }
  if (barber.status !== EntityStatus.ACTIVE) {
    throw new BookingError("Cannot book an inactive barber");
  }
  if (service.status !== EntityStatus.ACTIVE) {
    throw new BookingError("Cannot book an inactive service");
  }
  if (barber.salonId !== salonId) {
    throw new BookingError("Barber does not belong to this salon");
  }
  if (service.salonId !== salonId) {
    throw new BookingError("Service does not belong to this salon");
  }
  if (!barber.barberServices.some((bs) => bs.serviceId === serviceId)) {
    throw new BookingError("Selected barber does not provide this service");
  }

  const dayName = getDayName(appointmentDate);
  const barberDays = parseJsonArray(barber.workingDays);
  const salonDays = parseJsonArray(salon.workingDays);

  if (!salonDays.includes(dayName)) {
    throw new BookingError("Salon is closed on the selected day");
  }
  if (!barberDays.includes(dayName)) {
    throw new BookingError("Barber is not available on the selected day");
  }

  const endTime = addDuration(startTime, service.duration);
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const workStart = timeToMinutes(barber.workStartTime);
  const workEnd = timeToMinutes(barber.workEndTime);

  if (startMins < workStart || endMins > workEnd) {
    throw new BookingError("Selected time is outside barber working hours");
  }

  if (barber.breakStartTime && barber.breakEndTime) {
    if (
      rangesOverlap(
        startMins,
        endMins,
        timeToMinutes(barber.breakStartTime),
        timeToMinutes(barber.breakEndTime)
      )
    ) {
      throw new BookingError("Selected time overlaps barber break");
    }
  }

  const existing = await prisma.booking.findMany({
    where: {
      barberId,
      appointmentDate,
      status: {
        in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
      },
    },
  });

  const overlaps = existing.some((b) =>
    rangesOverlap(
      startMins,
      endMins,
      timeToMinutes(b.startTime),
      timeToMinutes(b.endTime)
    )
  );
  if (overlaps) {
    throw new BookingError("This time slot is no longer available");
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          customerId,
          salonId,
          barberId,
          serviceId,
          appointmentDate,
          startTime,
          endTime,
          price: service.price,
          status: BookingStatus.PENDING,
          paymentMethod,
          paymentStatus,
        },
        include: {
          salon: true,
          barber: true,
          service: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
        },
      });

      const when = `${formatDisplayTime(startTime)} on ${formatDisplayDate(appointmentDate)}`;

      await tx.notification.create({
        data: {
          userId: customerId,
          title: "Appointment request sent",
          message: `Your request at ${created.salon.name} with ${created.barber.name} for ${when} is awaiting salon confirmation.`,
        },
      });

      if (created.salon.ownerId) {
        await tx.notification.create({
          data: {
            userId: created.salon.ownerId,
            title: "New appointment request",
            message: `${created.customer.name} requested ${created.service.name} with ${created.barber.name} at ${when}. Please accept or reject.`,
          },
        });
      }

      return created;
    });

    return booking;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new BookingError(
        "This time slot was just booked by someone else. Please choose another.",
        409
      );
    }
    throw err;
  }
}

export async function respondToBooking(params: {
  bookingId: string;
  actorId: string;
  isAdmin: boolean;
  decision: "accept" | "reject";
  note?: string;
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    include: {
      salon: true,
      barber: true,
      service: true,
      customer: { select: { id: true, name: true } },
    },
  });

  if (!booking) throw new BookingError("Booking not found", 404);
  if (booking.status !== BookingStatus.PENDING) {
    throw new BookingError("Only pending requests can be accepted or rejected");
  }

  const isOwner = booking.salon.ownerId === params.actorId;
  if (!params.isAdmin && !isOwner) {
    throw new BookingError("Forbidden", 403);
  }

  const nextStatus =
    params.decision === "accept" ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: nextStatus,
        ownerNote: params.note || null,
      },
      include: {
        salon: true,
        barber: true,
        service: true,
        customer: { select: { id: true, name: true } },
      },
    });

    const when = `${formatDisplayTime(booking.startTime)} on ${formatDisplayDate(booking.appointmentDate)}`;

    if (params.decision === "accept") {
      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Appointment confirmed",
          message: `Your appointment at ${booking.salon.name} with ${booking.barber.name} is confirmed for ${when}.`,
        },
      });
    } else {
      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Appointment declined",
          message: `Your appointment request at ${booking.salon.name} for ${when} was declined by the salon.${
            params.note ? ` Note: ${params.note}` : ""
          }`,
        },
      });
    }

    return result;
  });

  return updated;
}
export async function markCompleted(params: {
  bookingId: string;
  actorId: string;
  isAdmin: boolean;
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    include: { salon: true, barber: true, service: true, customer: true },
  });

  if (!booking) throw new BookingError("Booking not found", 404);

  const isOwner = booking.salon.ownerId === params.actorId;
  if (!params.isAdmin && !isOwner) {
    throw new BookingError("Forbidden", 403);
  }
  if (booking.status !== BookingStatus.CONFIRMED) {
    throw new BookingError("Only confirmed appointments can be marked as completed");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.COMPLETED },
      include: { salon: true, barber: true, service: true, customer: true },
    });

    await tx.notification.create({
      data: {
        userId: booking.customerId,
        title: "Visit completed",
        message: `Your appointment at ${updated.salon.name} with ${updated.barber.name} is marked complete. Tell others how it went — leave a review!`,
      },
    });

    return updated;
  });
}

/**
 * Attaches the Razorpay order id to a booking right after the order is created,
 * so verification can later confirm it belongs to this booking/customer.
 */
export async function attachRazorpayOrder(bookingId: string, orderId: string) {
  return prisma.booking.update({
    where: { id: bookingId },
    data: { razorpayOrderId: orderId },
  });
}

/**
 * Marks a booking as paid after the Razorpay signature has been verified.
 * The appointment itself stays PENDING — the salon still needs to accept it.
 */
export async function markBookingPaid(params: {
  bookingId: string;
  paymentId: string;
  signature: string;
}) {
  return prisma.booking.update({
    where: { id: params.bookingId },
    data: {
      paymentStatus: PaymentStatus.PAID,
      razorpayPaymentId: params.paymentId,
      razorpaySignature: params.signature,
    },
  });
}

/**
 * Called when an online payment fails or the Razorpay checkout is dismissed.
 * Frees the reserved slot by cancelling the still-unpaid booking, without the
 * "customer cancelled" notification wording used for a real cancellation.
 */
export async function releaseUnpaidBooking(bookingId: string, customerId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new BookingError("Booking not found", 404);
  if (booking.customerId !== customerId) throw new BookingError("Forbidden", 403);
  if (booking.paymentStatus === PaymentStatus.PAID) {
    throw new BookingError("This booking is already paid for");
  }
  if (booking.status === BookingStatus.CANCELLED) {
    return booking;
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.CANCELLED, paymentStatus: PaymentStatus.FAILED },
  });
}

export async function cancelBooking(
  bookingId: string,
  userId: string,
  isAdmin: boolean
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { salon: true },
  });
  if (!booking) throw new BookingError("Booking not found", 404);

  const isOwner = booking.salon.ownerId === userId;
  const isCustomer = booking.customerId === userId;
  if (!isAdmin && !isCustomer && !isOwner) {
    throw new BookingError("Forbidden", 403);
  }
  if (booking.status === BookingStatus.CANCELLED) {
    throw new BookingError("Booking is already cancelled");
  }
  if (booking.status === BookingStatus.COMPLETED) {
    throw new BookingError("Completed bookings cannot be cancelled");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
      include: {
        salon: true,
        barber: true,
        service: true,
        customer: { select: { id: true, name: true } },
      },
    });

    if (isCustomer && booking.salon.ownerId) {
      await tx.notification.create({
        data: {
          userId: booking.salon.ownerId,
          title: "Appointment cancelled",
          message: `${updated.customer.name} cancelled their appointment at ${updated.salon.name}.`,
        },
      });
    } else if ((isOwner || isAdmin) && !isCustomer) {
      await tx.notification.create({
        data: {
          userId: booking.customerId,
          title: "Appointment cancelled",
          message: `Your appointment at ${updated.salon.name} was cancelled.`,
        },
      });
    }

    return updated;
  });
}
