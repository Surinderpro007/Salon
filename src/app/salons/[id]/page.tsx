"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Banknote, Check, Clock, CreditCard, MapPin, Smartphone, Star } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { EmptyState, LoadingBlock, StatusBadge, TrustBadges } from "@/components/ui";
import { cn, formatDisplayDate, formatDisplayTime } from "@/lib/utils";

type PaymentMethod = "PAY_AT_SALON" | "RAZORPAY_CARD" | "RAZORPAY_UPI";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

let razorpayScriptPromise: Promise<void> | null = null;
function loadRazorpayScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load Razorpay checkout"));
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

type Service = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  status: string;
  barbers: { id: string; name: string; status: string }[];
};

type Barber = {
  id: string;
  name: string;
  profilePhoto: string | null;
  bio: string;
  yearsExperience: number;
  specialization: string;
  skills: string[];
  rating: number;
  status: string;
  services: { id: string; name: string }[];
};

type Slot = { startTime: string; endTime: string; available: boolean };

type Salon = {
  id: string;
  name: string;
  logo: string | null;
  images: string[];
  address: string;
  city: string;
  contactNumber: string;
  openingTime: string;
  closingTime: string;
  workingDays: string[];
  rating: number;
  isOpen: boolean;
  isVerified?: boolean;
  isPremium?: boolean;
  category: string;
  services: Service[];
  barbers: Barber[];
};

export default function SalonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [salon, setSalon] = useState<Salon | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviceId, setServiceId] = useState("");
  const [barberId, setBarberId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotReason, setSlotReason] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState<
  {
    id: string;
    rating: number;
    comment: string;
    customer: { name: string };
    barber: { name: string };
    createdAt: string;
  }[]
