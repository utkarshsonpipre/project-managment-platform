"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, KanbanSquare, LayoutDashboard, Loader2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FEATURES = [
  "Kanban boards with drag-and-drop",
  "Sprint planning & velocity tracking",
  "Realtime collaboration & notifications",
  "Analytics dashboards",
];

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const isRegister = mode === "register";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        await api.post("/api/auth/register", { name, email, password });
      } else {
        await api.post("/api/auth/login", { email, password });
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="brand-gradient relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-black/10 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-2 font-semibold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <LayoutDashboard className="size-5" />
          </span>
          <span className="text-lg">PM Platform</span>
        </Link>

        <div className="relative space-y-6">
          <h2 className="max-w-md text-3xl font-semibold leading-tight">
            Plan projects, run sprints, and ship work — together.
          </h2>
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-white/90">
                <span className="flex size-6 items-center justify-center rounded-full bg-white/15">
                  <Check className="size-3.5" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/70">
          Organizations · Projects · Boards · Sprints · Analytics
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-muted/30 px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-center gap-2 font-semibold lg:hidden">
            <span className="brand-gradient flex size-8 items-center justify-center rounded-lg text-white">
              <KanbanSquare className="size-4" />
            </span>
            <span className="text-lg">PM Platform</span>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">
                {isRegister ? "Create your account" : "Welcome back"}
              </CardTitle>
              <CardDescription>
                {isRegister
                  ? "Start managing projects in minutes."
                  : "Log in to your workspace."}
              </CardDescription>
            </CardHeader>
            <form onSubmit={onSubmit}>
              <CardContent className="space-y-4">
                {isRegister && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={isRegister ? 8 : undefined}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                  />
                </div>

                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
              </CardContent>
              <CardFooter className="mt-4 flex-col gap-3">
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />}
                  {isRegister ? "Sign up" : "Log in"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {isRegister ? (
                    <>
                      Already have an account?{" "}
                      <Link href="/login" className="text-primary hover:underline">
                        Log in
                      </Link>
                    </>
                  ) : (
                    <>
                      New here?{" "}
                      <Link href="/register" className="text-primary hover:underline">
                        Create an account
                      </Link>
                    </>
                  )}
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
