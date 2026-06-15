import { PackagePlus, ShoppingBag, Utensils } from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import MenuItem from "@/models/MenuItem";
import Category from "@/models/Category";
import ComboOffer from "@/models/ComboOffer";

import TakeawayOrderManager from "@/components/cashier/TakeawayOrderManager";

export const dynamic = "force-dynamic";

async function getTakeawayPageData() {
  await connectDB();

  const [categories, menuItems, comboOffers] = await Promise.all([
    Category.find().sort({ name: 1 }).lean(),

    MenuItem.find({
      available: true,
    })
      .sort({ name: 1 })
      .populate("category")
      .lean(),

    ComboOffer.find({
      active: true,
    })
      .sort({ createdAt: -1 })
      .populate("items.menuItem")
      .lean(),
  ]);

  return {
    categories: JSON.parse(JSON.stringify(categories)),
    menuItems: JSON.parse(JSON.stringify(menuItems)),
    comboOffers: JSON.parse(JSON.stringify(comboOffers)),
  };
}

export default async function CashierTakeawayPage() {
  const { categories, menuItems, comboOffers } = await getTakeawayPageData();

  return (
    <main className="min-h-screen bg-[#0B0F14] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
          <p className="text-sm font-medium text-sky-300">
            Takeaway Workspace
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Create takeaway orders
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            Create counter pickup orders without assigning a restaurant table.
            Takeaway orders are sent to the kitchen and can be settled from the
            cashier dashboard.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
              <ShoppingBag size={21} />
            </div>

            <p className="text-sm text-neutral-500">Order Type</p>
            <h3 className="mt-2 text-2xl font-semibold text-sky-300">
              Takeaway
            </h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
              <Utensils size={21} />
            </div>

            <p className="text-sm text-neutral-500">Available Items</p>
            <h3 className="mt-2 text-3xl font-semibold text-emerald-300">
              {menuItems.length}
            </h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
              <PackagePlus size={21} />
            </div>

            <p className="text-sm text-neutral-500">Active Combos</p>
            <h3 className="mt-2 text-3xl font-semibold text-amber-300">
              {comboOffers.length}
            </h3>
          </div>
        </section>

        <TakeawayOrderManager
          categories={categories}
          menuItems={menuItems}
          comboOffers={comboOffers}
        />
      </div>
    </main>
  );
}