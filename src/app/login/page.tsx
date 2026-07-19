"use client";

import {
  ArrowRight,
  ChefHat,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginResponse = {
  success: boolean;
  message?: string;
  redirectTo?: string;
};

const roles = [
  {
    name: "Admin",
    description: "Manage the complete restaurant system",
    icon: ShieldCheck,
  },
  {
    name: "Kitchen",
    description: "Manage food preparation and order status",
    icon: ChefHat,
  },
  {
    name: "Waiter",
    description: "Collect and deliver prepared orders",
    icon: UserRound,
  },
  {
    name: "Cashier",
    description: "Manage payments and receipts",
    icon: ReceiptText,
  },
];

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    setError("");

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/auth/login", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email: cleanEmail,
          password,
        }),
      });

      const result =
        (await response.json()) as LoginResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            "Invalid email address or password."
        );
      }

      router.replace(
        result.redirectTo || "/admin/dashboard"
      );

      router.refresh();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-0 h-80 w-80 rounded-full bg-emerald-500/[0.06] blur-[120px]" />

        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-sky-500/[0.04] blur-[130px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-12">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/10">
              <Store className="h-5 w-5" />
            </div>

            <div>
              <p className="text-base font-bold text-white">
                Saffron Table
              </p>

              <p className="text-xs text-slate-500">
                Restaurant Management System
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 sm:flex">
            <LockKeyhole className="h-3.5 w-3.5 text-emerald-400" />

            Secure staff access
          </div>
        </header>

        {/* Main content */}
        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          {/* Left section */}
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-1.5 text-xs font-semibold text-emerald-300">
                <QrCode className="h-3.5 w-3.5" />

                QR Restaurant Operations
              </div>

              <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl">
                Manage restaurant operations from one place.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-slate-400">
                Access customer orders, kitchen activities,
                waiter services, cashier payments, menu
                management and inventory using one secure
                system.
              </p>
            </div>

            <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3">
              {roles.map((role) => {
                const Icon = role.icon;

                return (
                  <div
                    key={role.name}
                    className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-emerald-400">
                      <Icon className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {role.name}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {role.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex items-center gap-3 text-sm text-slate-500">
              <div className="h-px w-10 bg-slate-700" />

              Customers order directly using table or takeaway
              QR codes
            </div>
          </section>

          {/* Login section */}
          <section className="mx-auto w-full max-w-md">
            {/* Mobile heading */}
            <div className="mb-7 lg:hidden">
              <p className="text-sm font-semibold text-emerald-400">
                Restaurant Staff Login
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
                Welcome back
              </h1>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Sign in to access your assigned staff
                workspace.
              </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111820] shadow-2xl shadow-black/30">
              <div className="border-b border-white/[0.07] px-6 py-6 sm:px-8">
                <p className="text-sm font-semibold text-emerald-400">
                  Restaurant Staff Login
                </p>

                <h2 className="mt-2 text-2xl font-bold text-white">
                  Sign in to your account
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Enter your registered email address and
                  password.
                </p>
              </div>

              <form
                onSubmit={handleLogin}
                className="space-y-5 px-6 py-7 sm:px-8"
              >
                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Email address
                  </label>

                  <div className="flex h-12 items-center gap-3 rounded-xl border border-white/[0.09] bg-[#0b1016] px-4 transition focus-within:border-emerald-500/60 focus-within:ring-4 focus-within:ring-emerald-500/[0.08]">
                    <Mail className="h-4.5 w-4.5 shrink-0 text-slate-500" />

                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      required
                      disabled={loading}
                      autoComplete="email"
                      placeholder="name@restaurant.com"
                      onChange={(event) => {
                        setEmail(event.target.value);

                        if (error) {
                          setError("");
                        }
                      }}
                      className="h-full w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Password
                  </label>

                  <div className="flex h-12 items-center gap-3 rounded-xl border border-white/[0.09] bg-[#0b1016] px-4 transition focus-within:border-emerald-500/60 focus-within:ring-4 focus-within:ring-emerald-500/[0.08]">
                    <LockKeyhole className="h-4.5 w-4.5 shrink-0 text-slate-500" />

                    <input
                      id="password"
                      name="password"
                      type={
                        showPassword ? "text" : "password"
                      }
                      value={password}
                      required
                      disabled={loading}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      onChange={(event) => {
                        setPassword(event.target.value);

                        if (error) {
                          setError("");
                        }
                      }}
                      className="h-full w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                    />

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        setShowPassword(
                          (current) => !current
                        )
                      }
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                      className="rounded-md p-1 text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-200 disabled:opacity-50"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4.5 w-4.5" />
                      ) : (
                        <Eye className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-300"
                  >
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white transition hover:bg-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in to workspace
                      <ArrowRight className="h-4.5 w-4.5" />
                    </>
                  )}
                </button>

                <p className="text-center text-xs leading-5 text-slate-500">
                  Access is limited to authorized restaurant
                  staff members.
                </p>
              </form>
            </div>

            <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center text-xs leading-5 text-slate-500">
              Customers do not need an account. They can place
              orders by scanning a table QR code or the general
              takeaway QR code.
            </div>
          </section>
        </div>

        <footer className="pb-2 text-center text-xs text-slate-600">
          © 2026 Saffron Table Restaurant Management System
        </footer>
      </div>
    </main>
  );
}