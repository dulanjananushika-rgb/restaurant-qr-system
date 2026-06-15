"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  User,
} from "lucide-react";

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
};

type CartItem = {
  id: string;
  type: "MENU_ITEM" | "COMBO";
  name: string;
  price: number;
  quantity: number;
  image?: string;
};

function formatCurrency(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US")}`;
}

export default function TakeawayOrderManager({
  categories,
  menuItems,
  comboOffers,
}: {
  categories: Category[];
  menuItems: MenuItem[];
  comboOffers: ComboOffer[];
}) {
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentType, setPaymentType] = useState<"PAY_NOW" | "PAY_LATER">(
    "PAY_LATER"
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredItems = useMemo(() => {
    const keyword = search.toLowerCase();

    return menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "ALL" || item.category?._id === selectedCategory;

      const matchesSearch =
        item.name.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword) ||
        item.category?.name.toLowerCase().includes(keyword);

      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, search]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  function addMenuItem(item: MenuItem) {
    setError("");
    setSuccessMessage("");

    setCart((current) => {
      const existing = current.find(
        (cartItem) => cartItem.id === item._id && cartItem.type === "MENU_ITEM"
      );

      if (existing) {
        return current.map((cartItem) =>
          cartItem.id === item._id && cartItem.type === "MENU_ITEM"
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }

      return [
        ...current,
        {
          id: item._id,
          type: "MENU_ITEM",
          name: item.name,
          price: item.price,
          quantity: 1,
          image: item.image,
        },
      ];
    });
  }

  function addCombo(combo: ComboOffer) {
    setError("");
    setSuccessMessage("");

    setCart((current) => {
      const existing = current.find(
        (cartItem) => cartItem.id === combo._id && cartItem.type === "COMBO"
      );

      if (existing) {
        return current.map((cartItem) =>
          cartItem.id === combo._id && cartItem.type === "COMBO"
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }

      return [
        ...current,
        {
          id: combo._id,
          type: "COMBO",
          name: combo.name,
          price: combo.offerPrice,
          quantity: 1,
          image: combo.image,
        },
      ];
    });
  }

  function increaseItem(id: string, type: "MENU_ITEM" | "COMBO") {
    setCart((current) =>
      current.map((item) =>
        item.id === id && item.type === type
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  }

  function decreaseItem(id: string, type: "MENU_ITEM" | "COMBO") {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id && item.type === type
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(id: string, type: "MENU_ITEM" | "COMBO") {
    setCart((current) =>
      current.filter((item) => !(item.id === id && item.type === type))
    );
  }

  async function createTakeawayOrder() {
    setError("");
    setSuccessMessage("");

    if (cart.length === 0) {
      setError("Please add at least one item to the takeaway order.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/cashier/takeaway-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName,
          customerPhone,
          paymentType,
          items: cart
            .filter((item) => item.type === "MENU_ITEM")
            .map((item) => ({
              menuItemId: item.id,
              quantity: item.quantity,
            })),
          comboItems: cart
            .filter((item) => item.type === "COMBO")
            .map((item) => ({
              comboOfferId: item.id,
              quantity: item.quantity,
            })),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to create takeaway order");
        return;
      }

      setSuccessMessage(
        `Takeaway Order #${result.data.orderId
          .slice(-6)
          .toUpperCase()} created successfully.`
      );

      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setPaymentType("PAY_LATER");

      router.refresh();
    } catch {
      setError("Something went wrong while creating takeaway order.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        {successMessage && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center gap-3">
            <Search className="text-sky-300" size={20} />
            <div>
              <h2 className="text-lg font-semibold">Select items</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Add menu items and combo offers to the takeaway cart.
              </p>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <Search size={17} className="text-neutral-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search menu items..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-600"
            />
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                selectedCategory === "ALL"
                  ? "border-sky-400/40 bg-sky-400/15 text-sky-300"
                  : "border-white/10 bg-white/[0.03] text-neutral-400"
              }`}
            >
              All
            </button>

            {categories.map((category) => (
              <button
                key={category._id}
                type="button"
                onClick={() => setSelectedCategory(category._id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                  selectedCategory === category._id
                    ? "border-sky-400/40 bg-sky-400/15 text-sky-300"
                    : "border-white/10 bg-white/[0.03] text-neutral-400"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {comboOffers.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-amber-300">
                Combo Offers
              </h3>

              <div className="grid gap-3 md:grid-cols-2">
                {comboOffers.map((combo) => (
                  <article
                    key={combo._id}
                    className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-amber-100">
                          {combo.name}
                        </p>
                        <p className="mt-1 text-xs text-neutral-400">
                          {combo.description || "Special combo offer"}
                        </p>
                        <p className="mt-2 text-sm font-bold text-amber-300">
                          {formatCurrency(combo.offerPrice)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => addCombo(combo)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black"
                      >
                        <Plus size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {filteredItems.map((item) => (
              <article
                key={item._id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.category?.name || "Menu item"}
                    </p>
                    <p className="mt-2 text-sm font-bold text-emerald-300">
                      {formatCurrency(item.price)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => addMenuItem(item)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black"
                  >
                    <Plus size={17} />
                  </button>
                </div>
              </article>
            ))}

            {filteredItems.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-neutral-500 md:col-span-2">
                No menu items found.
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-6">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center gap-3">
            <User className="text-emerald-300" size={20} />
            <div>
              <h2 className="text-lg font-semibold">Takeaway details</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Customer and payment information.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                Customer name optional
              </span>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer name"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                Phone optional
              </span>
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="07XXXXXXXX"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                Payment type
              </span>

              <select
                value={paymentType}
                onChange={(event) =>
                  setPaymentType(event.target.value as "PAY_NOW" | "PAY_LATER")
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
              >
                <option value="PAY_LATER" className="bg-[#0B0F14]">
                  PAY_LATER
                </option>
                <option value="PAY_NOW" className="bg-[#0B0F14]">
                  PAY_NOW
                </option>
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center gap-3">
            <ShoppingBag className="text-sky-300" size={20} />
            <div>
              <h2 className="text-lg font-semibold">Takeaway cart</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {totalItems} item(s) selected.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.type === "COMBO" ? "Combo" : "Menu item"} •{" "}
                      {formatCurrency(item.price)} × {item.quantity}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id, item.type)}
                    className="text-red-300"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => decreaseItem(item.id, item.type)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10"
                    >
                      <Minus size={14} />
                    </button>

                    <span className="w-8 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => increaseItem(item.id, item.type)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <p className="text-sm font-semibold text-emerald-300">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-neutral-500">
                No items added yet.
              </div>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-sm text-neutral-400">Total amount</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-300">
              {formatCurrency(totalAmount)}
            </p>
          </div>

          <button
            type="button"
            disabled={loading || cart.length === 0}
            onClick={createTakeawayOrder}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            {loading ? "Creating order..." : "Create takeaway order"}
          </button>
        </div>
      </aside>
    </section>
  );
}