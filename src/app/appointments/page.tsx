"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
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
  review: { id: string; rating: number; comment: string } | null;
};

function ReviewForm({
  bookingId,
  onDone,
}: {
  bookingId: string;
  onDone: (review: { id: string; rating: number; comment: string }) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (rating < 1) {
      setError("Please select a star rating");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, rating, comment }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || "Could not submit review");
      return;
    }
    onDone(data.review);
  }

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-sm font-medium">Rate your experience</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${n} star`}
          >
            <Star
              className={`h-6 w-6 ${
                n <= (hoverRating || rating)
                  ? "fill-current text-[var(--accent)]"
                  : "text-stone-300"
              }`}
            />
          </button>
        ))}
      </div>
      <textarea
        className="input mt-3 w-full"
        rows={3}
        placeholder="Share a few words about your visit (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <button
        type="button"
        className="btn-primary mt-3"
        disabled={submitting}
        onClick={submit}
      >
        {submitting ? "Submitting…" : "Submit review"}
      </button>
    </div>
  );
}

export default function AppointmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [history, setHistory] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [u, h] = await Promise.all([
      fetch("/api/bookings?scope=upcoming").then((r) => r.json()),
      fetch("/api/bookings?scope=history").then((r) => r.json()),
    ]);
    setUpcoming(u.bookings || []);
    setHistory(h.bookings || []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    load();
  }, [user, authLoading, router]);

  async function cancel(id: string) {
    if (!confirm("Cancel this appointment?")) return;
    setBusyId(id);
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "cancel" }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      alert(data.error || "Could not cancel");
      return;
    }
    await load();
  }

  if (authLoading || loading) return <LoadingBlock />;

  const list = tab === "upcoming" ? upcoming : history;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl">My appointments</h1>
      <p className="mt-2 text-[var(--muted)]">
        Pending requests await salon confirmation. Confirmed ones are ready to visit.
      </p>

      <div className="mt-6 flex gap-2 rounded-xl bg-[var(--surface)] p-1 ring-1 ring-[var(--border)]">
        {(
          [
            ["upcoming", "Upcoming"],
            ["history", "History"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === key
                ? "bg-[var(--ink)] text-[var(--cream)]"
                : "text-[var(--muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {list.length === 0 ? (
          <EmptyState
            title={
              tab === "upcoming"
                ? "No upcoming appointments"
                : "No appointment history"
            }
            description={
              tab === "upcoming"
                ? "Browse salons and book your next visit."
                : undefined
            }
          />
        ) : (
          list.map((b) => (
            <div key={b.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl">{b.salon.name}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {b.service.name} · with {b.barber.name}
                  </p>
                  <p className="mt-2 text-sm">
                    {formatDisplayDate(b.appointmentDate)} ·{" "}
                    {formatDisplayTime(b.startTime)} –{" "}
                    {formatDisplayTime(b.endTime)}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                    ₹{b.price}
                    <span
                      className={
                        b.paymentStatus === "PAID"
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
                          : "rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 ring-1 ring-stone-200"
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
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/appointments/${b.id}`}
                  className="btn-ghost ring-1 ring-[var(--border)]"
                >
                  View details
                </Link>
                {tab === "upcoming" &&
                  (b.status === "CONFIRMED" || b.status === "PENDING") && (
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={busyId === b.id}
                      onClick={() => cancel(b.id)}
                    >
                      {busyId === b.id ? "Cancelling…" : "Cancel appointment"}
                    </button>
                  )}
                {tab === "history" && b.status === "COMPLETED" && !b.review && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() =>
                      setReviewingId(reviewingId === b.id ? null : b.id)
                    }
                  >
                    {reviewingId === b.id ? "Cancel review" : "Rate & review"}
                  </button>
                )}
              </div>

              {tab === "history" && b.status === "COMPLETED" && b.review && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-4 w-4 ${
                          n <= b.review!.rating
                            ? "fill-current text-[var(--accent)]"
                            : "text-stone-300"
                        }`}
                      />
                    ))}
                  </div>
                  {b.review.comment && (
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      &ldquo;{b.review.comment}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {tab === "history" && reviewingId === b.id && !b.review && (
                <ReviewForm
                  bookingId={b.id}
                  onDone={(review) => {
                    setHistory((prev) =>
                      prev.map((item) =>
                        item.id === b.id ? { ...item, review } : item
                      )
                    );
                    setReviewingId(null);
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>

      {tab === "upcoming" && (
        <div className="mt-8 text-center">
          <Link href="/salons" className="btn-primary">
            Book another appointment
          </Link>
        </div>
      )}
    </div>
  );
}