import {
  PackagePlus,
  ShoppingBag,
  Utensils,
} from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import MenuItem from "@/models/MenuItem";
import Category from "@/models/Category";
import ComboOffer from "@/models/ComboOffer";
import Order from "@/models/Order";

import TakeawayOrderManager from "@/components/cashier/TakeawayOrderManager";
import TakeawayPickupManager from "@/components/cashier/TakeawayPickupManager";

import "@/models/Table";
import "@/models/User";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getTakeawayPageData() {
  await connectDB();

  const [
    categories,
    menuItems,
    comboOffers,
    takeawayOrders,
  ] = await Promise.all([
    Category.find()
      .sort({
        name: 1,
      })
      .lean(),

    MenuItem.find({
      available: true,
    })
      .sort({
        name: 1,
      })
      .populate("category")
      .lean(),

    ComboOffer.find({
      active: true,
    })
      .sort({
        createdAt: -1,
      })
      .populate("items.menuItem")
      .lean(),

    Order.find({
      orderType: "TAKE_AWAY",

      status: {
        $in: [
          "PENDING",
          "ACCEPTED",
          "PREPARING",
          "READY",
          "PICKED_UP",
        ],
      },
    })
      .sort({
        createdAt: -1,
      })
      .limit(100)
      .populate("items.menuItem")
      .populate("comboItems.comboOffer")
      .lean(),
  ]);

  return {
    categories: JSON.parse(
      JSON.stringify(categories)
    ),

    menuItems: JSON.parse(
      JSON.stringify(menuItems)
    ),

    comboOffers: JSON.parse(
      JSON.stringify(comboOffers)
    ),

    takeawayOrders: JSON.parse(
      JSON.stringify(takeawayOrders)
    ),
  };
}

export default async function CashierTakeawayPage() {
  const {
    categories,
    menuItems,
    comboOffers,
    takeawayOrders,
  } = await getTakeawayPageData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-sky-400">
          Takeaway Workspace
        </p>

        <h1 className="mt-2 text-3xl font-bold text-white">
          Cashier Takeaway Orders
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
          Create restaurant counter pickup orders without
          assigning dining tables. Monitor kitchen progress,
          collect payments and hand prepared orders to
          customers.
        </p>
      </div>

      {/* Page summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-400">
              Order Type
            </p>

            <ShoppingBag className="h-5 w-5 text-sky-300" />
          </div>

          <p className="mt-3 text-xl font-bold text-white">
            Takeaway
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            Restaurant counter pickup
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-400">
              Available Items
            </p>

            <Utensils className="h-5 w-5 text-emerald-300" />
          </div>

          <p className="mt-3 text-3xl font-bold text-white">
            {menuItems.length}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-400">
              Active Combos
            </p>

            <PackagePlus className="h-5 w-5 text-amber-300" />
          </div>

          <p className="mt-3 text-3xl font-bold text-white">
            {comboOffers.length}
          </p>
        </div>
      </div>

      {/* Existing takeaway orders */}
      <TakeawayPickupManager orders={takeawayOrders} />

      {/* Create a new takeaway order */}
      <section>
        <div className="mb-5 border-t border-white/10 pt-8">
          <p className="text-sm font-semibold text-sky-400">
            New Counter Order
          </p>

          <h2 className="mt-1 text-2xl font-bold text-white">
            Create Takeaway Order
          </h2>

          <p className="mt-2 text-sm text-neutral-400">
            Select customer items, choose the payment option
            and send the order to the kitchen.
          </p>
        </div>

        <TakeawayOrderManager
          categories={categories}
          menuItems={menuItems}
          comboOffers={comboOffers}
        />
      </section>
    </div>
  );
}