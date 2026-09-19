"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Calendar,
  Scissors,
  Store,
  Users,
  XCircle,
  CheckCircle2,
  Clock,
  Inbox,
  BadgeCheck,
  Crown,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { LoadingBlock, StatusBadge } from "@/components/ui";
import { formatDisplayDate, formatDisplayTime } from "@/lib/utils";

type Stats = {
  totalSalons: number;
  activeSalons: number;
  pendingApprovals: number;
  totalCustomers: number;
  totalOwners: number;
  totalBarbers: number;
  totalServices: number;
  todayBookings: number;
  upcomingBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  pendingVerifications: number;
  verifiedSalons: number;
  premiumSalons: number;
};

export default function AdminDashboard() {
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
      customer: { name: string };
    }[]
  >([]);
  const [pendingSalons, setPendingSalons] = useState<
    {
      id: string;
      name: string;
      city: string;
      owner: { name: string; email: string } | null;
      submittedAt: string | null;
    }[]
  >([]);
  const [pendingVerifications, setPendingVerifications] = useState<
    {
      id: string;
      name: string;
      city: string;
      verificationMessage: string | null;
      owner: { name: string; email: string } | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/dashboard");
    const data = await res.json();
    if (res.ok) {
      setStats(data.stats);
      setRecent(data.recentBookings || []);
      setPendingSalons(data.pendingSalons || []);
      setPendingVerifications(data.pendingVerificationSalons || []);
    }
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
    load();
  }, [user, authLoading, router]);

  async function review(id: string, action: "approve" | "reject") {
    const rejectionReason =
      action === "reject"
        ? prompt("Optional rejection reason:") || "Does not meet listing guidelines"
        : undefined;
    setBusyId(id);
    await fetch("/api/salons", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, rejectionReason }),
    });
    setBusyId(null);
    await load();
  }

  async function reviewVerification(
    id: string,
    action: "approve-verification" | "reject-verification"
  ) {
    const rejectionReason =
      action === "reject-verification"
        ? prompt("Optional rejection reason:") ||
          "Verification request was not approved"
        : undefined;
    setBusyId(id);
    await fetch("/api/salons", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, rejectionReason }),
    });
    setBusyId(null);
    await load();
  }

  if (authLoading || loading || !stats) return <LoadingBlock />;

  const cards = [
    { label: "Total salons", value: stats.totalSalons, icon: Store },
    { label: "Live listings", value: stats.activeSalons, icon: CheckCircle2 },
    { label: "Pending listings", value: stats.pendingApprovals, icon: Inbox },
    {
      label: "Pending verified",
      value: stats.pendingVerifications,
      icon: BadgeCheck,
    },
    { label: "Verified salons", value: stats.verifiedSalons, icon: BadgeCheck },
    { label: "Premium salons", value: stats.premiumSalons, icon: Crown },
    { label: "Customers", value: stats.totalCustomers, icon: Users },
    { label: "Pending bookings", value: stats.pendingBookings, icon: Clock },
    { label: "Today's bookings", value: stats.todayBookings, icon: Calendar },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Admin dashboard</h1>
          <p className="mt-2 text-[var(--muted)]">
            Approve salon listings and monitor the platform.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/salons" className="btn-primary">
            Manage salons
          </Link>
          <Link href="/admin/bookings" className="btn-secondary">
            All bookings
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
        <h2 className="font-display text-2xl">Listing requests</h2>
        <div className="mt-4 space-y-3">
          {pendingSalons.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No pending salon requests.</p>
          ) : (
            pendingSalons.map((s) => (
              <div
                key={s.id}
                className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-display text-xl">{s.name}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {s.city}
                    {s.owner
                      ? ` · Owner: ${s.owner.name} (${s.owner.email})`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/salons/${s.id}`}
                    className="btn-ghost ring-1 ring-[var(--border)] text-sm"
                  >
                    Review
                  </Link>
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={busyId === s.id}
                    onClick={() => review(s.id, "approve")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn-danger text-sm"
                    disabled={busyId === s.id}
                    onClick={() => review(s.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Verified badge requests</h2>
        <div className="mt-4 space-y-3">
          {pendingVerifications.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No pending verification requests.
            </p>
          ) : (
            pendingVerifications.map((s) => (
              <div
                key={s.id}
                className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-display text-xl">{s.name}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {s.city}
                    {s.owner
                      ? ` · Owner: ${s.owner.name} (${s.owner.email})`
                      : ""}
                  </p>
                  {s.verificationMessage && (
                    <p className="mt-1 text-sm text-amber-800">
                      Note: {s.verificationMessage}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/salons?verificationStatus=PENDING`}
                    className="btn-ghost ring-1 ring-[var(--border)] text-sm"
                  >
                    Open list
                  </Link>
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={busyId === s.id}
                    onClick={() => reviewVerification(s.id, "approve-verification")}
                  >
                    Grant Verified
                  </button>
                  <button
                    type="button"
                    className="btn-danger text-sm"
                    disabled={busyId === s.id}
                    onClick={() => reviewVerification(s.id, "reject-verification")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Recent bookings</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Salon</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((b) => (
                <tr key={b.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">{b.customer.name}</td>
                  <td className="px-4 py-3">{b.salon.name}</td>
                  <td className="px-4 py-3">
                    {b.service.name}
                    <span className="block text-xs text-[var(--muted)]">
                      {b.barber.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {formatDisplayDate(b.appointmentDate)}
                    <span className="block text-xs text-[var(--muted)]">
                      {formatDisplayTime(b.startTime)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                    No bookings yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
