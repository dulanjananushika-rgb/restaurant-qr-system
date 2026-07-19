import { connectDB } from "@/lib/mongodb";

import Category from "@/models/Category";
import MenuItem from "@/models/MenuItem";
import ComboOffer from "@/models/ComboOffer";

import TakeawayMenuClient from "@/components/customer/TakeawayMenuClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function TakeawayPage() {
  await connectDB();

  const today = new Date();

  const [
    categoryDocuments,
    menuItemDocuments,
    comboOfferDocuments,
  ] = await Promise.all([
    Category.find()
      .sort({ name: 1 })
      .lean(),

    MenuItem.find({
      available: true,
    })
      .sort({ createdAt: -1 })
      .populate("category")
      .lean(),

    ComboOffer.find({
      active: true,

      $and: [
        {
          $or: [
            {
              startDate: null,
            },
            {
              startDate: {
                $lte: today,
              },
            },
          ],
        },

        {
          $or: [
            {
              endDate: null,
            },
            {
              endDate: {
                $gte: today,
              },
            },
          ],
        },
      ],
    })
      .sort({ createdAt: -1 })
      .populate("items.menuItem")
      .lean(),
  ]);

  const categories = JSON.parse(
    JSON.stringify(categoryDocuments)
  );

  const menuItems = JSON.parse(
    JSON.stringify(menuItemDocuments)
  );

  const comboOffers = JSON.parse(
    JSON.stringify(comboOfferDocuments)
  );

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="text-sm font-semibold text-emerald-400">
            Saffron Table
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Takeaway Ordering
          </h1>

          <p className="mt-2 text-sm text-neutral-400">
            Scan the QR code, select your food
            and place a takeaway order.
          </p>
        </div>

        <TakeawayMenuClient
          categories={categories}
          menuItems={menuItems}
          comboOffers={comboOffers}
        />
      </section>
    </main>
  );
}