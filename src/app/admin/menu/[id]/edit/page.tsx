import { notFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import Category from "@/models/Category";
import MenuItem from "@/models/MenuItem";
import "@/models/Category";
import EditMenuItemForm from "@/components/admin/EditMenuItemForm";

type PageParams = {
  params: Promise<{
    id: string;
  }>;
};

async function getCategories() {
  await connectDB();

  const categories = await Category.find().sort({ name: 1 }).lean();

  return categories.map((category) => ({
    _id: category._id.toString(),
    name: category.name,
  }));
}

async function getMenuItem(id: string) {
  await connectDB();

  const menuItem = await MenuItem.findById(id).populate("category").lean();

  if (!menuItem) {
    return null;
  }

  return {
    _id: menuItem._id.toString(),
    name: menuItem.name,
    price: menuItem.price,
    image: menuItem.image || "",
    description: menuItem.description || "",
    available: menuItem.available,
    category: menuItem.category
      ? {
          _id: menuItem.category._id.toString(),
          name: menuItem.category.name,
        }
      : undefined,
  };
}

export default async function EditMenuItemPage({ params }: PageParams) {
  const { id } = await params;

  const [categories, menuItem] = await Promise.all([
    getCategories(),
    getMenuItem(id),
  ]);

  if (!menuItem) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm font-medium text-emerald-300">
          Menu Management
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Edit menu item
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Update image, pricing, category and availability for restaurant
          ordering.
        </p>
      </section>

      <EditMenuItemForm menuItem={menuItem} categories={categories} />
    </div>
  );
}