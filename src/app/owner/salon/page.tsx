"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ImagePicker, MultiImagePicker } from "@/components/ImagePicker";
import { EmptyState, LoadingBlock, StatusBadge, TrustBadges } from "@/components/ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Salon = {
  id: string;
  name: string;
  description: string;
  logo: string | null;
  images: string[];
  address: string;
  city: string;
  contactNumber: string;
  openingTime: string;
  closingTime: string;
  workingDays: string[];
  category: string;
  listingStatus: string;
  rejectionReason: string | null;
  verificationStatus: string;
  verificationMessage: string | null;
  verificationRejectionReason: string | null;
  isVerified?: boolean;
  isPremium?: boolean;
  barbers: Barber[];
  services: Service[];
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
  workingDays: string[];
  workStartTime: string;
  workEndTime: string;
  breakStartTime: string | null;
  breakEndTime: string | null;
  status: string;
  services: { id: string; name: string }[];
};

type Service = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  status: string;
  barbers: { id: string; name: string }[];
};

const emptySalon = {
  name: "",
  description: "",
  logo: null as string | null,
  images: [] as string[],
  address: "",
  city: "",
  contactNumber: "",
  openingTime: "10:00",
  closingTime: "19:00",
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as string[],
  category: "Unisex",
};

function OwnerSalonInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredId = searchParams.get("id");

  const [salon, setSalon] = useState<Salon | null>(null);
  const [salonList, setSalonList] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"profile" | "staff" | "services">("profile");
  const [form, setForm] = useState(emptySalon);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showBarber, setShowBarber] = useState(false);
  const [editBarberId, setEditBarberId] = useState<string | null>(null);
  const [barberForm, setBarberForm] = useState({
    name: "",
    profilePhoto: "",
    bio: "",
    yearsExperience: 1,
    specialization: "",
    skills: "",
    rating: 4.5,
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as string[],
    workStartTime: "10:00",
    workEndTime: "19:00",
    breakStartTime: "",
    breakEndTime: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    serviceIds: [] as string[],
  });

  const [showService, setShowService] = useState(false);
  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    description: "",
    price: 200,
    duration: 30,
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    barberIds: [] as string[],
  });

  async function loadListAndSalon() {
    setLoading(true);
    const listRes = await fetch("/api/salons?owner=1");
    const listData = await listRes.json();
    const list = listData.salons || [];
    setSalonList(list.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));

    if (list.length === 0) {
      setSalon(null);
      setCreating(true);
      setForm(emptySalon);
      setLoading(false);
      return;
    }

    const targetId =
      preferredId && list.some((s: { id: string }) => s.id === preferredId)
        ? preferredId
        : list[0].id;

    const res = await fetch(`/api/salons?id=${targetId}&owner=1`);
    const data = await res.json();
    if (res.ok) {
      setSalon(data.salon);
      setCreating(false);
      setForm({
        name: data.salon.name,
        description: data.salon.description || "",
        logo: data.salon.logo || null,
        images: data.salon.images || [],
        address: data.salon.address,
        city: data.salon.city,
        contactNumber: data.salon.contactNumber,
        openingTime: data.salon.openingTime,
        closingTime: data.salon.closingTime,
        workingDays: data.salon.workingDays,
        category: data.salon.category,
      });
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
    loadListAndSalon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, preferredId, router]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const payload = {
      ...(salon ? { id: salon.id } : {}),
      ...form,
      logo: form.logo || null,
      images: form.images,
    };
    const res = await fetch("/api/salons", {
      method: salon ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setMessage(salon ? "Salon profile saved." : "Salon profile created.");
    if (!salon) router.replace(`/owner/salon?id=${data.salon.id}`);
    else await loadListAndSalon();
  }

  async function submitForApproval() {
    if (!salon) return;
    if (!confirm("Submit this salon for Super Admin approval?")) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/salons", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: salon.id, action: "submit" }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Submit failed");
      return;
    }
    setMessage(data.message || "Submitted for approval.");
    await loadListAndSalon();
  }

  async function requestVerification() {
    if (!salon) return;
    const note =
      prompt(
        "Optional note for Super Admin (why your salon should be verified):"
      ) || "";
    setSaving(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/salons", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: salon.id,
        action: "request-verification",
        message: note,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Request failed");
      return;
    }
    setMessage(data.message || "Verification request sent.");
    await loadListAndSalon();
  }

  async function saveBarber(e: FormEvent) {
    e.preventDefault();
    if (!salon) return;
    setSaving(true);
    setError("");
    const payload = {
      salonId: salon.id,
      ...barberForm,
      profilePhoto: barberForm.profilePhoto || null,
      skills: barberForm.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      yearsExperience: Number(barberForm.yearsExperience),
      rating: Number(barberForm.rating),
      breakStartTime: barberForm.breakStartTime || null,
      breakEndTime: barberForm.breakEndTime || null,
      ...(editBarberId ? { id: editBarberId } : {}),
    };
    const res = await fetch("/api/barbers", {
      method: editBarberId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Failed to save staff");
      return;
    }
    setShowBarber(false);
    await loadListAndSalon();
  }

  async function saveService(e: FormEvent) {
    e.preventDefault();
    if (!salon) return;
    setSaving(true);
    setError("");
    const payload = {
      salonId: salon.id,
      ...serviceForm,
      price: Number(serviceForm.price),
      duration: Number(serviceForm.duration),
      ...(editServiceId ? { id: editServiceId } : {}),
    };
    const res = await fetch("/api/services", {
      method: editServiceId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Failed to save service");
      return;
    }
    setShowService(false);
    await loadListAndSalon();
  }

  if (authLoading || loading) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/owner" className="text-sm text-[var(--accent)]">
            ← Dashboard
          </Link>
          <h1 className="mt-2 font-display text-3xl">
            {creating || !salon ? "Create salon profile" : salon.name}
          </h1>
          {salon && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={salon.listingStatus} />
              <TrustBadges
                verified={salon.isVerified || salon.verificationStatus === "VERIFIED"}
                premium={salon.isPremium}
                size="md"
              />
              {salon.verificationStatus === "PENDING" && (
                <StatusBadge status="PENDING" />
              )}
              {salon.rejectionReason && (
                <span className="text-sm text-rose-700">
                  {salon.rejectionReason}
                </span>
              )}
              {salon.verificationRejectionReason &&
                salon.verificationStatus === "REJECTED" && (
                  <span className="text-sm text-rose-700">
                    Verification: {salon.verificationRejectionReason}
                  </span>
                )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {salonList.length > 0 && (
            <select
              className="input w-auto"
              value={salon?.id || ""}
              onChange={(e) => router.push(`/owner/salon?id=${e.target.value}`)}
            >
              {salonList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {salon && (
            <button
              type="button"
              className="btn-ghost ring-1 ring-[var(--border)]"
              onClick={() => {
                setCreating(true);
                setSalon(null);
                setForm(emptySalon);
              }}
            >
              New salon
            </button>
          )}
          {salon &&
            (salon.listingStatus === "DRAFT" ||
              salon.listingStatus === "REJECTED") && (
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={submitForApproval}
              >
                Submit for approval
              </button>
            )}
          {salon &&
            salon.listingStatus === "APPROVED" &&
            salon.verificationStatus !== "VERIFIED" &&
            salon.verificationStatus !== "PENDING" && (
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={requestVerification}
              >
                Request Verified badge
              </button>
            )}
        </div>
      </div>

      {salon &&
        !creating &&
        salon.listingStatus === "APPROVED" &&
        salon.verificationStatus === "PENDING" && (
          <div className="card mt-4 border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
            Your Verified badge request is under Super Admin review
            {salon.verificationMessage
              ? `: “${salon.verificationMessage}”`
              : "."}
          </div>
        )}

      {salon && !creating && (
        <div className="mt-6 flex gap-2 rounded-xl bg-[var(--surface)] p-1 ring-1 ring-[var(--border)] w-fit">
          {(
            [
              ["profile", "Profile"],
              ["staff", "Staff"],
              ["services", "Services"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab === key
                  ? "bg-[var(--ink)] text-[var(--cream)]"
                  : "text-[var(--muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {(creating || !salon || tab === "profile") && (
        <form onSubmit={saveProfile} className="card mt-6 grid gap-4 p-6 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm text-[var(--muted)]">
            Complete your salon details, add staff and services, then submit for
            Super Admin approval. Customers only see approved salons.
          </p>
          {(
            [
              ["name", "Salon name"],
              ["category", "Category"],
              ["address", "Address"],
              ["city", "City"],
              ["contactNumber", "Contact number"],
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
            <label className="label">Description</label>
            <textarea
              className="input min-h-[90px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Tell customers about your salon…"
            />
          </div>
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
          <div className="sm:col-span-2">
            <label className="label">Working days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <label key={d} className="inline-flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={form.workingDays.includes(d)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        workingDays: e.target.checked
                          ? [...form.workingDays, d]
                          : form.workingDays.filter((x) => x !== d),
                      })
                    }
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
          {message && (
            <p className="sm:col-span-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          )}
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : salon && !creating ? "Save profile" : "Create salon"}
            </button>
          </div>
        </form>
      )}

      {salon && !creating && tab === "staff" && (
        <section className="mt-6">
          <div className="flex justify-between gap-3">
            <h2 className="font-display text-2xl">Staff / employees</h2>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditBarberId(null);
                setBarberForm({
                  name: "",
                  profilePhoto: "",
                  bio: "",
                  yearsExperience: 1,
                  specialization: "",
                  skills: "",
                  rating: 4.5,
                  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                  workStartTime: "10:00",
                  workEndTime: "19:00",
                  breakStartTime: "",
                  breakEndTime: "",
                  status: "ACTIVE",
                  serviceIds: [],
                });
                setShowBarber(true);
              }}
            >
              Add staff
            </button>
          </div>

          {showBarber && (
            <form
              onSubmit={saveBarber}
              className="card mt-4 grid gap-3 p-5 sm:grid-cols-2"
            >
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  required
                  value={barberForm.name}
                  onChange={(e) =>
                    setBarberForm({ ...barberForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Specialization</label>
                <input
                  className="input"
                  required
                  value={barberForm.specialization}
                  onChange={(e) =>
                    setBarberForm({
                      ...barberForm,
                      specialization: e.target.value,
                    })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Bio</label>
                <textarea
                  className="input"
                  value={barberForm.bio}
                  onChange={(e) =>
                    setBarberForm({ ...barberForm, bio: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Skills (comma separated)</label>
                <input
                  className="input"
                  value={barberForm.skills}
                  onChange={(e) =>
                    setBarberForm({ ...barberForm, skills: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <ImagePicker
                  label="Staff photo"
                  value={barberForm.profilePhoto || null}
                  onChange={(profilePhoto) =>
                    setBarberForm({ ...barberForm, profilePhoto: profilePhoto || "" })
                  }
                  hint="Pick a photo from your gallery"
                />
              </div>
              <div>
                <label className="label">Years experience</label>
                <input
                  type="number"
                  className="input"
                  value={barberForm.yearsExperience}
                  onChange={(e) =>
                    setBarberForm({
                      ...barberForm,
                      yearsExperience: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="label">Work hours</label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    className="input"
                    value={barberForm.workStartTime}
                    onChange={(e) =>
                      setBarberForm({
                        ...barberForm,
                        workStartTime: e.target.value,
                      })
                    }
                  />
                  <input
                    type="time"
                    className="input"
                    value={barberForm.workEndTime}
                    onChange={(e) =>
                      setBarberForm({
                        ...barberForm,
                        workEndTime: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Working days</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <label key={d} className="inline-flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={barberForm.workingDays.includes(d)}
                        onChange={(e) =>
                          setBarberForm({
                            ...barberForm,
                            workingDays: e.target.checked
                              ? [...barberForm.workingDays, d]
                              : barberForm.workingDays.filter((x) => x !== d),
                          })
                        }
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Services they provide</label>
                <div className="flex flex-wrap gap-3">
                  {salon.services.map((s) => (
                    <label key={s.id} className="inline-flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={barberForm.serviceIds.includes(s.id)}
                        onChange={(e) =>
                          setBarberForm({
                            ...barberForm,
                            serviceIds: e.target.checked
                              ? [...barberForm.serviceIds, s.id]
                              : barberForm.serviceIds.filter((x) => x !== s.id),
                          })
                        }
                      />
                      {s.name}
                    </label>
                  ))}
                  {salon.services.length === 0 && (
                    <span className="text-sm text-[var(--muted)]">
                      Add services first, then assign them here.
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" className="btn-primary" disabled={saving}>
                  Save staff
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowBarber(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {salon.barbers.length === 0 ? (
              <EmptyState
                title="No staff yet"
                description="Add barbers or stylists who work at your salon."
              />
            ) : (
              salon.barbers.map((b) => (
                <div key={b.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-sm text-[var(--accent)]">
                        {b.specialization}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {b.yearsExperience} yrs · {b.workStartTime}–{b.workEndTime}
                      </p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost ring-1 ring-[var(--border)] text-sm"
                      onClick={() => {
                        setEditBarberId(b.id);
                        setBarberForm({
                          name: b.name,
                          profilePhoto: b.profilePhoto || "",
                          bio: b.bio,
                          yearsExperience: b.yearsExperience,
                          specialization: b.specialization,
                          skills: b.skills.join(", "),
                          rating: b.rating,
                          workingDays: b.workingDays,
                          workStartTime: b.workStartTime,
                          workEndTime: b.workEndTime,
                          breakStartTime: b.breakStartTime || "",
                          breakEndTime: b.breakEndTime || "",
                          status: b.status as "ACTIVE" | "INACTIVE",
                          serviceIds: b.services.map((s) => s.id),
                        });
                        setShowBarber(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger text-sm"
                      onClick={async () => {
                        if (!confirm("Delete this staff member?")) return;
                        await fetch(`/api/barbers?id=${b.id}`, { method: "DELETE" });
                        await loadListAndSalon();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {salon && !creating && tab === "services" && (
        <section className="mt-6">
          <div className="flex justify-between gap-3">
            <h2 className="font-display text-2xl">Services</h2>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditServiceId(null);
                setServiceForm({
                  name: "",
                  description: "",
                  price: 200,
                  duration: 30,
                  status: "ACTIVE",
                  barberIds: [],
                });
                setShowService(true);
              }}
            >
              Add service
            </button>
          </div>

          {showService && (
            <form
              onSubmit={saveService}
              className="card mt-4 grid gap-3 p-5 sm:grid-cols-2"
            >
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  required
                  value={serviceForm.name}
                  onChange={(e) =>
                    setServiceForm({ ...serviceForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Price (₹)</label>
                <input
                  type="number"
                  className="input"
                  value={serviceForm.price}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      price: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Description</label>
                <textarea
                  className="input"
                  value={serviceForm.description}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="label">Duration (minutes)</label>
                <input
                  type="number"
                  className="input"
                  value={serviceForm.duration}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      duration: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Assigned staff</label>
                <div className="flex flex-wrap gap-3">
                  {salon.barbers.map((b) => (
                    <label key={b.id} className="inline-flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={serviceForm.barberIds.includes(b.id)}
                        onChange={(e) =>
                          setServiceForm({
                            ...serviceForm,
                            barberIds: e.target.checked
                              ? [...serviceForm.barberIds, b.id]
                              : serviceForm.barberIds.filter((x) => x !== b.id),
                          })
                        }
                      />
                      {b.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" className="btn-primary" disabled={saving}>
                  Save service
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowService(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 space-y-3">
            {salon.services.length === 0 ? (
              <EmptyState title="No services yet" />
            ) : (
              salon.services.map((s) => (
                <div
                  key={s.id}
                  className="card flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-medium">
                      {s.name} · ₹{s.price} · {s.duration}m
                    </p>
                    <p className="text-sm text-[var(--muted)]">{s.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost ring-1 ring-[var(--border)] text-sm"
                      onClick={() => {
                        setEditServiceId(s.id);
                        setServiceForm({
                          name: s.name,
                          description: s.description,
                          price: s.price,
                          duration: s.duration,
                          status: s.status as "ACTIVE" | "INACTIVE",
                          barberIds: s.barbers.map((b) => b.id),
                        });
                        setShowService(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger text-sm"
                      onClick={async () => {
                        if (!confirm("Delete this service?")) return;
                        await fetch(`/api/services?id=${s.id}`, { method: "DELETE" });
                        await loadListAndSalon();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default function OwnerSalonPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <OwnerSalonInner />
    </Suspense>
  );
}
