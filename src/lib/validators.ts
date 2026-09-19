import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  role: z.enum(["CUSTOMER", "SALON_OWNER"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const salonSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  logo: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
  address: z.string().min(3),
  city: z.string().min(2),
  contactNumber: z.string().min(7),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/),
  workingDays: z.array(z.string()).min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  category: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const barberSchema = z.object({
  name: z.string().min(2),
  profilePhoto: z.string().optional().nullable(),
  bio: z.string().optional(),
  yearsExperience: z.number().int().min(0),
  specialization: z.string().min(2),
  skills: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
  workingDays: z.array(z.string()).min(1),
  workStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  workEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  breakStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  breakEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  serviceIds: z.array(z.string()).optional(),
});

export const serviceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
  duration: z.number().int().positive(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  barberIds: z.array(z.string()).optional(),
});

export const bookingSchema = z.object({
  salonId: z.string().min(1),
  barberId: z.string().min(1),
  serviceId: z.string().min(1),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  paymentMethod: z
    .enum(["PAY_AT_SALON", "RAZORPAY_CARD", "RAZORPAY_UPI"])
    .optional(),
});

export const paymentActionSchema = z.object({
  action: z.enum(["create-order", "verify"]),
  bookingId: z.string().min(1),
  razorpay_order_id: z.string().optional(),
  razorpay_payment_id: z.string().optional(),
  razorpay_signature: z.string().optional(),
});

export const reviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const profileSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
});
