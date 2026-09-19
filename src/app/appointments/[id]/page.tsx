"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { LoadingBlock, StatusBadge } from "@/components/ui";
import { formatDisplayDate, formatDisplayTime } from "@/lib/utils";

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [booking, setBooking] = useState<{
    id: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    price: number;
    status: string;
    createdAt: string;
    salon: { name: string; address: string; city: string; contactNumber: string };
    barber: { name: string; specialization: string };
    service: { name: string; duration: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    (async () => {
      const res = await fetch(`/api/bookings?id=${id}`);
      const data = await res.json();
      if (res.ok) setBooking(data.booking);
      setLoading(false);
    })();
  }, [id, user, authLoading, router]);

  if (authLoading || loading) return <LoadingBlock />;
  if (!booking) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p>Booking not found.</p>
        <Link href="/appointments" className="btn-primary mt-4 inline-flex">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link href="/appointments" className="text-sm text-[var(--accent)]">
        ← Back to appointments
      </Link>
      <div className="card mt-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-2xl">Appointment details</h1>
          <StatusBadge status={booking.status} />
        </div>
        <dl className="mt-6 space-y-3 text-sm">
          {[
            ["Booking ID", booking.id],
            ["Salon", booking.salon.name],
            ["Address", `${booking.salon.address}, ${booking.salon.city}`],
            ["Contact", booking.salon.contactNumber],
            ["Service", `${booking.service.name} (${booking.service.duration} min)`],
            ["Barber", `${booking.barber.name} · ${booking.barber.specialization}`],
            ["Date", formatDisplayDate(booking.appointmentDate)],
            [
              "Time",
              `${formatDisplayTime(booking.startTime)} – ${formatDisplayTime(booking.endTime)}`,
            ],
            ["Price", `₹${booking.price}`],
            ["Booked on", new Date(booking.createdAt).toLocaleString()],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
              <dt className="text-[var(--muted)]">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
