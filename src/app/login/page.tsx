"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Store,
  Utensils,
  QrCode,
  Boxes,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Login failed");
        return;
      }

      router.push(result.redirectTo || "/admin/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070A12] text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute left-[-180px] top-[-180px] h-[460px] w-[460px] rounded-full bg-emerald-400/20 blur-[110px]" />
        <div className="absolute bottom-[-180px] right-[-160px] h-[500px] w-[500px] rounded-full bg-lime-400/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_38%)]" />
      </div>

      <section className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden border-r border-white/10 px-10 py-8 lg:block">
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[24px] border border-white/15 bg-white/10 text-emerald-200 shadow-2xl backdrop-blur-2xl">
                <Store size={26} />
              </div>

              <div>
                <h1 className="text-lg font-black tracking-tight">
                  Saffron Table
                </h1>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-200/70">
                  Restaurant Ordering System
                </p>
              </div>
            </div>

            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100 backdrop-blur-xl">
                QR Table Ordering System
              </div>

              <h2 className="text-6xl font-black leading-[1.03] tracking-tight">
                Simple ordering for restaurant tables.
              </h2>

              <p className="mt-6 max-w-xl text-base leading-8 text-neutral-400">
                This system helps the restaurant manage menu items, table QR
                codes, customer orders and basic inventory from an admin panel.
              </p>

              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
                <div className="rounded-[26px] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
                  <Utensils className="mb-4 text-emerald-200" size={24} />
                  <p className="text-xl font-black">Menu</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    Add food items and categories
                  </p>
                </div>

                <div className="rounded-[26px] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
                  <QrCode className="mb-4 text-emerald-200" size={24} />
                  <p className="text-xl font-black">QR</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    Generate QR codes for tables
                  </p>
                </div>

                <div className="rounded-[26px] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
                  <Boxes className="mb-4 text-emerald-200" size={24} />
                  <p className="text-xl font-black">Stock</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    Track ingredients and usage
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-2xl">
              <p className="text-sm font-semibold text-emerald-200">
                 Admin workspace
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Sign in to manage restaurant menu items, table QR codes, customer
    orders and inventory records.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[24px] border border-white/15 bg-white/10 text-emerald-200 backdrop-blur-2xl">
                <Store size={27} />
              </div>

              <h1 className="text-3xl font-black tracking-tight">
                Saffron Table
              </h1>

              <p className="mt-1 text-sm text-neutral-500">
                Restaurant Ordering System
              </p>
            </div>

            <div className="rounded-[38px] border border-white/15 bg-white/[0.08] p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl">
              <div className="mx-auto mb-6 h-1.5 w-16 rounded-full bg-white/25" />

              <div className="mb-7">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-200">
                  <LockKeyhole size={22} />
                </div>

                <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-200">
                  Admin Login
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  Sign in
                </h2>

                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  Enter your admin account details to access the management
                  panel.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-300">
                    Email address
                  </span>

                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 transition focus-within:border-emerald-300/60 focus-within:bg-black/35">
                    <Mail size={18} className="text-neutral-500" />

                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
                      placeholder="Enter email address"
                      type="email"
                      autoComplete="email"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-300">
                    Password
                  </span>

                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 transition focus-within:border-emerald-300/60 focus-within:bg-black/35">
                    <LockKeyhole size={18} className="text-neutral-500" />

                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
                      placeholder="Enter password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="text-neutral-500 transition hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                {error && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-white to-emerald-100 px-5 py-4 text-sm font-black text-[#10141F] shadow-lg shadow-black/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Continue to dashboard"}
                  {!loading && (
                    <ArrowRight
                      size={18}
                      className="transition group-hover:translate-x-1"
                    />
                  )}
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-xs leading-6 text-neutral-600">
              Access is limited to authorized restaurant administrators.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}