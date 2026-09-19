"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth, homeForRole } from "@/components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ action: "login", email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
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
        <h1 className="font-display text-3xl">Welcome back</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Sign in to book or manage salons.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          New here?{" "}
          <Link href="/register" className="font-medium text-[var(--accent)]">
            Create an account
          </Link>
        </p>

        <div className="mt-6 rounded-xl bg-[var(--cream)] p-3 text-xs text-[var(--muted)]">
          <p className="font-medium text-[var(--ink)]">Demo accounts</p>
          <p className="mt-1">Admin: admin@salon.com / admin123</p>
          <p>Owner: owner@salon.com / owner123</p>
          <p>Customer: customer@example.com / customer123</p>
        </div>
      </div>
    </div>
  );
}
