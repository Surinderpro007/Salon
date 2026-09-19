"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { EmptyState, LoadingBlock } from "@/components/ui";

type Notification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    setItems(data.notifications || []);
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

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read-all" }),
    });
    await load();
  }

  if (authLoading || loading) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Notifications</h1>
        {items.some((n) => !n.read) && (
          <button type="button" className="btn-ghost text-sm" onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {items.length === 0 ? (
          <EmptyState title="No notifications yet" />
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={`card p-4 ${!n.read ? "ring-1 ring-[var(--accent)]/30" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{n.title}</p>
                {!n.read && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                )}
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">{n.message}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
