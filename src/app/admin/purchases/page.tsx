import { connectDB } from "@/lib/mongodb";

import Supplier from "@/models/Supplier";
import InventoryItem from "@/models/InventoryItem";
import Purchase from "@/models/Purchase";

import PurchaseManager from "@/components/admin/PurchaseManager";

async function getPurchasePageData() {
  await connectDB();

  const [suppliers, inventoryItems, purchases] = await Promise.all([
    Supplier.find().sort({ createdAt: -1 }).lean(),

    InventoryItem.find().sort({ name: 1 }).lean(),

    Purchase.find()
      .sort({ createdAt: -1 })
      .populate("supplier")
      .populate("items.inventoryItem")
      .lean(),
  ]);

  return {
    suppliers: JSON.parse(JSON.stringify(suppliers)),
    inventoryItems: JSON.parse(JSON.stringify(inventoryItems)),
    purchases: JSON.parse(JSON.stringify(purchases)),
  };
}

export default async function AdminPurchasesPage() {
  const { suppliers, inventoryItems, purchases } = await getPurchasePageData();

  const totalPurchaseAmount = purchases.reduce(
    (sum: number, purchase: any) => sum + Number(purchase.totalAmount || 0),
    0
  );

  const paidPurchases = purchases.filter(
    (purchase: any) => purchase.paymentStatus === "PAID"
  ).length;

  const unpaidPurchases = purchases.filter(
    (purchase: any) => purchase.paymentStatus === "UNPAID"
  ).length;

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
        <p className="text-sm font-medium text-sky-300">
          Supplier & Purchase Management
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Manage suppliers and stock purchases
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          Create suppliers, record inventory purchases, increase stock
          automatically and keep purchase history for restaurant operations.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Suppliers</p>
          <h3 className="mt-2 text-3xl font-semibold">{suppliers.length}</h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Purchases</p>
          <h3 className="mt-2 text-3xl font-semibold text-sky-300">
            {purchases.length}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Total Cost</p>
          <h3 className="mt-2 text-2xl font-semibold text-emerald-300">
            Rs. {totalPurchaseAmount.toLocaleString("en-US")}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Payment Status</p>
          <h3 className="mt-2 text-sm font-semibold text-neutral-300">
            Paid {paidPurchases} / Unpaid {unpaidPurchases}
          </h3>
        </div>
      </section>

      <PurchaseManager
        suppliers={suppliers}
        inventoryItems={inventoryItems}
        purchases={purchases}
      />
    </div>
  );
}