>([]);
  const [reviewCount, setReviewCount] = useState(0);

  // 2-step widget: pick the slot first, then review + choose how to pay.
  const [step, setStep] = useState<"select" | "review">("select");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PAY_AT_SALON");
  const [payingOnline, setPayingOnline] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/salons?id=${id}`);
      const data = await res.json();
      if (res.ok) setSalon(data.salon);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const res = await fetch(`/api/reviews?salonId=${id}`);
      const data = await res.json();
      if (res.ok) {
        setReviews(data.reviews || []);
        setReviewCount(data.count || 0);
      }
    })();
  }, [id]);

  const activeServices = useMemo(
    () => (salon?.services || []).filter((s) => s.status === "ACTIVE"),
    [salon]
  );

  const selectedService = activeServices.find((s) => s.id === serviceId);

  const availableBarbers = useMemo(() => {
    if (!salon || !selectedService) return [];
    return salon.barbers.filter(
      (b) =>
        b.status === "ACTIVE" &&
        selectedService.barbers.some((sb) => sb.id === b.id)
    );
  }, [salon, selectedService]);

  useEffect(() => {
    setBarberId("");
    setSelectedSlot("");
    setSlots([]);
    setStep("select");
  }, [serviceId]);

  useEffect(() => {
    setSelectedSlot("");
    setStep("select");
    if (!barberId || !serviceId || !date) {
      setSlots([]);
      return;
    }
    (async () => {
      setSlotsLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          action: "slots",
          barberId,
          serviceId,
          date,
        });
        const res = await fetch(`/api/bookings?${params}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not load slots");
          setSlots([]);
        } else {
          setSlots(data.slots || []);
          setSlotReason(data.reason);
        }
      } finally {
        setSlotsLoading(false);
      }
    })();
  }, [barberId, serviceId, date]);

  async function refreshSlotsAfterConflict() {
    const params = new URLSearchParams({ action: "slots", barberId, serviceId, date });
    const slotRes = await fetch(`/api/bookings?${params}`);
    const slotData = await slotRes.json();
    setSlots(slotData.slots || []);
    setSelectedSlot("");
    setStep("select");
  }

  function goToReview() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!selectedSlot) return;
    setError("");
    setMessage("");
    setStep("review");
  }

  // Creates the booking row (reserving the slot) and returns it, regardless of
  // payment method — online methods just start out with paymentStatus PENDING.
  async function createBookingRequest() {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salonId: salon!.id,
        serviceId,
        barberId,
        appointmentDate: date,
        startTime: selectedSlot,
        paymentMethod,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Booking failed");
    return data as { booking: { id: string }; message: string };
  }

  async function confirmDetails() {
    if (!salon || !serviceId || !barberId || !date || !selectedSlot) return;
    setError("");
    setMessage("");

    if (paymentMethod === "PAY_AT_SALON") {
      setBooking(true);
      try {
        const data = await createBookingRequest();
        setMessage(data.message);
        setTimeout(() => router.push("/appointments"), 2200);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Booking failed");
        await refreshSlotsAfterConflict();
      } finally {
        setBooking(false);
      }
      return;
    }

    // Online payment: reserve the slot, create a Razorpay order, then open checkout.
    setPayingOnline(true);
    let bookingId = "";
    try {
      const created = await createBookingRequest();
      bookingId = created.booking.id;

      await loadRazorpayScript();

      const orderRes = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-order", bookingId }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error || "Could not start payment");

      const razorpay = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "TrimBook",
        description: `${selectedService?.name} at ${salon.name}`,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#0f766e" },
        method:
          paymentMethod === "RAZORPAY_UPI"
            ? { upi: true, card: false, netbanking: false, wallet: false, emi: false }
            : { card: true, netbanking: true, upi: true, wallet: true, emi: false },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch("/api/payments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "verify", bookingId, ...response }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Payment verification failed");
            setMessage("Payment successful. Appointment request sent — waiting for salon confirmation.");
            setTimeout(() => router.push("/appointments"), 2200);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Payment verification failed");
          } finally {
            setPayingOnline(false);
          }
        },
        modal: {
          ondismiss: async () => {
            // User closed the checkout without paying — release the reserved slot.
            try {
              await fetch(`/api/payments?bookingId=${bookingId}`, { method: "DELETE" });
              await refreshSlotsAfterConflict();
              setError("Payment cancelled. The slot has been released.");
            } finally {
              setPayingOnline(false);
            }
          },
        },
      });

      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      if (bookingId) {
        await fetch(`/api/payments?bookingId=${bookingId}`, { method: "DELETE" }).catch(() => {});
      }
      await refreshSlotsAfterConflict();
      setPayingOnline(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (!salon) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState title="Salon not found" />
      </div>
    );
  }

  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div
            className="aspect-[16/9] overflow-hidden rounded-[1.5rem] bg-stone-200"
            style={{
              backgroundImage: `url(${salon.images[0] || salon.logo || ""})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          {salon.images.length > 1 && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {salon.images.slice(1, 4).map((img) => (
                <div
                  key={img}
                  className="aspect-[4/3] rounded-xl bg-stone-200"
                  style={{
                    backgroundImage: `url(${img})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              ))}
            </div>
          )}

          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl sm:text-4xl">{salon.name}</h1>
              <StatusBadge open={salon.isOpen} />
              <TrustBadges
                verified={salon.isVerified}
                premium={salon.isPremium}
                size="md"
              />
            </div>
            <p className="mt-2 flex items-center gap-1 text-[var(--muted)]">
              <MapPin className="h-4 w-4" />
              {salon.address}, {salon.city}
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <span className="inline-flex items-center gap-1 text-[var(--gold)]">
                <Star className="h-4 w-4 fill-current" />
                {salon.rating.toFixed(1)}
              </span>
              <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                <Clock className="h-4 w-4" />
                {formatDisplayTime(salon.openingTime)} –{" "}
                {formatDisplayTime(salon.closingTime)}
              </span>
              <span className="text-[var(--muted)]">{salon.category}</span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Working days: {salon.workingDays.join(", ")}
            </p>
          </div>

          <section className="mt-10">
            <h2 className="font-display text-2xl">Services</h2>
            <div className="mt-4 space-y-3">
              {activeServices.map((svc) => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => setServiceId(svc.id)}
                  className={cn(
                    "card w-full p-4 text-left transition",
                    serviceId === svc.id && "ring-2 ring-[var(--accent)]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{svc.name}</p>
                      <p className="mt-0.5 text-sm text-[var(--muted)]">
                        {svc.description}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {svc.duration} min
                      </p>
                    </div>
                    <p className="font-semibold">₹{svc.price}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-2xl">Barbers</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {salon.barbers
                .filter((b) => b.status === "ACTIVE")
                .map((b) => (
                  <div key={b.id} className="card flex gap-3 p-4">
                    <div
                      className="h-16 w-16 shrink-0 rounded-xl bg-stone-200"
                      style={{
                        backgroundImage: b.profilePhoto
                          ? `url(${b.profilePhoto})`
                          : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-sm text-[var(--accent)]">
                        {b.specialization}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {b.yearsExperience} yrs · ★ {b.rating.toFixed(1)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                        {b.bio}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-2xl">
              Reviews {reviewCount > 0 && `(${reviewCount})`}
            </h2>
            <div className="mt-4 space-y-3">
              {reviews.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No reviews yet. Be the first to visit and share how it went!
                </p>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{r.customer.name}</p>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-4 w-4 ${
                              n <= r.rating
                                ? "fill-current text-[var(--gold)]"
                                : "text-stone-300"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      With {r.barber.name} ·{" "}
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                    {r.comment && (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        &ldquo;{r.comment}&rdquo;
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="font-display text-2xl">Request appointment</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {step === "select"
                ? "Service → Barber → Date → Slot. Salon confirms before it's final."
                : "Check your appointment details and select payment method."}
            </p>

            {step === "select" ? (
            <div className="mt-5 space-y-4">
              <div>
                <label className="label">1. Service</label>
                <select
                  className="input"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                >
                  <option value="">Select service</option>
                  {activeServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — ₹{s.price} ({s.duration}m)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">2. Preferred barber</label>
                <select
                  className="input"
                  value={barberId}
                  onChange={(e) => setBarberId(e.target.value)}
                  disabled={!serviceId}
                >
                  <option value="">Select barber</option>
                  {availableBarbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.specialization}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">3. Date</label>
                <input
                  type="date"
                  className="input"
                  min={minDate}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={!barberId}
                />
              </div>

              <div>
                <label className="label">4. Available slots</label>
                {slotsLoading ? (
                  <p className="text-sm text-[var(--muted)]">Loading slots…</p>
                ) : !date || !barberId ? (
                  <p className="text-sm text-[var(--muted)]">
                    Select barber and date to see slots.
                  </p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    {slotReason || "No slots available for this day."}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.startTime}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot.startTime)}
                        className={cn(
                          "rounded-lg px-2 py-2 text-xs font-medium transition",
                          slot.available
                            ? cn(
                                "slot-available",
                                selectedSlot === slot.startTime && "selected"
                              )
                            : "slot-unavailable"
                        )}
                      >
                        {formatDisplayTime(slot.startTime)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              )}
              {message && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {message}
                </p>
              )}

              <button
                type="button"
                className="btn-primary w-full"
                disabled={!selectedSlot}
                onClick={goToReview}
              >
                {!user
                  ? "Login to request"
                  : selectedSlot
                    ? `Continue with ${formatDisplayTime(selectedSlot)}`
                    : "Select a slot"}
              </button>

              {selectedService && date && selectedSlot && (
                <p className="text-center text-xs text-[var(--muted)]">
                  {selectedService.name} on {formatDisplayDate(date)} at{" "}
                  {formatDisplayTime(selectedSlot)}
                </p>
              )}

              {!user && (
                <p className="text-center text-xs text-[var(--muted)]">
                  <Link href="/login" className="text-[var(--accent)]">
                    Sign in
                  </Link>{" "}
                  or{" "}
                  <Link href="/register" className="text-[var(--accent)]">
                    register
                  </Link>{" "}
                  to complete booking.
                </p>
              )}
            </div>
            ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-[var(--muted)]">Salon</span>
                  <span className="font-medium">{salon.name}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-[var(--muted)]">Service</span>
                  <span className="text-right font-medium">
                    {selectedService?.name}
                    <span className="ml-1 text-xs text-[var(--muted)]">
                      · {selectedService?.duration} mins
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-[var(--muted)]">Barber</span>
                  <span className="font-medium">
                    {availableBarbers.find((b) => b.id === barberId)?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-[var(--muted)]">Date &amp; time</span>
                  <span className="text-right font-medium">
                    {formatDisplayDate(date)}
                    <br />
                    {formatDisplayTime(selectedSlot)}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-[var(--surface)] px-4 py-3 text-sm">
                  <span className="font-medium">Total</span>
                  <span className="font-semibold">₹{selectedService?.price}</span>
                </div>
              </div>

              <div>
                <label className="label">Select payment method</label>
                <div className="mt-2 space-y-2">
                  {(
                    [
                      {
                        id: "PAY_AT_SALON",
                        label: "Pay at Salon",
                        sub: "Pay directly at the salon after your service",
                        icon: Banknote,
                      },
                      {
                        id: "RAZORPAY_CARD",
                        label: "Card / Netbanking",
                        sub: "Pay securely via Razorpay",
                        icon: CreditCard,
                      },
                      {
                        id: "RAZORPAY_UPI",
                        label: "UPI / Google Pay",
                        sub: "Instant transfer via UPI apps",
                        icon: Smartphone,
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPaymentMethod(opt.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition",
                        paymentMethod === opt.id
                          ? "border-[var(--accent)] ring-1 ring-[var(--accent)] bg-[var(--surface)]"
                          : "border-[var(--border)]"
                      )}
                    >
                      <opt.icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
                      <span className="flex-1">
                        <span className="block text-sm font-medium">{opt.label}</span>
                        <span className="block text-xs text-[var(--muted)]">{opt.sub}</span>
                      </span>
                      {paymentMethod === opt.id && (
                        <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              )}
              {message && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {message}
                </p>
              )}

              <button
                type="button"
                className="btn-primary w-full"
                disabled={booking || payingOnline}
                onClick={confirmDetails}
              >
                {booking
                  ? "Sending request…"
                  : payingOnline
                    ? "Opening payment…"
                    : "Confirm Details"}
              </button>

              <button
                type="button"
                className="w-full text-center text-xs text-[var(--muted)] underline"
                onClick={() => {
                  setStep("select");
                  setError("");
                }}
                disabled={booking || payingOnline}
              >
                Back to slot selection
              </button>
            </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}