"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { EmptyState, LoadingBlock, StatusBadge } from "@/components/ui";
import { formatDisplayDate, formatDisplayTime } from "@/lib/utils";

type Booking = {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  price: number;
  status: string;
  paymentMethod: "PAY_AT_SALON" | "RAZORPAY_CARD" | "RAZORPAY_UPI";
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "FAILED";
  salon: { id: string; name: string };
  barber: { name: string };
  service: { name: string };
  customer: { name: string; email: string; phone: string | null };
};

export default function OwnerBookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ owner: "1" });
    if (status) params.set("status", status);
    const res = await fetch(`/api/bookings?${params}`);
    const data = await res.json();
    setBookings(data.bookings || []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "SALON_OWNER") {
      router.push("/");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, status, router]);

  async function respond(id: string, action: "accept" | "reject" | "complete") {
    if (action === "complete" && !confirm("Mark this appointment as completed?")) {
      return;
    }
    setBusyId(id);
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Action failed");
      return;
    }
    await load();
  }

  if (authLoading) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/owner" className="text-sm text-[var(--accent)]">
        ← Dashboard
      </Link>
      <h1 className="mt-2 font-display text-3xl">Appointment requests</h1>
      <p className="mt-1 text-[var(--muted)]">
        Accept or reject booking requests from customers.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", ""].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ring-1 ${
              status === s
                ? "bg-[var(--ink)] text-[var(--cream)] ring-[var(--ink)]"
                : "bg-white text-[var(--muted)] ring-[var(--border)]"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <LoadingBlock />
        ) : bookings.length === 0 ? (
          <EmptyState title="No bookings in this filter" />
        ) : (
          bookings.map((b) => (
            <div key={b.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{b.customer.name}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {b.customer.email}
                    {b.customer.phone ? ` · ${b.customer.phone}` : ""}
                  </p>
                  <p className="mt-2 text-sm">
                    {b.salon.name} · {b.service.name} · with {b.barber.name}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {formatDisplayDate(b.appointmentDate)} ·{" "}
                    {formatDisplayTime(b.startTime)}–{formatDisplayTime(b.endTime)} · ₹
                    {b.price} ·{" "}
                    <span
                      className={
                        b.paymentStatus === "PAID"
                          ? "font-medium text-emerald-700"
                          : "font-medium text-stone-500"
                      }
                    >
                      {b.paymentStatus === "PAID"
                        ? "Paid online"
                        : b.paymentMethod === "PAY_AT_SALON"
                          ? "Pay at salon"
                          : "Payment pending"}
                    </span>
                  </p>
                </div>
                <StatusBadge status={b.status} />
                              {b.status === "CONFIRMED" && (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busyId === b.id}
                    onClick={() => respond(b.id, "complete")}
                  >
                    {busyId === b.id ? "Updating…" : "Mark as completed"}
                  </button>
                </div>
              )}
              </div>
              {b.status === "PENDING" && (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busyId === b.id}
                    onClick={() => respond(b.id, "accept")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busyId === b.id}
                    onClick={() => respond(b.id, "reject")}
                  >
                    Reject
                  </button>
                  
                </div>
                  
              )}
            </div>

          ))
        )}
      </div>
    </div>
  );
}
