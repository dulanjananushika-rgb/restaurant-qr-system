import { connectDB } from "@/lib/mongodb";

import InventoryItem from "@/models/InventoryItem";
import StockMovement from "@/models/StockMovement";

import InventoryManager from "@/components/admin/InventoryManager";
import InventoryStockManager from "@/components/admin/InventoryStockManager";

async function getInventoryPageData() {
  await connectDB();

  const [items, movements] = await Promise.all([
    InventoryItem.find().sort({ createdAt: -1 }).lean(),

    StockMovement.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("inventoryItem")
      .lean(),
  ]);

  return {
    items: items.map((item) => ({
      _id: item._id.toString(),
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      minQuantity: item.minQuantity,
    })),

    movements: JSON.parse(JSON.stringify(movements)),
  };
}

export default async function AdminInventoryPage() {
  const { items, movements } = await getInventoryPageData();

  const lowStockItems = items.filter(
    (item) => item.quantity <= item.minQuantity
  );

  const totalStockItems = items.length;

  const healthyStockItems = items.filter(
    (item) => item.quantity > item.minQuantity
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
        <p className="text-sm font-medium text-emerald-300">
          Inventory Management
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Manage restaurant stock
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
          View stock items, monitor low stock alerts, adjust quantities and track
          stock movement history.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Total Stock Items</p>
          <h3 className="mt-2 text-3xl font-semibold">{totalStockItems}</h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Healthy Stock</p>
          <h3 className="mt-2 text-3xl font-semibold text-emerald-300">
            {healthyStockItems.length}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Low Stock Items</p>
          <h3 className="mt-2 text-3xl font-semibold text-amber-300">
            {lowStockItems.length}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Stock Movements</p>
          <h3 className="mt-2 text-3xl font-semibold text-sky-300">
            {movements.length}
          </h3>
        </div>
      </section>

      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">Current Inventory</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Add, edit and monitor ingredient stock levels.
          </p>
        </div>

        <InventoryManager items={items} />
      </section>

      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5">
          <p className="text-sm font-medium text-emerald-300">
            Stock Control
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            Adjust stock and view movement history
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Use this section when stock arrives, stock is damaged, or quantity
            needs correction.
          </p>
        </div>

        <InventoryStockManager items={items} movements={movements} />
      </section>
    </div>
  );
}