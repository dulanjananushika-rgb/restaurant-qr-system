import Link from "next/link";
import { Plus, Search, Utensils } from "lucide-react";

type Category = {
  _id: string;
  name: string;
};

type MenuItem = {
  _id: string;
  name: string;
  price: number;
  image?: string;
  description?: string;
  available: boolean;
  category?: Category;
  createdAt: string;
};

async function getMenuItems() {
  const res = await fetch("http://localhost:3000/api/admin/menu", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch menu items");
  }

  return res.json();
}

export default async function AdminMenuPage() {
  const result = await getMenuItems();
  const menuItems: MenuItem[] = result?.data || [];

  const availableCount = menuItems.filter((item) => item.available).length;
  const unavailableCount = menuItems.filter((item) => !item.available).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 rounded-[32px] border border-white/10 bg-white/[0.03] p-6 lg:flex-row lg:items-center">
        <div>
          <p className="text-sm font-medium text-emerald-300">
            Menu Management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Manage restaurant menu items
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            Control food photos, pricing, categories and availability for QR
            dine-in and take away orders.
          </p>
        </div>

        <Link
          href="/admin/menu/new"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
        >
          <Plus size={18} />
          Add Menu Item
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Total Items</p>
          <h3 className="mt-2 text-3xl font-semibold">{menuItems.length}</h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Available</p>
          <h3 className="mt-2 text-3xl font-semibold text-emerald-300">
            {availableCount}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Unavailable</p>
          <h3 className="mt-2 text-3xl font-semibold text-amber-300">
            {unavailableCount}
          </h3>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold">Menu Items</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Food items loaded directly from MongoDB.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <Search size={18} className="text-neutral-500" />
            <input
              placeholder="Search menu item..."
              className="bg-transparent text-sm outline-none placeholder:text-neutral-600"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {menuItems.map((item) => (
            <div
              key={item._id}
              className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20 transition hover:border-emerald-400/30 hover:bg-emerald-400/5"
            >
              <div className="h-44 w-full bg-black/30">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-neutral-600">
                    <div className="text-center">
                      <Utensils className="mx-auto mb-2" size={26} />
                      <p className="text-sm">No image</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      item.available
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {item.available ? "Available" : "Unavailable"}
                  </span>

                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-400">
                    {item.category?.name || "No category"}
                  </span>
                </div>

                <h3 className="text-lg font-semibold">{item.name}</h3>

                <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-neutral-500">
                  {item.description || "No description added"}
                </p>

                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                  <p className="text-xl font-semibold">Rs. {item.price}</p>

                  <Link
                    href={`/admin/menu/${item._id}/edit`}
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 transition hover:bg-white/10"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}