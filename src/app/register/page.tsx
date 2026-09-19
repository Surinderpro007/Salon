"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth, homeForRole } from "@/components/AuthProvider";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "CUSTOMER" as "CUSTOMER" | "SALON_OWNER",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }
      setUser(data.user);
      router.push(homeForRole(data.user.role));
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <div className="card p-8 animate-fade-up">
        <h1 className="font-display text-3xl">Create account</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Book appointments or list your salon on TrimBook.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="label">I am a</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["CUSTOMER", "Customer"],
                  ["SALON_OWNER", "Salon owner"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, role: value })}
                  className={`rounded-xl px-3 py-3 text-sm font-medium ring-1 transition ${
                    form.role === value
                      ? "bg-[var(--ink)] text-[var(--cream)] ring-[var(--ink)]"
                      : "bg-white text-[var(--muted)] ring-[var(--border)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {(
            [
              ["name", "Full name", "text"],
              ["email", "Email", "email"],
              ["phone", "Phone", "tel"],
              ["password", "Password", "password"],
            ] as const
          ).map(([key, label, type]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="input"
                type={type}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required={key !== "phone"}
                minLength={key === "password" ? 6 : undefined}
              />
            </div>
          ))}
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading
              ? "Creating…"
              : form.role === "SALON_OWNER"
                ? "Create salon owner account"
                : "Sign up"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--accent)]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
