import { connectDB } from "@/lib/mongodb";
import Category from "@/models/Category";
import MenuItem from "@/models/MenuItem";
import ComboOffer from "@/models/ComboOffer";
import TakeawayMenuClient from "@/components/customer/TakeawayMenuClient";

export default async function TakeawayPage() {
  await connectDB();

  const [categories, menuItems, comboOffers] = await Promise.all([
    Category.find().sort({ name: 1 }).lean(),
    MenuItem.find({ available: true }).populate("category").lean(),
    ComboOffer.find({ active: true }).lean(),
  ]);

  return (
    <main className="min-h-screen bg-[#0E1118] text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black tracking-tight">Takeaway Ordering</h1>
          <p className="mt-2 text-lg text-white/60">
            Scan QR and place your takeaway order
          </p>
        </div>

        <TakeawayMenuClient
          categories={JSON.parse(JSON.stringify(categories))}
          menuItems={JSON.parse(JSON.stringify(menuItems))}
          comboOffers={JSON.parse(JSON.stringify(comboOffers))}
        />
      </div>
    </main>
  );
}