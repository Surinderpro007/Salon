"use client";

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
  salon: { id: string; name: string };
  barber: { id: string; name: string };
  service: { name: string };
  customer: { name: string; email: string };
};

type SalonOption = { id: string; name: string };

export default function AdminBookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [salons, setSalons] = useState<SalonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    salonId: "",
    date: "",
    customer: "",
    status: "",
  });

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ admin: "1" });
    if (filters.salonId) params.set("salonId", filters.salonId);
    if (filters.date) params.set("date", filters.date);
    if (filters.customer) params.set("customer", filters.customer);
    if (filters.status) params.set("status", filters.status);
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
    if (user.role !== "SUPER_ADMIN") {
      router.push("/");
      return;
    }
    fetch("/api/salons?admin=1")
      .then((r) => r.json())
      .then((d) => setSalons(d.salons || []));
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role !== "SUPER_ADMIN") return;
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, user]);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "status", status }),
    });
    await load();
  }

  if (authLoading) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl">Bookings</h1>
      <p className="mt-1 text-[var(--muted)]">
        View and filter all appointments.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          className="input"
          value={filters.salonId}
          onChange={(e) => setFilters({ ...filters, salonId: e.target.value })}
        >
          <option value="">All salons</option>
          {salons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input"
          value={filters.date}
          onChange={(e) => setFilters({ ...filters, date: e.target.value })}
        />
        <input
          className="input"
          placeholder="Customer name/email"
          value={filters.customer}
          onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
        />
        <select
          className="input"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All statuses</option>
          {["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            )
          )}
        </select>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <LoadingBlock />
        ) : bookings.length === 0 ? (
          <EmptyState title="No bookings match your filters" />
        ) : (
          bookings.map((b) => (
            <div
              key={b.id}
              className="card flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{b.customer.name}</p>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-sm text-[var(--muted)]">{b.customer.email}</p>
                <p className="mt-1 text-sm">
                  {b.salon.name} · {b.service.name} · {b.barber.name}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {formatDisplayDate(b.appointmentDate)} ·{" "}
                  {formatDisplayTime(b.startTime)}–{formatDisplayTime(b.endTime)} · ₹
                  {b.price}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={b.status === s}
                    className="btn-ghost ring-1 ring-[var(--border)] text-xs disabled:opacity-40"
                    onClick={() => updateStatus(b.id, s)}
                  >
                    {s.replace("_", "-")}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
