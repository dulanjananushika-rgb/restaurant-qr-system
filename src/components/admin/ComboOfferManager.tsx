"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Gift,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type MenuItem = {
  _id: string;
  name: string;
  price: number;
  image?: string;
};

type ComboOfferItem = {
  menuItem?: MenuItem;
  quantity: number;
  priceSnapshot: number;
};

type ComboOffer = {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  items: ComboOfferItem[];
  originalPrice: number;
  offerPrice: number;
  active: boolean;
  startDate?: string;
  endDate?: string;
};

type ComboRow = {
  rowId: string;
  menuItem: string;
  quantity: string;
};

function createRow(menuItem = ""): ComboRow {
  return {
    rowId: crypto.randomUUID(),
    menuItem,
    quantity: "1",
  };
}

function formatDateForInput(date?: string) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export default function ComboOfferManager({
  comboOffers,
  menuItems,
}: {
  comboOffers: ComboOffer[];
  menuItems: MenuItem[];
}) {
  const router = useRouter();

  const [editingComboId, setEditingComboId] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [active, setActive] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [rows, setRows] = useState<ComboRow[]>([
    createRow(menuItems[0]?._id || ""),
  ]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const isEditing = Boolean(editingComboId);

  const originalPrice = useMemo(() => {
    return rows.reduce((sum, row) => {
      const menuItem = menuItems.find((item) => item._id === row.menuItem);
      const quantity = Number(row.quantity) || 0;

      return sum + (menuItem?.price || 0) * quantity;
    }, 0);
  }, [rows, menuItems]);

  const discountAmount = originalPrice - (Number(offerPrice) || 0);

  function resetForm() {
    setEditingComboId("");
    setName("");
    setDescription("");
    setImage("");
    setOfferPrice("");
    setActive(true);
    setStartDate("");
    setEndDate("");
    setRows([createRow(menuItems[0]?._id || "")]);
    setError("");
  }

  function addRow() {
    setRows((current) => [...current, createRow(menuItems[0]?._id || "")]);
  }

  function removeRow(rowId: string) {
    setRows((current) =>
      current.length === 1
        ? current
        : current.filter((row) => row.rowId !== rowId)
    );
  }

  function updateRow(rowId: string, field: "menuItem" | "quantity", value: string) {
    setRows((current) =>
      current.map((row) =>
        row.rowId === rowId ? { ...row, [field]: value } : row
      )
    );
  }

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

  function startEdit(combo: ComboOffer) {
    setEditingComboId(combo._id);
    setName(combo.name);
    setDescription(combo.description || "");
    setImage(combo.image || "");
    setOfferPrice(combo.offerPrice.toString());
    setActive(combo.active);
    setStartDate(formatDateForInput(combo.startDate));
    setEndDate(formatDateForInput(combo.endDate));
    setError("");

    setRows(
      combo.items.map((item) => ({
        rowId: crypto.randomUUID(),
        menuItem: item.menuItem?._id || "",
        quantity: item.quantity.toString(),
      }))
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    if (!name.trim()) {
      setError("Combo name is required");
      setLoading(false);
      return;
    }

    if (!offerPrice || Number(offerPrice) <= 0) {
      setError("Valid offer price is required");
      setLoading(false);
      return;
    }

    if (Number(offerPrice) > originalPrice) {
      setError("Offer price cannot be greater than original price");
      setLoading(false);
      return;
    }

    const items = rows
      .filter((row) => row.menuItem && Number(row.quantity) > 0)
      .map((row) => ({
        menuItem: row.menuItem,
        quantity: Number(row.quantity),
      }));

    if (items.length === 0) {
      setError("Please add at least one valid menu item");
      setLoading(false);
      return;
    }

    try {
      const url = isEditing
        ? `/api/admin/combo-offers/${editingComboId}`
        : "/api/admin/combo-offers";

      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          image,
          items,
          offerPrice: Number(offerPrice),
          active,
          startDate,
          endDate,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to save combo offer");
        return;
      }

      resetForm();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteCombo(comboId: string) {
    const confirmDelete = confirm("Are you sure you want to delete this combo?");

    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/admin/combo-offers/${comboId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to delete combo");
        return;
      }

      router.refresh();
    } catch {
      alert("Something went wrong while deleting combo.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5">
          <p className="text-sm font-medium text-emerald-300">
            {isEditing ? "Edit Combo Offer" : "Create Combo Offer"}
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            {isEditing ? "Update special combo" : "Build a special combo meal"}
          </h2>

          <p className="mt-1 text-sm leading-6 text-neutral-500">
            Select menu items, set quantities and create attractive offer prices.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              Combo name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Family Rice Combo"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              Description
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Perfect combo for 2 people..."
              rows={3}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              Combo image
            </span>

            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageUpload}
              disabled={uploadingImage}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-300 outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
            />
          </label>

          {uploadingImage && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              <Loader2 size={17} className="animate-spin" />
              Uploading image...
            </div>
          )}

          {image ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <img
                src={image}
                alt="Combo preview"
                className="h-48 w-full object-cover"
              />

              <div className="flex items-center justify-between border-t border-white/10 p-3">
                <p className="text-xs text-emerald-300">Image uploaded</p>

                <button
                  type="button"
                  onClick={() => setImage("")}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/10"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-neutral-600">
              <div className="text-center">
                <ImageIcon className="mx-auto mb-2" size={28} />
                <p className="text-sm">Combo image preview</p>
              </div>
            </div>
          )}

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Combo items</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Add menu items included in this combo.
                </p>
              </div>

              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-neutral-200"
              >
                <Plus size={15} />
                Add
              </button>
            </div>

            <div className="space-y-3">
              {rows.map((row, index) => {
                const selectedItem = menuItems.find(
                  (item) => item._id === row.menuItem
                );

                return (
                  <div
                    key={row.rowId}
                    className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[1.3fr_0.55fr_auto]"
                  >
                    <label>
                      <span className="mb-2 block text-xs text-neutral-500">
                        Menu item {index + 1}
                      </span>
                      <select
                        value={row.menuItem}
                        onChange={(event) =>
                          updateRow(row.rowId, "menuItem", event.target.value)
                        }
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-emerald-400/50"
                      >
                        {menuItems.map((item) => (
                          <option
                            key={item._id}
                            value={item._id}
                            className="bg-[#0B0F14]"
                          >
                            {item.name} - Rs. {item.price}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span className="mb-2 block text-xs text-neutral-500">
                        Qty
                      </span>
                      <input
                        value={row.quantity}
                        onChange={(event) =>
                          updateRow(row.rowId, "quantity", event.target.value)
                        }
                        type="number"
                        min="1"
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-emerald-400/50"
                      />
                    </label>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeRow(row.rowId)}
                        disabled={rows.length === 1}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {selectedItem && (
                      <p className="text-xs text-neutral-500 md:col-span-3">
                        Line total: Rs.{" "}
                        {(selectedItem.price * (Number(row.quantity) || 0)).toLocaleString(
                          "en-US"
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-neutral-500">Original price</p>
              <p className="mt-1 text-2xl font-semibold">
                Rs. {originalPrice.toLocaleString("en-US")}
              </p>
            </div>

            <label className="block rounded-2xl border border-white/10 bg-black/20 p-4">
              <span className="mb-2 block text-sm text-neutral-400">
                Offer price
              </span>

              <input
                value={offerPrice}
                onChange={(event) => setOfferPrice(event.target.value)}
                placeholder="3600"
                type="number"
                min="1"
                className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-neutral-700"
              />
            </label>
          </section>

          {Number(offerPrice) > 0 && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-sm text-neutral-400">Customer saves</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-300">
                Rs. {Math.max(discountAmount, 0).toLocaleString("en-US")}
              </p>
            </div>
          )}

          <section className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                Start date optional
              </span>
              <input
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                type="date"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                End date optional
              </span>
              <input
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
              />
            </label>
          </section>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Active offer</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Turn this off if the combo is temporarily unavailable.
                </p>
              </div>

              <input
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
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

          <div className="flex gap-3">
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-300 hover:bg-white/10"
              >
                <X size={17} />
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={loading || uploadingImage || menuItems.length === 0}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              {loading
                ? "Saving..."
                : isEditing
                ? "Update combo"
                : "Save combo"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Saved Combo Offers</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Manage special deals shown to customers.
          </p>
        </div>

        <div className="space-y-4">
          {comboOffers.map((combo) => (
            <div
              key={combo._id}
              className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20"
            >
              {combo.image && (
                <img
                  src={combo.image}
                  alt={combo.name}
                  className="h-44 w-full object-cover"
                />
              )}

              <div className="p-4">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                      <Gift size={20} />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">{combo.name}</p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {combo.description || "No description"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                          Original Rs. {combo.originalPrice}
                        </span>

                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                          Offer Rs. {combo.offerPrice}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            combo.active
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                              : "border-red-500/20 bg-red-500/10 text-red-300"
                          }`}
                        >
                          {combo.active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(combo)}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/10"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteCombo(combo._id)}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {combo.items.map((item, index) => (
                    <div
                      key={`${combo._id}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <p className="text-sm text-neutral-300">
                        {item.menuItem?.name || "Menu item"} × {item.quantity}
                      </p>

                      <p className="text-xs text-neutral-500">
                        Rs. {item.priceSnapshot}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {comboOffers.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-10 text-center">
              <Gift className="mx-auto mb-3 text-neutral-600" size={38} />
              <p className="text-sm text-neutral-500">
                No combo offers created yet.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}