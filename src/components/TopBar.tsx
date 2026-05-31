"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { initials } from "@/lib/ui";

export function TopBar({ userName }: { userName?: string }) {
  const router = useRouter();

  async function logout() {
    await api.post("/api/auth/logout").catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="brand-gradient flex size-7 items-center justify-center rounded-lg text-white shadow-sm">
            <LayoutDashboard className="size-4" />
          </span>
          <span>PM Platform</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
          {userName && (
            <div className="flex items-center gap-2">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                  {initials(userName)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {userName}
              </span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut /> Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
