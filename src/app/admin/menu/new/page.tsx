export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";


import AddMenuItemForm from "@/components/admin/AddMenuItemForm";
import { connectDB } from "@/lib/mongodb";
import Category from "@/models/Category";

async function getCategories() {
  await connectDB();
  return Category.find().sort({ createdAt: -1 }).lean();
}

export default async function NewMenuItemPage() {
  const categoryDocuments = await getCategories();
  const categories = JSON.parse(JSON.stringify(categoryDocuments));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm font-medium text-emerald-300">
          Menu Management
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Add new menu item
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Create food and drink items for QR dine-in and take away ordering.
        </p>
      </section>

      <AddMenuItemForm categories={categories} />
    </div>
  );
}
