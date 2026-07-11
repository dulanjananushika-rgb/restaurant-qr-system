"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, PackagePlus, Plus, ReceiptText, Save, Trash2 } from "lucide-react";

type Supplier = {
  _id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  status: "ACTIVE" | "INACTIVE";
};

type InventoryItem = {
  _id: string;
  name: string;
  unit: string;
  quantity: number;
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
  items: any[];
  totalAmount: number;
  paymentStatus: "UNPAID" | "PAID" | "PARTIALLY_PAID";
  note?: string;
  createdAt: string;
};

function createRow(inventoryItem = ""): PurchaseItemRow {
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

  const activeSuppliers = suppliers.filter((s) => s.status === "ACTIVE");

  const [supplier, setSupplier] = useState(activeSuppliers[0]?._id || "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState<"UNPAID" | "PAID" | "PARTIALLY_PAID">("UNPAID");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<PurchaseItemRow[]>([createRow(inventoryItems[0]?._id || "")]);

  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierContactPerson, setNewSupplierContactPerson] = useState("");

  const [loadingPurchase, setLoadingPurchase] = useState(false);
  const [loadingSupplier, setLoadingSupplier] = useState(false);
  const [error, setError] = useState("");

  const totalAmount = rows.reduce((sum, row) => {
    return sum + (Number(row.quantity) || 0) * (Number(row.unitCost) || 0);
  }, 0);

  function addRow() {
    setRows([...rows, createRow(inventoryItems[0]?._id || "")]);
  }

  function removeRow(rowId: string) {
    if (rows.length === 1) return;
    setRows(rows.filter((row) => row.rowId !== rowId));
  }

  function updateRow(rowId: string, field: keyof PurchaseItemRow, value: string) {
    setRows(rows.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row)));
  }

  function resetForm() {
    setInvoiceNumber("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setPaymentStatus("UNPAID");
    setNote("");
    setRows([createRow(inventoryItems[0]?._id || "")]);
    setError("");
  }

  // Create Supplier
  async function createSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!newSupplierName.trim()) return setError("Supplier name is required");

    setLoadingSupplier(true);
    setError("");

    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSupplierName,
          phone: newSupplierPhone,
          contactPerson: newSupplierContactPerson,
          status: "ACTIVE",
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        setError(result.message || "Failed to create supplier");
        return;
      }

      setNewSupplierName("");
      setNewSupplierPhone("");
      setNewSupplierContactPerson("");
      setSupplier(result.data._id);
      router.refresh();
    } catch {
      setError("Error creating supplier");
    } finally {
      setLoadingSupplier(false);
    }
  }

  // Create Purchase
  async function createPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier) return setError("Please select a supplier");

    const items = rows
      .filter((r) => r.inventoryItem && Number(r.quantity) > 0 && Number(r.unitCost) >= 0)
      .map((r) => ({
        inventoryItem: r.inventoryItem,
        quantity: Number(r.quantity),
        unitCost: Number(r.unitCost),
      }));

    if (items.length === 0) return setError("Please add at least one valid item");

    setLoadingPurchase(true);
    setError("");

    try {
      const res = await fetch("/api/admin/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier,
          invoiceNumber,
          purchaseDate,
          items,
          paymentStatus,
          note,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        setError(result.message || "Failed to create purchase");
        return;
      }

      resetForm();
      router.refresh();
    } catch {
      setError("Error creating purchase");
    } finally {
      setLoadingPurchase(false);
    }
  }

  // Mark Purchase as Paid
  async function markAsPaid(purchaseId: string) {
    if (!confirm("Mark this purchase as PAID?")) return;

    try {
      const res = await fetch("/api/admin/purchases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId,
          paymentStatus: "PAID",
        }),
      });

      const result = await res.json();

      if (result.success) {
        router.refresh();
      } else {
        alert(result.message || "Failed to update payment status");
      }
    } catch {
      alert("Error updating payment status");
    }
  }

  return (
    <div className="space-y-8">
      {/* Supplier + Purchase Form */}
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        {/* Add Supplier */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-5 flex items-center gap-3">
            <Building2 className="text-sky-400" size={24} />
            <h2 className="text-xl font-semibold">Add New Supplier</h2>
          </div>

          <form onSubmit={createSupplier} className="space-y-4">
            <input
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              placeholder="Supplier Name"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              required
            />
            <input
              value={newSupplierContactPerson}
              onChange={(e) => setNewSupplierContactPerson(e.target.value)}
              placeholder="Contact Person (optional)"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
            />
            <input
              value={newSupplierPhone}
              onChange={(e) => setNewSupplierPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loadingSupplier}
              className="w-full rounded-2xl bg-white py-3 font-semibold text-black flex justify-center items-center gap-2"
            >
              {loadingSupplier ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {loadingSupplier ? "Saving..." : "Save Supplier"}
            </button>
          </form>
        </div>

        {/* Create Purchase */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-5 flex items-center gap-3">
            <PackagePlus className="text-emerald-400" size={24} />
            <h2 className="text-xl font-semibold">Create Purchase</h2>
          </div>

          <form onSubmit={createPurchase} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                {activeSuppliers.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>

              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Invoice Number"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              />
            </div>

            {/* Purchase Items */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <p className="font-semibold">Purchase Items</p>
                <button type="button" onClick={addRow} className="flex items-center gap-1 text-sm bg-white text-black px-3 py-1 rounded-xl">
                  <Plus size={14} /> Add Item
                </button>
              </div>

              {rows.map((row, index) => (
                <div key={row.rowId} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                  <select
                    value={row.inventoryItem}
                    onChange={(e) => updateRow(row.rowId, "inventoryItem", e.target.value)}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                  >
                    {inventoryItems.map((item) => (
                      <option key={item._id} value={item._id}>{item.name}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.rowId, "quantity", e.target.value)}
                    placeholder="Quantity"
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                  />

                  <input
                    type="number"
                    value={row.unitCost}
                    onChange={(e) => updateRow(row.rowId, "unitCost", e.target.value)}
                    placeholder="Unit Cost"
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                  />

                  <button
                    type="button"
                    onClick={() => removeRow(row.rowId)}
                    disabled={rows.length === 1}
                    className="text-red-400 flex items-center justify-center"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <div className="text-right text-xl font-semibold text-emerald-300">
              Total: {formatCurrency(totalAmount)}
            </div>

            <button
              type="submit"
              disabled={loadingPurchase}
              className="w-full rounded-2xl bg-white py-3 font-semibold text-black flex justify-center items-center gap-2"
            >
              {loadingPurchase ? <Loader2 className="animate-spin" /> : <Save size={18} />}
              {loadingPurchase ? "Saving..." : "Save Purchase"}
            </button>
          </form>
        </div>
      </div>

      {/* Purchase History */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Purchase History</h2>
        {purchases.length === 0 ? (
          <p className="text-neutral-500">No purchases yet.</p>
        ) : (
          purchases.map((purchase) => (
            <div key={purchase._id} className="border border-white/10 rounded-2xl p-4 mb-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{purchase.supplier?.name}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(purchase.purchaseDate).toLocaleDateString()}
                  </p>
                  {purchase.invoiceNumber && (
                    <p className="text-xs text-sky-400">Invoice: {purchase.invoiceNumber}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-emerald-300 font-semibold">{formatCurrency(purchase.totalAmount)}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">
                    {purchase.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Mark as Paid Button */}
              {purchase.paymentStatus !== "PAID" && (
                <button
                  onClick={() => markAsPaid(purchase._id)}
                  className="mt-3 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
                >
                  Mark as Paid
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}