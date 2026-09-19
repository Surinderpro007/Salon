"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Calendar, LogOut, Scissors, User } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAdmin = user?.role === "SUPER_ADMIN";
  const isOwner = user?.role === "SALON_OWNER";

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link
          href={isAdmin ? "/admin" : isOwner ? "/owner" : "/"}
          className="flex items-center gap-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--cream)]">
            <Scissors className="h-4 w-4" />
          </span>
          <span className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]">
            TrimBook
          </span>
        </Link>

        {!loading && (
          <nav className="flex items-center sm:gap-2">
            {user ? (
              <>
                {isAdmin && (
                  <>
                    <NavLink href="/admin" active={pathname === "/admin"}>
                      Dashboard
                    </NavLink>
                    <NavLink
                      href="/admin/salons"
                      active={pathname.startsWith("/admin/salons")}
                    >
                      Salons
                    </NavLink>
                    <NavLink
                      href="/admin/bookings"
                      active={pathname.startsWith("/admin/bookings")}
                    >
                      Bookings
                    </NavLink>
                  </>
                )}
                {isOwner && (
                  <>
                    <NavLink href="/owner" active={pathname === "/owner"}>
                      Dashboard
                    </NavLink>
                    <NavLink
                      href="/owner/salon"
                      active={pathname.startsWith("/owner/salon")}
                    >
                      My salon
                    </NavLink>
                    <NavLink
                      href="/owner/bookings"
                      active={pathname.startsWith("/owner/bookings")}
                    >
                      Requests
                    </NavLink>
                  </>
                )}
                {!isAdmin && !isOwner && (
                  <>
                    <NavLink href="/salons" active={pathname.startsWith("/salons")}>
                      Salons
                    </NavLink>
                    <NavLink
                      href="/appointments"
                      active={pathname.startsWith("/appointments")}
                    >
                      <Calendar className="h-4 w-4" />
                      <span className="hidden sm:inline">Appointments</span>
                    </NavLink>
                  </>
                )}
                <NavLink href="/notifications" active={pathname === "/notifications"}>
                  <Bell className="h-4 w-4" />
                </NavLink>
                <NavLink href="/profile" active={pathname === "/profile"}>
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
                </NavLink>
                <button onClick={handleLogout} className="btn-ghost" aria-label="Logout">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-ghost text-sm">
                  Login
                </Link>
                <Link href="/register" className="btn-primary text-sm">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm transition",
        active
          ? "bg-[var(--ink)]/5 font-medium text-[var(--ink)]"
          : "text-[var(--muted)] hover:bg-[var(--ink)]/5 hover:text-[var(--ink)]"
      )}
    >
      {children}
    </Link>
  );
}
