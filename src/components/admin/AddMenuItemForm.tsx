"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImageIcon, Loader2, Save, Upload } from "lucide-react";
import Link from "next/link";

type Category = {
  _id: string;
  name: string;
};

export default function AddMenuItemForm({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(categories[0]?._id || "");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");
  const [available, setAvailable] = useState(true);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to upload image");
        return;
      }

      setImage(result.data.imageUrl);
    } catch {
      setError("Image upload failed. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    if (!name.trim()) {
      setError("Item name is required");
      setLoading(false);
      return;
    }

    if (!price || Number(price) <= 0) {
      setError("Valid price is required");
      setLoading(false);
      return;
    }

    if (!category) {
      setError("Category is required");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/menu", {
        method: "POST",
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
        setError(result.message || "Failed to create menu item");
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
            placeholder="Chicken Fried Rice"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-neutral-400">Price</span>
          <input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="1200"
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
            Menu item image
          </span>

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageUpload}
            disabled={uploadingImage}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-300 outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black disabled:cursor-not-allowed disabled:opacity-60"
          />

          <p className="mt-2 text-xs leading-5 text-neutral-500">
            Upload JPG, PNG or WEBP image. Maximum size: 5MB.
          </p>
        </label>

        {uploadingImage && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <Loader2 size={17} className="animate-spin" />
            Uploading image...
          </div>
        )}

        {image && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <img
              src={image}
              alt="Menu item preview"
              className="h-56 w-full object-cover"
            />

            <div className="flex items-center justify-between gap-3 border-t border-white/10 p-3">
              <p className="truncate text-xs text-neutral-500">
                Image uploaded successfully
              </p>

              <button
                type="button"
                onClick={() => setImage("")}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/10"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {!image && !uploadingImage && (
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
            placeholder="Short description of the food item"
            rows={3}
            className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
          />
        </label>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Available for ordering</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Turn this off if the item is temporarily unavailable.
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
            disabled={loading || uploadingImage}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : uploadingImage ? (
              <Upload size={18} />
            ) : (
              <Save size={18} />
            )}
            {loading
              ? "Saving..."
              : uploadingImage
              ? "Uploading image..."
              : "Save menu item"}
          </button>
        </div>
      </form>
    </section>
  );
}