"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ImagePicker } from "@/components/ImagePicker";
import { LoadingBlock, StatusBadge } from "@/components/ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Service = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  status: string;
  barbers: { id: string; name: string }[];
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

type Salon = {
  id: string;
  name: string;
  city: string;
  status: string;
  services: Service[];
  barbers: Barber[];
};

export default function AdminSalonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"barbers" | "services">("barbers");

  // Barber form
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

  // Service form
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

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/salons?id=${id}&admin=1`);
    const data = await res.json();
    if (res.ok) setSalon(data.salon);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, authLoading, router]);

  function openNewBarber() {
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
    setError("");
  }

  function openEditBarber(b: Barber) {
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
    setError("");
  }

  async function saveBarber(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      salonId: id,
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
      setError(data.error || "Failed to save barber");
      return;
    }
    setShowBarber(false);
    await load();
  }

  async function deleteBarber(barberId: string) {
    if (!confirm("Delete this barber?")) return;
    await fetch(`/api/barbers?id=${barberId}`, { method: "DELETE" });
    await load();
  }

  function openNewService() {
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
    setError("");
  }

  function openEditService(s: Service) {
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
    setError("");
  }

  async function saveService(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      salonId: id,
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
    await load();
  }

  async function deleteService(serviceId: string) {
    if (!confirm("Delete this service?")) return;
    await fetch(`/api/services?id=${serviceId}`, { method: "DELETE" });
    await load();
  }

  if (authLoading || loading) return <LoadingBlock />;
  if (!salon) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p>Salon not found</p>
        <Link href="/admin/salons" className="btn-primary mt-4 inline-flex">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/admin/salons" className="text-sm text-[var(--accent)]">
        ← All salons
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl">{salon.name}</h1>
        <StatusBadge status={salon.status} />
        <span className="text-sm text-[var(--muted)]">{salon.city}</span>
      </div>

      <div className="mt-6 flex gap-2 rounded-xl bg-[var(--surface)] p-1 ring-1 ring-[var(--border)] w-fit">
        {(
          [
            ["barbers", "Barbers / Staff"],
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

      {tab === "barbers" && (
        <section className="mt-6">
          <div className="flex justify-between gap-3">
            <h2 className="font-display text-2xl">Barbers</h2>
            <button type="button" className="btn-primary" onClick={openNewBarber}>
              Add barber
            </button>
          </div>

          {showBarber && (
            <form
              onSubmit={saveBarber}
              className="card mt-4 grid gap-3 p-5 sm:grid-cols-2"
            >
              <h3 className="font-medium sm:col-span-2">
                {editBarberId ? "Edit barber" : "New barber"}
              </h3>
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
                <label className="label">Rating</label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={barberForm.rating}
                  onChange={(e) =>
                    setBarberForm({
                      ...barberForm,
                      rating: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="label">Work start</label>
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
              </div>
              <div>
                <label className="label">Work end</label>
                <input
                  type="time"
                  className="input"
                  value={barberForm.workEndTime}
                  onChange={(e) =>
                    setBarberForm({ ...barberForm, workEndTime: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Break start</label>
                <input
                  type="time"
                  className="input"
                  value={barberForm.breakStartTime}
                  onChange={(e) =>
                    setBarberForm({
                      ...barberForm,
                      breakStartTime: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="label">Break end</label>
                <input
                  type="time"
                  className="input"
                  value={barberForm.breakEndTime}
                  onChange={(e) =>
                    setBarberForm({
                      ...barberForm,
                      breakEndTime: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={barberForm.status}
                  onChange={(e) =>
                    setBarberForm({
                      ...barberForm,
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
                <label className="label">Services provided</label>
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
                </div>
              </div>
              {error && (
                <p className="sm:col-span-2 text-sm text-rose-700">{error}</p>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" className="btn-primary" disabled={saving}>
                  Save
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
            {salon.barbers.map((b) => (
              <div key={b.id} className="card p-4">
                <div className="flex gap-3">
                  <div
                    className="h-14 w-14 shrink-0 rounded-xl bg-stone-200"
                    style={{
                      backgroundImage: b.profilePhoto
                        ? `url(${b.profilePhoto})`
                        : undefined,
                      backgroundSize: "cover",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{b.name}</p>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="text-sm text-[var(--accent)]">
                      {b.specialization}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {b.yearsExperience} yrs · ★ {b.rating} ·{" "}
                      {b.workStartTime}–{b.workEndTime}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Services: {b.services.map((s) => s.name).join(", ") || "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost ring-1 ring-[var(--border)] text-sm"
                    onClick={() => openEditBarber(b)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-danger text-sm"
                    onClick={() => deleteBarber(b.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "services" && (
        <section className="mt-6">
          <div className="flex justify-between gap-3">
            <h2 className="font-display text-2xl">Services</h2>
            <button type="button" className="btn-primary" onClick={openNewService}>
              Add service
            </button>
          </div>

          {showService && (
            <form
              onSubmit={saveService}
              className="card mt-4 grid gap-3 p-5 sm:grid-cols-2"
            >
              <h3 className="font-medium sm:col-span-2">
                {editServiceId ? "Edit service" : "New service"}
              </h3>
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
                <label className="label">Status</label>
                <select
                  className="input"
                  value={serviceForm.status}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      status: e.target.value as "ACTIVE" | "INACTIVE",
                    })
                  }
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
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
                <label className="label">Assigned barbers</label>
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
              {error && (
                <p className="sm:col-span-2 text-sm text-rose-700">{error}</p>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" className="btn-primary" disabled={saving}>
                  Save
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
            {salon.services.map((s) => (
              <div
                key={s.id}
                className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{s.name}</p>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-sm text-[var(--muted)]">{s.description}</p>
                  <p className="mt-1 text-sm">
                    ₹{s.price} · {s.duration} min
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Barbers: {s.barbers.map((b) => b.name).join(", ") || "—"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost ring-1 ring-[var(--border)] text-sm"
                    onClick={() => openEditService(s)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-danger text-sm"
                    onClick={() => deleteService(s.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
