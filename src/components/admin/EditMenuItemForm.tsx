"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImageIcon, Loader2, Save } from "lucide-react";
import Link from "next/link";

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
  category?: {
    _id: string;
    name: string;
  };
};

export default function EditMenuItemForm({
  menuItem,
  categories,
}: {
  menuItem: MenuItem;
  categories: Category[];
}) {
  const router = useRouter();

  const [name, setName] = useState(menuItem.name);
  const [price, setPrice] = useState(menuItem.price.toString());
  const [category, setCategory] = useState(
    menuItem.category?._id || categories[0]?._id || ""
  );
  const [image, setImage] = useState(menuItem.image || "");
  const [description, setDescription] = useState(menuItem.description || "");
  const [available, setAvailable] = useState(menuItem.available);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/menu/${menuItem._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          price,
          category,
          image,
          description,
          available,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to update menu item");
        return;
      }

      router.push("/admin/menu");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm text-neutral-400">
            Item name
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-neutral-400">Price</span>
          <input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            type="number"
            min="1"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-neutral-400">Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
          >
            {categories.map((item) => (
              <option key={item._id} value={item._id} className="bg-[#0B0F14]">
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-neutral-400">
            Image URL
          </span>
          <input
            value={image}
            onChange={(event) => setImage(event.target.value)}
            placeholder="https://images.unsplash.com/food-image.jpg"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
          />
        </label>

        {image && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <img
              src={image}
              alt="Menu item preview"
              className="h-56 w-full object-cover"
            />
          </div>
        )}

        {!image && (
          <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-neutral-600">
            <div className="text-center">
              <ImageIcon className="mx-auto mb-2" size={28} />
              <p className="text-sm">Image preview will appear here</p>
            </div>
          </div>
        )}

        <label className="block">
          <span className="mb-2 block text-sm text-neutral-400">
            Description
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
          />
        </label>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Available for ordering</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Turn this off when the item is sold out or temporarily stopped.
              </p>
            </div>

            <input
              checked={available}
              onChange={(event) => setAvailable(event.target.checked)}
              type="checkbox"
              className="h-5 w-5 accent-emerald-400"
            />
          </label>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Link
            href="/admin/menu"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/10"
          >
            <ArrowLeft size={18} />
            Back to menu
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {loading ? "Updating..." : "Update menu item"}
          </button>
        </div>
      </form>
    </section>
  );
}