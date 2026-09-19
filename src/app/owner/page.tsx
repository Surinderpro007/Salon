"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Scissors,
  Store,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { LoadingBlock, StatusBadge } from "@/components/ui";
import { formatDisplayDate, formatDisplayTime } from "@/lib/utils";

type Stats = {
  salonCount: number;
  pendingListings: number;
  approvedListings: number;
  pendingBookings: number;
  confirmedBookings: number;
  todayBookings: number;
  totalStaff: number;
  totalServices: number;
};

export default function OwnerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<
    {
      id: string;
      appointmentDate: string;
      startTime: string;
      status: string;
      salon: { name: string };
      barber: { name: string };
      service: { name: string };
      customer: { name: string; email: string };
    }[]
  >([]);
  const [salons, setSalons] = useState<
    {
      id: string;
      name: string;
      listingStatus: string;
      city: string;
      _count: { barbers: number; services: number; bookings: number };
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/owner/dashboard");
    const data = await res.json();
    if (res.ok) {
      setStats(data.stats);
      setRecent(data.recentRequests || []);
      setSalons(data.salons || []);
    }
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
  }, [user, authLoading, router]);

  async function respond(id: string, action: "accept" | "reject") {
    setBusyId(id);
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setBusyId(null);
    await load();
  }

  if (authLoading || loading || !stats) return <LoadingBlock />;

  const cards = [
    { label: "My salons", value: stats.salonCount, icon: Store },
    { label: "Live listings", value: stats.approvedListings, icon: CheckCircle2 },
    { label: "Pending requests", value: stats.pendingBookings, icon: Clock },
    { label: "Confirmed", value: stats.confirmedBookings, icon: Calendar },
    { label: "Today", value: stats.todayBookings, icon: Calendar },
    { label: "Staff", value: stats.totalStaff, icon: Scissors },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Salon owner</h1>
          <p className="mt-2 text-[var(--muted)]">
            Manage your salon profile, staff, and appointment requests.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/owner/salon" className="btn-primary">
            Manage salon
          </Link>
          <Link href="/owner/bookings" className="btn-secondary">
            All requests
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--muted)]">{c.label}</p>
              <c.icon className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <p className="mt-2 font-display text-3xl">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Your salons</h2>
        <div className="mt-4 space-y-3">
          {salons.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-[var(--muted)]">No salon profile yet.</p>
              <Link href="/owner/salon" className="btn-primary mt-4 inline-flex">
                Create salon profile
              </Link>
            </div>
          ) : (
            salons.map((s) => (
              <div
                key={s.id}
                className="card flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-xl">{s.name}</p>
                    <StatusBadge status={s.listingStatus} />
                  </div>
                  <p className="text-sm text-[var(--muted)]">
                    {s.city} · {s._count.barbers} staff · {s._count.services}{" "}
                    services
                  </p>
                </div>
                <Link
                  href={`/owner/salon?id=${s.id}`}
                  className="btn-ghost ring-1 ring-[var(--border)]"
                >
                  Open
                </Link>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Pending appointment requests</h2>
        <div className="mt-4 space-y-3">
          {recent.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No pending requests.</p>
          ) : (
            recent.map((b) => (
              <div key={b.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{b.customer.name}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {b.service.name} · {b.barber.name} · {b.salon.name}
                    </p>
                    <p className="mt-1 text-sm">
                      {formatDisplayDate(b.appointmentDate)} ·{" "}
                      {formatDisplayTime(b.startTime)}
                    </p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={busyId === b.id}
                    onClick={() => respond(b.id, "accept")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn-danger text-sm"
                    disabled={busyId === b.id}
                    onClick={() => respond(b.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
