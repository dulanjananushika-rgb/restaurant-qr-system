
import AddMenuItemForm from "@/components/admin/AddMenuItemForm";

async function getCategories() {
  const res = await fetch("http://localhost:3000/api/admin/categories", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch categories");
  }

  return res.json();
}

export default async function NewMenuItemPage() {
  const result = await getCategories();
  const categories = result?.data || [];

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