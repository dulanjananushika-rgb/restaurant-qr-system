"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Loader2,
  PackagePlus,
  Plus,
  ReceiptText,
  Save,
  Trash2,
} from "lucide-react";

type Supplier = {
  _id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  status: "ACTIVE" | "INACTIVE";
};

type InventoryItem = {
  _id: string;
  name: string;
  unit: string;
  quantity: number;
  minQuantity: number;
};

type PurchaseItemRow = {
  rowId: string;
  inventoryItem: string;
  quantity: string;
  unitCost: string;
};

type Purchase = {
  _id: string;
  supplier?: Supplier;
  invoiceNumber?: string;
  purchaseDate: string;
  items: {
    _id: string;
    inventoryItem?: InventoryItem;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }[];
  totalAmount: number;
  paymentStatus: "UNPAID" | "PAID" | "PARTIALLY_PAID";
  note?: string;
  createdAt: string;
};

function createPurchaseRow(inventoryItem = ""): PurchaseItemRow {
  return {
    rowId: crypto.randomUUID(),
    inventoryItem,
    quantity: "1",
    unitCost: "0",
  };
}

function formatCurrency(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US")}`;
}

export default function PurchaseManager({
  suppliers,
  inventoryItems,
  purchases,
}: {
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
  purchases: Purchase[];
}) {
  const router = useRouter();

  const activeSuppliers = suppliers.filter(
    (supplier) => supplier.status === "ACTIVE"
  );

  const [supplier, setSupplier] = useState(activeSuppliers[0]?._id || "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentStatus, setPaymentStatus] = useState<
    "UNPAID" | "PAID" | "PARTIALLY_PAID"
  >("UNPAID");
  const [note, setNote] = useState("");

  const [rows, setRows] = useState<PurchaseItemRow[]>([
    createPurchaseRow(inventoryItems[0]?._id || ""),
  ]);

  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierContactPerson, setNewSupplierContactPerson] = useState("");

  const [loadingPurchase, setLoadingPurchase] = useState(false);
  const [loadingSupplier, setLoadingSupplier] = useState(false);
  const [error, setError] = useState("");

  const totalAmount = useMemo(() => {
    return rows.reduce((sum, row) => {
      const quantity = Number(row.quantity) || 0;
      const unitCost = Number(row.unitCost) || 0;

      return sum + quantity * unitCost;
    }, 0);
  }, [rows]);

  function addRow() {
    setRows((current) => [
      ...current,
      createPurchaseRow(inventoryItems[0]?._id || ""),
    ]);
  }

  function removeRow(rowId: string) {
    setRows((current) =>
      current.length === 1
        ? current
        : current.filter((row) => row.rowId !== rowId)
    );
  }

  function updateRow(
    rowId: string,
    field: "inventoryItem" | "quantity" | "unitCost",
    value: string
  ) {
    setRows((current) =>
      current.map((row) =>
        row.rowId === rowId ? { ...row, [field]: value } : row
      )
    );
  }

  function resetPurchaseForm() {
    setInvoiceNumber("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setPaymentStatus("UNPAID");
    setNote("");
    setRows([createPurchaseRow(inventoryItems[0]?._id || "")]);
    setError("");
  }

  async function createSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoadingSupplier(true);

    if (!newSupplierName.trim()) {
      setError("Supplier name is required.");
      setLoadingSupplier(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newSupplierName,
          phone: newSupplierPhone,
          contactPerson: newSupplierContactPerson,
          status: "ACTIVE",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to create supplier");
        return;
      }

      setNewSupplierName("");
      setNewSupplierPhone("");
      setNewSupplierContactPerson("");
      setSupplier(result.data._id);
      router.refresh();
    } catch {
      setError("Something went wrong while creating supplier.");
    } finally {
      setLoadingSupplier(false);
    }
  }

  async function createPurchase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoadingPurchase(true);

    if (!supplier) {
      setError("Please select a supplier.");
      setLoadingPurchase(false);
      return;
    }

    const items = rows
      .filter(
        (row) =>
          row.inventoryItem &&
          Number(row.quantity) > 0 &&
          Number(row.unitCost) >= 0
      )
      .map((row) => ({
        inventoryItem: row.inventoryItem,
        quantity: Number(row.quantity),
        unitCost: Number(row.unitCost),
      }));

    if (items.length === 0) {
      setError("Please add at least one valid purchase item.");
      setLoadingPurchase(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/purchases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          supplier,
          invoiceNumber,
          purchaseDate,
          items,
          paymentStatus,
          note,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to create purchase");
        return;
      }

      resetPurchaseForm();
      router.refresh();
    } catch {
      setError("Something went wrong while creating purchase.");
    } finally {
      setLoadingPurchase(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
              <Building2 size={22} />
            </div>

            <h2 className="text-lg font-semibold">Add Supplier</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-500">
              Create suppliers used for stock purchases.
            </p>
          </div>

          <form onSubmit={createSupplier} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                Supplier name
              </span>
              <input
                value={newSupplierName}
                onChange={(event) => setNewSupplierName(event.target.value)}
                placeholder="Fresh Farm Foods"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-400/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                Contact person optional
              </span>
              <input
                value={newSupplierContactPerson}
                onChange={(event) =>
                  setNewSupplierContactPerson(event.target.value)
                }
                placeholder="Mr. Perera"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-400/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                Phone optional
              </span>
              <input
                value={newSupplierPhone}
                onChange={(event) => setNewSupplierPhone(event.target.value)}
                placeholder="0712345678"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-400/50"
              />
            </label>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loadingSupplier}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingSupplier ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {loadingSupplier ? "Saving..." : "Save supplier"}
            </button>
          </form>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
              <PackagePlus size={22} />
            </div>

            <h2 className="text-lg font-semibold">Create Purchase</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-500">
              Purchase inventory items and automatically increase stock.
            </p>
          </div>

          <form onSubmit={createPurchase} className="space-y-5">
            <section className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-neutral-400">
                  Supplier
                </span>

                <select
                  value={supplier}
                  onChange={(event) => setSupplier(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
                >
                  {activeSuppliers.map((item) => (
                    <option
                      key={item._id}
                      value={item._id}
                      className="bg-[#0B0F14]"
                    >
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-neutral-400">
                  Invoice number optional
                </span>

                <input
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                  placeholder="INV-001"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-neutral-400">
                  Purchase date
                </span>

                <input
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  type="date"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-neutral-400">
                  Payment status
                </span>

                <select
                  value={paymentStatus}
                  onChange={(event) =>
                    setPaymentStatus(
                      event.target.value as
                        | "UNPAID"
                        | "PAID"
                        | "PARTIALLY_PAID"
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
                >
                  <option value="UNPAID" className="bg-[#0B0F14]">
                    UNPAID
                  </option>
                  <option value="PAID" className="bg-[#0B0F14]">
                    PAID
                  </option>
                  <option value="PARTIALLY_PAID" className="bg-[#0B0F14]">
                    PARTIALLY_PAID
                  </option>
                </select>
              </label>
            </section>

            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Purchase items</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Select inventory items, quantities and unit cost.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addRow}
                  disabled={inventoryItems.length === 0}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={15} />
                  Add item
                </button>
              </div>

              <div className="space-y-3">
                {rows.map((row, index) => {
                  const inventoryItem = inventoryItems.find(
                    (item) => item._id === row.inventoryItem
                  );

                  const lineTotal =
                    (Number(row.quantity) || 0) * (Number(row.unitCost) || 0);

                  return (
                    <div
                      key={row.rowId}
                      className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 lg:grid-cols-[1.3fr_0.5fr_0.5fr_auto]"
                    >
                      <label>
                        <span className="mb-2 block text-xs text-neutral-500">
                          Item {index + 1}
                        </span>

                        <select
                          value={row.inventoryItem}
                          onChange={(event) =>
                            updateRow(
                              row.rowId,
                              "inventoryItem",
                              event.target.value
                            )
                          }
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none"
                        >
                          {inventoryItems.map((item) => (
                            <option
                              key={item._id}
                              value={item._id}
                              className="bg-[#0B0F14]"
                            >
                              {item.name} ({item.quantity} {item.unit})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span className="mb-2 block text-xs text-neutral-500">
                          Quantity
                        </span>

                        <input
                          value={row.quantity}
                          onChange={(event) =>
                            updateRow(row.rowId, "quantity", event.target.value)
                          }
                          type="number"
                          min="1"
                          step="0.01"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none"
                        />
                      </label>

                      <label>
                        <span className="mb-2 block text-xs text-neutral-500">
                          Unit cost
                        </span>

                        <input
                          value={row.unitCost}
                          onChange={(event) =>
                            updateRow(row.rowId, "unitCost", event.target.value)
                          }
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none"
                        />
                      </label>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeRow(row.rowId)}
                          disabled={rows.length === 1}
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <p className="text-xs text-neutral-500 lg:col-span-4">
                        {inventoryItem?.name || "Item"} line total:{" "}
                        <span className="text-emerald-300">
                          {formatCurrency(lineTotal)}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                Note optional
              </span>

              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Supplier delivered fresh stock..."
                className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
              />
            </label>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-sm text-neutral-400">Purchase total</p>
              <p className="mt-1 text-3xl font-semibold text-emerald-300">
                {formatCurrency(totalAmount)}
              </p>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={
                loadingPurchase ||
                activeSuppliers.length === 0 ||
                inventoryItems.length === 0
              }
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPurchase ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {loadingPurchase ? "Saving purchase..." : "Save purchase"}
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Purchase History</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Recent supplier purchase records and stock entries.
            </p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
            <ReceiptText size={20} />
          </div>
        </div>

        <div className="space-y-4">
          {purchases.map((purchase) => (
            <article
              key={purchase._id}
              className="rounded-[24px] border border-white/10 bg-black/20 p-4"
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">
                      {purchase.supplier?.name || "Supplier"}
                    </h3>

                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300">
                      {purchase.paymentStatus}
                    </span>

                    {purchase.invoiceNumber && (
                      <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs text-sky-300">
                        {purchase.invoiceNumber}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-neutral-500">
                    Purchase date:{" "}
                    {new Date(purchase.purchaseDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                  <p className="text-xs text-neutral-400">Total</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-300">
                    {formatCurrency(purchase.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {purchase.items.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm">
                        {item.inventoryItem?.name || "Inventory item"}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {item.quantity} {item.inventoryItem?.unit || ""} × Rs.{" "}
                        {item.unitCost}
                      </p>
                    </div>

                    <p className="text-sm font-semibold text-emerald-300">
                      {formatCurrency(item.totalCost)}
                    </p>
                  </div>
                ))}
              </div>

              {purchase.note && (
                <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-neutral-400">
                  {purchase.note}
                </p>
              )}
            </article>
          ))}

          {purchases.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-10 text-center">
              <ReceiptText className="mx-auto mb-3 text-neutral-600" size={36} />
              <p className="text-sm text-neutral-500">
                No purchases created yet.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}