import Link from "next/link";
import { ArrowRight, CalendarCheck, MapPin, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:items-center md:py-20">
          <div className="animate-fade-up">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              TrimBook
            </p>
            <h1 className="font-display text-4xl leading-tight text-[var(--ink)] sm:text-5xl md:text-6xl">
              Book your next cut with confidence
            </h1>
            <p className="mt-4 max-w-md text-lg text-[var(--muted)]">
              Discover approved salons, request your preferred barber and slot, and get
            confirmed by the salon — no double bookings, no guesswork.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/salons" className="btn-primary">
                Find salons <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/register" className="btn-secondary">
                Join as customer or owner
              </Link>
            </div>
          </div>

          <div className="relative animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <div
              className="aspect-[4/5] overflow-hidden rounded-[2rem] bg-stone-200 shadow-xl md:aspect-[5/4]"
              style={{
                backgroundImage:
                  "url(https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1000&h=800&fit=crop)",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/95 p-4 shadow-lg backdrop-blur sm:left-auto sm:right-6 sm:w-64">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                Next available
              </p>
              <p className="mt-1 font-display text-lg">Today · 5:00 PM</p>
              <p className="text-sm text-[var(--muted)]">Royal Hair Salon · Rahul</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--surface)]/60 py-14">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-3">
          {[
            {
              icon: MapPin,
              title: "Search nearby",
              text: "Browse registered salons by city and category.",
            },
            {
              icon: CalendarCheck,
              title: "Live slots",
              text: "Slots respect barber hours, breaks, and existing bookings.",
            },
            {
              icon: ShieldCheck,
              title: "No double booking",
              text: "Database-enforced unique slots keep appointments exclusive.",
            },
          ].map((f) => (
            <div key={f.title} className="card p-6">
              <f.icon className="h-6 w-6 text-[var(--accent)]" />
              <h3 className="mt-4 font-display text-xl">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
