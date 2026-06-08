"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  History,
  Loader2,
  Package,
  PlusCircle,
} from "lucide-react";
import { useState } from "react";

type InventoryItem = {
  _id: string;
  name: string;
  unit: string;
  quantity: number;
  minQuantity: number;
};

type StockMovement = {
  _id: string;
  inventoryItem?: InventoryItem;
  type: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT" | "ORDER_DEDUCTION";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  referenceType: "MANUAL" | "ORDER" | "SYSTEM";
  createdAt: string;
};

function movementBadge(type: string) {
  if (type === "STOCK_IN") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (type === "STOCK_OUT" || type === "ORDER_DEDUCTION") {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }

  return "border-amber-500/20 bg-amber-500/10 text-amber-300";
}

export default function InventoryStockManager({
  items,
  movements,
}: {
  items: InventoryItem[];
  movements: StockMovement[];
}) {
  const router = useRouter();

  const [inventoryItemId, setInventoryItemId] = useState(items[0]?._id || "");
  const [type, setType] = useState<"STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT">(
    "STOCK_IN"
  );
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedItem = items.find((item) => item._id === inventoryItemId);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    if (!inventoryItemId) {
      setError("Please select an inventory item.");
      setLoading(false);
      return;
    }

    if (!quantity || Number(quantity) < 0) {
      setError("Please enter a valid quantity.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/inventory-adjustments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inventoryItemId,
          type,
          quantity: Number(quantity),
          reason,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to adjust stock");
        return;
      }

      setQuantity("");
      setReason("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
            <PlusCircle size={22} />
          </div>

          <h2 className="text-lg font-semibold">Adjust Stock</h2>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            Add stock, remove stock, or set an exact quantity for inventory
            items.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              Inventory item
            </span>

            <select
              value={inventoryItemId}
              onChange={(event) => setInventoryItemId(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
            >
              {items.map((item) => (
                <option key={item._id} value={item._id} className="bg-[#0B0F14]">
                  {item.name} — {item.quantity} {item.unit}
                </option>
              ))}
            </select>
          </label>

          {selectedItem && (
            <div
              className={`rounded-2xl border p-4 ${
                selectedItem.quantity <= selectedItem.minQuantity
                  ? "border-amber-500/20 bg-amber-500/10"
                  : "border-white/10 bg-black/20"
              }`}
            >
              <div className="flex items-start gap-3">
                {selectedItem.quantity <= selectedItem.minQuantity ? (
                  <AlertTriangle className="text-amber-300" size={20} />
                ) : (
                  <Package className="text-emerald-300" size={20} />
                )}

                <div>
                  <p className="text-sm font-medium">{selectedItem.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Current: {selectedItem.quantity} {selectedItem.unit} •
                    Minimum: {selectedItem.minQuantity} {selectedItem.unit}
                  </p>
                </div>
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              Adjustment type
            </span>

            <select
              value={type}
              onChange={(event) =>
                setType(
                  event.target.value as "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT"
                )
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
            >
              <option value="STOCK_IN" className="bg-[#0B0F14]">
                STOCK_IN — Add stock
              </option>
              <option value="STOCK_OUT" className="bg-[#0B0F14]">
                STOCK_OUT — Remove stock
              </option>
              <option value="ADJUSTMENT" className="bg-[#0B0F14]">
                ADJUSTMENT — Set exact quantity
              </option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              {type === "ADJUSTMENT" ? "New exact quantity" : "Quantity"}
            </span>

            <input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              type="number"
              min="0"
              placeholder={type === "ADJUSTMENT" ? "Example: 5000" : "Example: 1000"}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              Reason optional
            </span>

            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Example: Supplier stock received / damaged stock removed"
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
            />
          </label>

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || items.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <PlusCircle size={18} />}
            {loading ? "Saving..." : "Save stock adjustment"}
          </button>
        </form>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Stock Movement History</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-500">
              Recent stock in, stock out, adjustments and order deductions.
            </p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
            <History size={20} />
          </div>
        </div>

        <div className="space-y-3">
          {movements.map((movement) => (
            <div
              key={movement._id}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-sm font-medium">
                    {movement.inventoryItem?.name || "Inventory item"}
                  </p>

                  <p className="mt-1 text-xs text-neutral-500">
                    {new Date(movement.createdAt).toLocaleString()}
                  </p>
                </div>

                <span
                  className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${movementBadge(
                    movement.type
                  )}`}
                >
                  {movement.type}
                </span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-xs text-neutral-500">Previous</p>
                  <p className="mt-1 text-sm font-semibold">
                    {movement.previousQuantity}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-xs text-neutral-500">Change</p>
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      movement.quantity >= 0
                        ? "text-emerald-300"
                        : "text-red-300"
                    }`}
                  >
                    {movement.quantity >= 0 ? "+" : ""}
                    {movement.quantity}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-xs text-neutral-500">New</p>
                  <p className="mt-1 text-sm font-semibold">
                    {movement.newQuantity}
                  </p>
                </div>
              </div>

              {movement.reason && (
                <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-neutral-400">
                  {movement.reason}
                </p>
              )}
            </div>
          ))}

          {movements.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-10 text-center">
              <History className="mx-auto mb-3 text-neutral-600" size={36} />
              <p className="text-sm text-neutral-500">
                No stock movements yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}