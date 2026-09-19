import { cn } from "@/lib/utils";
import { BadgeCheck, Crown } from "lucide-react";

export function TrustBadges({
  verified,
  premium,
  size = "sm",
}: {
  verified?: boolean;
  premium?: boolean;
  size?: "sm" | "md";
}) {
  if (!verified && !premium) return null;
  const text = size === "md" ? "text-xs px-2.5 py-1" : "text-[11px] px-2 py-0.5";
  const icon = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {verified && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-sky-50 font-semibold text-sky-700 ring-1 ring-sky-200",
            text
          )}
          title="Verified by TrimBook"
        >
          <BadgeCheck className={icon} />
          Verified
        </span>
      )}
      {premium && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-amber-50 font-semibold text-amber-800 ring-1 ring-amber-200",
            text
          )}
          title="Premium salon"
        >
          <Crown className={icon} />
          Premium
        </span>
      )}
    </span>
  );
}

export function StatusBadge({
  status,
  open,
}: {
  status?: string;
  open?: boolean;
}) {
  if (typeof open === "boolean") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
          open
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            : "bg-stone-100 text-stone-500 ring-1 ring-stone-200"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            open ? "bg-emerald-500" : "bg-stone-400"
          )}
        />
        {open ? "Open" : "Closed"}
      </span>
    );
  }

  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    INACTIVE: "bg-stone-100 text-stone-500 ring-stone-200",
    CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
    PENDING_APPROVAL: "bg-amber-50 text-amber-700 ring-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    REJECTED: "bg-rose-50 text-rose-700 ring-rose-200",
    DRAFT: "bg-stone-100 text-stone-600 ring-stone-200",
    NONE: "bg-stone-100 text-stone-600 ring-stone-200",
    VERIFIED: "bg-sky-50 text-sky-700 ring-sky-200",
    COMPLETED: "bg-sky-50 text-sky-700 ring-sky-200",
    CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
    NO_SHOW: "bg-stone-100 text-stone-600 ring-stone-200",
  };

  const label = (status || "").replaceAll("_", " ");

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 capitalize",
        map[status || ""] || "bg-stone-100 text-stone-600 ring-stone-200"
      )}
    >
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center">
      <p className="font-medium text-[var(--ink)]">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      )}
    </div>
  );
}

export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
    </div>
  );
}
