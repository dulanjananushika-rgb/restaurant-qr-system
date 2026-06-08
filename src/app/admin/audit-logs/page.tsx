import {
  Activity,
  AlertTriangle,
  Clock,
  CreditCard,
  FileClock,
  FolderOpen,
  Search,
  ShieldCheck,
  Utensils,
} from "lucide-react";

import { connectDB } from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";

type AuditLogData = {
  _id: string;
  action: string;
  module: string;
  description: string;
  performedBy: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

async function getAuditLogs() {
  await connectDB();

  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(200).lean();

  return JSON.parse(JSON.stringify(logs)) as AuditLogData[];
}

function moduleClass(module: string) {
  if (module === "KITCHEN") {
    return "border-orange-500/20 bg-orange-500/10 text-orange-300";
  }

  if (module === "WAITER") {
    return "border-sky-500/20 bg-sky-500/10 text-sky-300";
  }

  if (module === "CASHIER") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (module === "CATEGORIES") {
    return "border-purple-500/20 bg-purple-500/10 text-purple-300";
  }

  if (module === "ORDERS") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  return "border-white/10 bg-white/[0.04] text-neutral-300";
}

function getModuleIcon(module: string) {
  if (module === "KITCHEN") return Utensils;
  if (module === "WAITER") return Activity;
  if (module === "CASHIER") return CreditCard;
  if (module === "CATEGORIES") return FolderOpen;
  if (module === "ORDERS") return FileClock;
  return ShieldCheck;
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString();
}

export default async function AdminAuditLogsPage() {
  const logs = await getAuditLogs();

  const today = new Date();

  const todayLogs = logs.filter((log) => {
    const createdAt = new Date(log.createdAt);
    return createdAt.toDateString() === today.toDateString();
  });

  const paymentLogs = logs.filter((log) => log.module === "CASHIER");
  const kitchenLogs = logs.filter((log) => log.module === "KITCHEN");
  const waiterLogs = logs.filter((log) => log.module === "WAITER");

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
        <p className="text-sm font-medium text-emerald-300">Audit Logs</p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          System activity history
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          Track important actions such as order status changes, payment
          settlements, category changes and staff activity.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
            <ShieldCheck size={21} />
          </div>

          <p className="text-sm text-neutral-500">Total Logs</p>
          <h3 className="mt-2 text-3xl font-semibold">{logs.length}</h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
            <Clock size={21} />
          </div>

          <p className="text-sm text-neutral-500">Today Logs</p>
          <h3 className="mt-2 text-3xl font-semibold text-sky-300">
            {todayLogs.length}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-300">
            <Utensils size={21} />
          </div>

          <p className="text-sm text-neutral-500">Kitchen Actions</p>
          <h3 className="mt-2 text-3xl font-semibold text-orange-300">
            {kitchenLogs.length}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
            <CreditCard size={21} />
          </div>

          <p className="text-sm text-neutral-500">Payment Actions</p>
          <h3 className="mt-2 text-3xl font-semibold text-emerald-300">
            {paymentLogs.length}
          </h3>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Showing latest 200 system actions.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-neutral-500">
            <Search size={16} />
            Audit trail
          </div>
        </div>

        <div className="space-y-3">
          {logs.map((log) => {
            const Icon = getModuleIcon(log.module);

            return (
              <article
                key={log._id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] text-emerald-300">
                      <Icon size={20} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{log.action}</p>

                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${moduleClass(
                            log.module
                          )}`}
                        >
                          {log.module}
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-6 text-neutral-400">
                        {log.description}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-500">
                        <span>By: {log.performedBy || "System"}</span>
                        <span>{formatDateTime(log.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {logs.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-10 text-center">
              <AlertTriangle
                className="mx-auto mb-3 text-neutral-600"
                size={38}
              />
              <p className="text-sm text-neutral-500">
                No audit logs recorded yet.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}