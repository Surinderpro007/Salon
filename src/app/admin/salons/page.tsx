"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ImagePicker, MultiImagePicker } from "@/components/ImagePicker";
import { EmptyState, LoadingBlock, StatusBadge, TrustBadges } from "@/components/ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Salon = {
  id: string;
  name: string;
  city: string;
  address: string;
  contactNumber: string;
  status: string;
  listingStatus: string;
  verificationStatus?: string;
  isVerified?: boolean;
  isPremium?: boolean;
  verificationMessage?: string | null;
  rating: number;
  category: string;
  openingTime: string;
  closingTime: string;
  owner?: { name: string; email: string } | null;
  _count?: { barbers: number; services: number };
};

const emptyForm = {
  name: "",
  logo: "" as string | null,
  images: [] as string[],
  address: "",
  city: "",
  contactNumber: "",
  openingTime: "10:00",
  closingTime: "19:00",
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as string[],
  category: "Unisex",
  status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  rating: 4.5,
};

export default function AdminSalonsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [listingFilter, setListingFilter] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ admin: "1" });
    if (q) params.set("q", q);
    if (statusFilter) params.set("status", statusFilter);
    if (listingFilter) params.set("listingStatus", listingFilter);
    if (verificationFilter) params.set("verificationStatus", verificationFilter);
    const res = await fetch(`/api/salons?${params}`);
    const data = await res.json();
    setSalons(data.salons || []);
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
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, q, statusFilter, listingFilter, verificationFilter, router]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError("");
  }

  async function openEdit(id: string) {
    const res = await fetch(`/api/salons?id=${id}&admin=1`);
    const data = await res.json();
    if (!res.ok) return;
    const s = data.salon;
    setEditingId(id);
    setForm({
      name: s.name,
      logo: s.logo || null,
      images: s.images || [],
      address: s.address,
      city: s.city,
      contactNumber: s.contactNumber,
      openingTime: s.openingTime,
      closingTime: s.closingTime,
      workingDays: s.workingDays,
      category: s.category,
      status: s.status,
      rating: s.rating,
    });
    setShowForm(true);
    setError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      logo: form.logo || null,
      images: form.images,
      rating: Number(form.rating),
      ...(editingId ? { id: editingId } : {}),
    };
    const res = await fetch("/api/salons", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setShowForm(false);
    await load();
  }

  async function toggleStatus(salon: Salon) {
    await fetch("/api/salons", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: salon.id,
        status: salon.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      }),
    });
    await load();
  }

  async function reviewListing(id: string, action: "approve" | "reject") {
    const rejectionReason =
      action === "reject"
        ? prompt("Optional rejection reason:") || "Does not meet listing guidelines"
        : undefined;
    await fetch("/api/salons", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, rejectionReason }),
    });
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
    await fetch("/api/salons", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, rejectionReason }),
    });
    await load();
  }

  async function setBadge(
    id: string,
    action: "set-verified" | "revoke-verified" | "set-premium",
    isPremium?: boolean
  ) {
    await fetch("/api/salons", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, isPremium }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this salon and all related data?")) return;
    await fetch(`/api/salons?id=${id}`, { method: "DELETE" });
    await load();
  }

  if (authLoading) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Salons</h1>
          <p className="mt-1 text-[var(--muted)]">
            Register and manage salon locations.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          Add salon
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input max-w-[180px]"
          value={listingFilter}
          onChange={(e) => setListingFilter(e.target.value)}
        >
          <option value="">All listing status</option>
          <option value="PENDING_APPROVAL">Pending approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="DRAFT">Draft</option>
        </select>
        <select
          className="input max-w-[180px]"
          value={verificationFilter}
          onChange={(e) => setVerificationFilter(e.target.value)}
        >
          <option value="">All verification</option>
          <option value="PENDING">Pending verified</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Verification rejected</option>
          <option value="NONE">Not requested</option>
        </select>
        <select
          className="input max-w-[160px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All operational</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="card mt-6 grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="font-display text-xl sm:col-span-2">
            {editingId ? "Edit salon" : "New salon"}
          </h2>
          {(
            [
              ["name", "Salon name"],
              ["address", "Address"],
              ["city", "City"],
              ["contactNumber", "Contact number"],
              ["category", "Category"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="input"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required={["name", "address", "city", "contactNumber"].includes(key)}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <ImagePicker
              label="Salon logo"
              value={form.logo}
              onChange={(logo) => setForm({ ...form, logo })}
              hint="Pick a logo from your gallery"
            />
          </div>
          <div className="sm:col-span-2">
            <MultiImagePicker
              label="Salon photos"
              values={form.images}
              onChange={(images) => setForm({ ...form, images })}
            />
          </div>
          <div>
            <label className="label">Opening time</label>
            <input
              type="time"
              className="input"
              value={form.openingTime}
              onChange={(e) => setForm({ ...form, openingTime: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Closing time</label>
            <input
              type="time"
              className="input"
              value={form.closingTime}
              onChange={(e) => setForm({ ...form, closingTime: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Rating</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              className="input"
              value={form.rating}
              onChange={(e) =>
                setForm({ ...form, rating: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as "ACTIVE" | "INACTIVE",
                })
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Working days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <label key={d} className="inline-flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={form.workingDays.includes(d)}
                    onChange={(e) => {
                      setForm({
                        ...form,
                        workingDays: e.target.checked
                          ? [...form.workingDays, d]
                          : form.workingDays.filter((x) => x !== d),
                      });
                    }}
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>
          {error && (
            <p className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save salon"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-8 space-y-3">
        {loading ? (
          <LoadingBlock />
        ) : salons.length === 0 ? (
          <EmptyState title="No salons yet" description="Add your first salon." />
        ) : (
          salons.map((s) => (
            <div
              key={s.id}
              className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-xl">{s.name}</h3>
                  <StatusBadge status={s.listingStatus} />
                  <StatusBadge status={s.status} />
                  <TrustBadges
                    verified={s.isVerified || s.verificationStatus === "VERIFIED"}
                    premium={s.isPremium}
                  />
                  {s.verificationStatus === "PENDING" && (
                    <StatusBadge status="PENDING" />
                  )}
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {s.address}, {s.city} · {s.contactNumber}
                </p>
                {s.owner && (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Owner: {s.owner.name} ({s.owner.email})
                  </p>
                )}
                {s.verificationStatus === "PENDING" && s.verificationMessage && (
                  <p className="mt-1 text-xs text-amber-800">
                    Verification note: {s.verificationMessage}
                  </p>
                )}
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {s._count?.barbers ?? 0} barbers · {s._count?.services ?? 0}{" "}
                  services · ★ {s.rating}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/salons/${s.id}`} className="btn-primary text-sm">
                  Manage
                </Link>
                {s.listingStatus === "PENDING_APPROVAL" && (
                  <>
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      onClick={() => reviewListing(s.id, "approve")}
                    >
                      Accept listing
                    </button>
                    <button
                      type="button"
                      className="btn-danger text-sm"
                      onClick={() => reviewListing(s.id, "reject")}
                    >
                      Reject listing
                    </button>
                  </>
                )}
                {s.verificationStatus === "PENDING" && (
                  <>
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      onClick={() =>
                        reviewVerification(s.id, "approve-verification")
                      }
                    >
                      Grant Verified
                    </button>
                    <button
                      type="button"
                      className="btn-danger text-sm"
                      onClick={() =>
                        reviewVerification(s.id, "reject-verification")
                      }
                    >
                      Reject Verified
                    </button>
                  </>
                )}
                {s.verificationStatus !== "VERIFIED" &&
                  s.verificationStatus !== "PENDING" && (
                    <button
                      type="button"
                      className="btn-ghost ring-1 ring-[var(--border)] text-sm"
                      onClick={() => setBadge(s.id, "set-verified")}
                    >
                      Make Verified
                    </button>
                  )}
                {s.verificationStatus === "VERIFIED" && (
                  <button
                    type="button"
                    className="btn-ghost ring-1 ring-[var(--border)] text-sm"
                    onClick={() => setBadge(s.id, "revoke-verified")}
                  >
                    Revoke Verified
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost ring-1 ring-[var(--border)] text-sm"
                  onClick={() =>
                    setBadge(s.id, "set-premium", !s.isPremium)
                  }
                >
                  {s.isPremium ? "Remove Premium" : "Make Premium"}
                </button>
                <button
                  type="button"
                  className="btn-ghost ring-1 ring-[var(--border)] text-sm"
                  onClick={() => openEdit(s.id)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost ring-1 ring-[var(--border)] text-sm"
                  onClick={() => toggleStatus(s)}
                >
                  {s.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  className="btn-danger text-sm"
                  onClick={() => remove(s.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
