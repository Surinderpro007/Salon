"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPin, Search, Star } from "lucide-react";
import { EmptyState, LoadingBlock, StatusBadge, TrustBadges } from "@/components/ui";
import { formatDisplayTime } from "@/lib/utils";

type SalonCard = {
  id: string;
  name: string;
  logo: string | null;
  city: string;
  address: string;
  rating: number;
  category: string;
  isOpen: boolean;
  isVerified?: boolean;
  isPremium?: boolean;
  startingPrice: number | null;
  availableServices: string[];
  openingTime: string;
  closingTime: string;
};

export default function SalonsPage() {
  const [salons, setSalons] = useState<SalonCard[]>([]);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (city) params.set("city", city);
      if (category) params.set("category", category);
      const res = await fetch(`/api/salons?${params}`);
      const data = await res.json();
      setSalons(data.salons || []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, city, category]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl">Find a salon</h1>
        <p className="mt-2 text-[var(--muted)]">
          Search by name, city, or category.
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            className="input pl-10"
            placeholder="Search salons…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <input
          className="input"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <select
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          <option value="Unisex">Unisex</option>
          <option value="Men">Men</option>
          <option value="Women">Women</option>
        </select>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : salons.length === 0 ? (
        <EmptyState
          title="No salons found"
          description="Try a different search or city."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {salons.map((salon) => (
            <Link
              key={salon.id}
              href={`/salons/${salon.id}`}
              className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className="aspect-[16/10] bg-stone-200"
                style={{
                  backgroundImage: `url(${salon.logo || "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&h=400&fit=crop"})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-display text-xl group-hover:text-[var(--accent)]">
                      {salon.name}
                    </h2>
                    <div className="mt-1.5">
                      <TrustBadges
                        verified={salon.isVerified}
                        premium={salon.isPremium}
                      />
                    </div>
                  </div>
                  <StatusBadge open={salon.isOpen} />
                </div>
                <p className="mt-1 flex items-center gap-1 text-sm text-[var(--muted)]">
                  <MapPin className="h-3.5 w-3.5" />
                  {salon.city}
                </p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1 text-[var(--gold)]">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {salon.rating.toFixed(1)}
                  </span>
                  <span className="font-medium">
                    {salon.startingPrice != null
                      ? `From ₹${salon.startingPrice}`
                      : "View services"}
                  </span>
                </div>
                {salon.availableServices.length > 0 && (
                  <p className="mt-2 truncate text-xs text-[var(--muted)]">
                    {salon.availableServices.slice(0, 3).join(" · ")}
                  </p>
                )}
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {formatDisplayTime(salon.openingTime)} –{" "}
                  {formatDisplayTime(salon.closingTime)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
