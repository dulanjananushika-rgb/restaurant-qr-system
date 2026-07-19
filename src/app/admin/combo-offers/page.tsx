import { connectDB } from "@/lib/mongodb";

import ComboOffer from "@/models/ComboOffer";
import MenuItem from "@/models/MenuItem";
import "@/models/Category";

import ComboOfferManager from "@/components/admin/ComboOfferManager";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

async function getComboOfferData() {
  await connectDB();

  const [comboOffers, menuItems] = await Promise.all([
    ComboOffer.find()
      .sort({ createdAt: -1 })
      .populate("items.menuItem")
      .lean(),

    MenuItem.find({ available: true }).sort({ name: 1 }).lean(),
  ]);

  return {
    comboOffers: JSON.parse(JSON.stringify(comboOffers)),
    menuItems: JSON.parse(JSON.stringify(menuItems)),
  };
}

export default async function AdminComboOffersPage() {
  const { comboOffers, menuItems } = await getComboOfferData();

  const activeOffers = comboOffers.filter((offer: any) => offer.active);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm font-medium text-emerald-300">
          Special Offers
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Manage combo meals and offers
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          Create combo meals using existing menu items, set attractive offer
          prices and show them on the customer QR menu.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Total Combos</p>
          <h3 className="mt-2 text-3xl font-semibold">
            {comboOffers.length}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Active Offers</p>
          <h3 className="mt-2 text-3xl font-semibold text-emerald-300">
            {activeOffers.length}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Menu Items</p>
          <h3 className="mt-2 text-3xl font-semibold text-amber-300">
            {menuItems.length}
          </h3>
        </div>
      </section>

      <ComboOfferManager comboOffers={comboOffers} menuItems={menuItems} />
    </div>
  );
}