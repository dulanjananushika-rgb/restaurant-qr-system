import { Armchair, QrCode, Users } from "lucide-react";

import AddTableForm from "@/components/admin/AddTableForm";
import TableQRCode from "@/components/admin/TableQRCode";
import TableActions from "@/components/admin/TableActions";
import { getAppUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RestaurantTable = {
  _id: string;
  name: string;
  capacity: number;
  qrCode: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "INACTIVE";
  createdAt: string;
};

async function getTables() {
  const appUrl = getAppUrl();

  const res = await fetch(`${appUrl}/api/admin/tables`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch tables");
  }

  return res.json();
}

const statusStyles = {
  AVAILABLE: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  OCCUPIED: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  RESERVED: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  INACTIVE: "border-neutral-500/20 bg-neutral-500/10 text-neutral-300",
};

export default async function AdminTablesPage() {
  const result = await getTables();
  const tables: RestaurantTable[] = result?.data || [];

  const availableCount = tables.filter(
    (table) => table.status === "AVAILABLE"
  ).length;

  const occupiedCount = tables.filter(
    (table) => table.status === "OCCUPIED"
  ).length;

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
        <p className="text-sm font-medium text-emerald-300">
          Tables & QR Management
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Manage restaurant tables and QR ordering links
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
          Create dining tables, generate unique QR scan links, update table
          details, and control table availability for restaurant operations.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">Total Tables</p>
            <Armchair size={20} className="text-emerald-300" />
          </div>

          <h3 className="mt-3 text-3xl font-semibold">{tables.length}</h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">Available</p>
            <Users size={20} className="text-emerald-300" />
          </div>

          <h3 className="mt-3 text-3xl font-semibold text-emerald-300">
            {availableCount}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">Occupied</p>
            <QrCode size={20} className="text-amber-300" />
          </div>

          <h3 className="mt-3 text-3xl font-semibold text-amber-300">
            {occupiedCount}
          </h3>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.6fr]">
        <AddTableForm />

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Table QR Codes</h2>

            <p className="mt-1 text-sm text-neutral-500">
              Print or copy these QR links and place them on restaurant tables.
              Use Edit to update table details or change operational status.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {tables.map((table) => (
              <div
                key={table._id}
                className="rounded-[24px] border border-white/10 bg-black/20 p-4"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{table.name}</h3>

                    <p className="mt-1 text-sm text-neutral-500">
                      Capacity: {table.capacity}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      statusStyles[table.status]
                    }`}
                  >
                    {table.status}
                  </span>
                </div>

                <TableQRCode tableName={table.name} qrCode={table.qrCode} />

                <TableActions table={table} />
              </div>
            ))}

            {tables.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-sm text-neutral-500 md:col-span-2">
                No tables found. Add your first table to generate a QR code.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}