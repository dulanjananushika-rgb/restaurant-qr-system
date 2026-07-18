"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  PackageCheck,
  Plus,
  ReceiptText,
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

type PaymentType = "PAY_NOW" | "PAY_LATER";
type PaymentMethod = "CASH" | "CARD";

type CreatedOrder = {
  orderId: string;
  pickupNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  paymentType: PaymentType;
  paymentStatus: string;
  paymentMethod: PaymentMethod | null;
  receiptUrl: string | null;
};

type CreateOrderResponse = {
  success: boolean;
  message?: string;

  data?: CreatedOrder & {
    orderType: "TAKE_AWAY";
    table: null;
    orderStatus: string;
    paymentId: string | null;
  };
};

function formatCurrency(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

  const [selectedCategory, setSelectedCategory] =
    useState("ALL");

  const [search, setSearch] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);

  const [customerName, setCustomerName] =
    useState("");

  const [customerPhone, setCustomerPhone] =
    useState("");

  const [paymentType, setPaymentType] =
    useState<PaymentType>("PAY_LATER");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("CASH");

  const [paymentNote, setPaymentNote] =
    useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [createdOrder, setCreatedOrder] =
    useState<CreatedOrder | null>(null);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "ALL" ||
        item.category?._id === selectedCategory;

      const matchesSearch =
        keyword.length === 0 ||
        item.name.toLowerCase().includes(keyword) ||
        Boolean(
          item.description
            ?.toLowerCase()
            .includes(keyword)
        ) ||
        Boolean(
          item.category?.name
            .toLowerCase()
            .includes(keyword)
        );

      return (
        item.available &&
        matchesCategory &&
        matchesSearch
      );
    });
  }, [
    menuItems,
    search,
    selectedCategory,
  ]);

  const activeComboOffers = useMemo(() => {
    return comboOffers.filter(
      (combo) => combo.active
    );
  }, [comboOffers]);

  const totalItems = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const totalAmount = cart.reduce(
    (sum, item) =>
      sum + item.price * item.quantity,
    0
  );

  function clearMessages() {
    setError("");
    setCreatedOrder(null);
  }

  function addMenuItem(item: MenuItem) {
    clearMessages();

    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (cartItem) =>
          cartItem.id === item._id &&
          cartItem.type === "MENU_ITEM"
      );

      if (existingItem) {
        return currentCart.map((cartItem) =>
          cartItem.id === item._id &&
          cartItem.type === "MENU_ITEM"
            ? {
                ...cartItem,

                quantity: Math.min(
                  cartItem.quantity + 1,
                  50
                ),
              }
            : cartItem
        );
      }

      return [
        ...currentCart,

        {
          id: item._id,
          type: "MENU_ITEM",
          name: item.name,
          price: Number(item.price || 0),
          quantity: 1,
          image: item.image,
        },
      ];
    });
  }

  function addCombo(combo: ComboOffer) {
    clearMessages();

    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (cartItem) =>
          cartItem.id === combo._id &&
          cartItem.type === "COMBO"
      );

      if (existingItem) {
        return currentCart.map((cartItem) =>
          cartItem.id === combo._id &&
          cartItem.type === "COMBO"
            ? {
                ...cartItem,

                quantity: Math.min(
                  cartItem.quantity + 1,
                  50
                ),
              }
            : cartItem
        );
      }

      return [
        ...currentCart,

        {
          id: combo._id,
          type: "COMBO",
          name: combo.name,
          price: Number(
            combo.offerPrice || 0
          ),
          quantity: 1,
          image: combo.image,
        },
      ];
    });
  }

  function increaseItem(
    id: string,
    type: CartItem["type"]
  ) {
    clearMessages();

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === id && item.type === type
          ? {
              ...item,

              quantity: Math.min(
                item.quantity + 1,
                50
              ),
            }
          : item
      )
    );
  }

  function decreaseItem(
    id: string,
    type: CartItem["type"]
  ) {
    clearMessages();

    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === id && item.type === type
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(
    id: string,
    type: CartItem["type"]
  ) {
    clearMessages();

    setCart((currentCart) =>
      currentCart.filter(
        (item) =>
          !(
            item.id === id &&
            item.type === type
          )
      )
    );
  }

  function clearCart() {
    setCart([]);
    setError("");
    setCreatedOrder(null);
  }

  async function createTakeawayOrder() {
    setError("");
    setCreatedOrder(null);

    const cleanedCustomerName =
      customerName.trim();

    const cleanedCustomerPhone =
      customerPhone.trim();

    if (cleanedCustomerName.length < 2) {
      setError(
        "Please enter the customer name."
      );

      return;
    }

    if (
      cleanedCustomerPhone &&
      !/^[0-9+\-\s()]{7,20}$/.test(
        cleanedCustomerPhone
      )
    ) {
      setError(
        "Please enter a valid customer phone number."
      );

      return;
    }

    if (cart.length === 0) {
      setError(
        "Please add at least one item to the takeaway order."
      );

      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/cashier/takeaway-orders",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            customerName:
              cleanedCustomerName,

            customerPhone:
              cleanedCustomerPhone,

            paymentType,

            paymentMethod:
              paymentType === "PAY_NOW"
                ? paymentMethod
                : undefined,

            paymentNote:
              paymentType === "PAY_NOW"
                ? paymentNote.trim()
                : "",

            items: cart
              .filter(
                (item) =>
                  item.type === "MENU_ITEM"
              )
              .map((item) => ({
                menuItemId: item.id,
                quantity: item.quantity,
              })),

            comboItems: cart
              .filter(
                (item) =>
                  item.type === "COMBO"
              )
              .map((item) => ({
                comboOfferId: item.id,
                quantity: item.quantity,
              })),
          }),
        }
      );

      const result: CreateOrderResponse =
        await response.json();

      if (
        !response.ok ||
        !result.success ||
        !result.data
      ) {
        throw new Error(
          result.message ||
            "Failed to create takeaway order."
        );
      }

      setCreatedOrder({
        orderId: result.data.orderId,

        pickupNumber:
          result.data.pickupNumber,

        customerName:
          result.data.customerName,

        customerPhone:
          result.data.customerPhone,

        totalAmount:
          result.data.totalAmount,

        paymentType:
          result.data.paymentType,

        paymentStatus:
          result.data.paymentStatus,

        paymentMethod:
          result.data.paymentMethod,

        receiptUrl:
          result.data.receiptUrl,
      });

      /*
       * Clear the order form after successful
       * order creation.
       */
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setPaymentType("PAY_LATER");
      setPaymentMethod("CASH");
      setPaymentNote("");

      /*
       * Reload server-side cashier information.
       */
      router.refresh();
    } catch (createError) {
      console.error(
        "Create takeaway order error:",
        createError
      );

      setError(
        createError instanceof Error
          ? createError.message
          : "Something went wrong while creating the takeaway order."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Successful order */}
      {createdOrder && (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-5 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-emerald-500/15 p-3">
                <PackageCheck className="h-7 w-7 text-emerald-300" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-white">
                    Takeaway Order Created
                  </h2>

                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    {createdOrder.paymentStatus}
                  </span>
                </div>

                <p className="mt-2 text-sm text-neutral-300">
                  Give this pickup number to the
                  customer.
                </p>

                <p className="mt-3 text-4xl font-black tracking-wider text-emerald-300">
                  #{createdOrder.pickupNumber}
                </p>

                <div className="mt-4 space-y-1 text-sm text-neutral-300">
                  <p>
                    Customer:{" "}
                    <strong className="text-white">
                      {
                        createdOrder.customerName
                      }
                    </strong>
                  </p>

                  {createdOrder.customerPhone && (
                    <p>
                      Phone:{" "}
                      <strong className="text-white">
                        {
                          createdOrder.customerPhone
                        }
                      </strong>
                    </p>
                  )}

                  <p>
                    Total:{" "}
                    <strong className="text-white">
                      {formatCurrency(
                        createdOrder.totalAmount
                      )}
                    </strong>
                  </p>

                  <p>
                    Payment:{" "}
                    <strong className="text-white">
                      {createdOrder.paymentType ===
                      "PAY_NOW"
                        ? `${
                            createdOrder
                              .paymentMethod ||
                            "PAID"
                          } • PAID`
                        : "PAY AT PICKUP • UNPAID"}
                    </strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {createdOrder.receiptUrl && (
                <Link
                  href={
                    createdOrder.receiptUrl
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200"
                >
                  <ReceiptText className="h-4 w-4" />
                  View / Print Receipt
                </Link>
              )}

              <button
                type="button"
                onClick={() =>
                  setCreatedOrder(null)
                }
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/20"
              >
                Create Another Order
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        {/* Menu selection */}
        <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div>
            <p className="text-sm font-semibold text-sky-300">
              Step 1
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Select Items
            </h2>

            <p className="mt-1 text-sm text-neutral-400">
              Add menu items and combo offers
              to the takeaway cart.
            </p>
          </div>

          {/* Search */}
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <Search className="h-5 w-5 text-neutral-500" />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search menu items..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
            />
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setSelectedCategory("ALL")
              }
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                selectedCategory === "ALL"
                  ? "border-sky-400/40 bg-sky-400/15 text-sky-300"
                  : "border-white/10 bg-white/[0.03] text-neutral-400 hover:text-white"
              }`}
            >
              All
            </button>

            {categories.map((category) => (
              <button
                key={category._id}
                type="button"
                onClick={() =>
                  setSelectedCategory(
                    category._id
                  )
                }
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  selectedCategory ===
                  category._id
                    ? "border-sky-400/40 bg-sky-400/15 text-sky-300"
                    : "border-white/10 bg-white/[0.03] text-neutral-400 hover:text-white"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Combo offers */}
          {activeComboOffers.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-300">
                Combo Offers
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                {activeComboOffers.map(
                  (combo) => (
                    <article
                      key={combo._id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4"
                    >
                      <div className="min-w-0">
                        <h4 className="font-semibold text-white">
                          {combo.name}
                        </h4>

                        <p className="mt-1 line-clamp-2 text-xs text-neutral-400">
                          {combo.description ||
                            "Special combo offer"}
                        </p>

                        <p className="mt-2 text-sm font-semibold text-amber-300">
                          {formatCurrency(
                            combo.offerPrice
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          addCombo(combo)
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-neutral-200"
                        aria-label={`Add ${combo.name}`}
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </article>
                  )
                )}
              </div>
            </div>
          )}

          {/* Normal items */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-300">
              Menu Items
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              {filteredItems.map((item) => (
                <article
                  key={item._id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="min-w-0">
                    <h4 className="font-semibold text-white">
                      {item.name}
                    </h4>

                    <p className="mt-1 text-xs text-neutral-500">
                      {item.category?.name ||
                        "Menu item"}
                    </p>

                    <p className="mt-2 text-sm font-semibold text-white">
                      {formatCurrency(
                        item.price
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      addMenuItem(item)
                    }
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-neutral-200"
                    aria-label={`Add ${item.name}`}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </article>
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-neutral-500">
                No menu items found.
              </div>
            )}
          </div>
        </section>

        {/* Customer, payment and cart */}
        <div className="space-y-6">
          {/* Customer details */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-sky-300" />

              <div>
                <p className="text-sm font-semibold text-sky-300">
                  Step 2
                </p>

                <h2 className="text-lg font-semibold text-white">
                  Customer Details
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="customer-name"
                  className="mb-2 block text-sm font-medium text-neutral-300"
                >
                  Customer Name
                  <span className="ml-1 text-red-400">
                    *
                  </span>
                </label>

                <input
                  id="customer-name"
                  type="text"
                  value={customerName}
                  maxLength={80}
                  disabled={loading}
                  onChange={(event) =>
                    setCustomerName(
                      event.target.value
                    )
                  }
                  placeholder="Enter customer name"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-sky-400 disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="customer-phone"
                  className="mb-2 block text-sm font-medium text-neutral-300"
                >
                  Phone Number
                  <span className="ml-2 text-xs text-neutral-500">
                    Optional
                  </span>
                </label>

                <input
                  id="customer-phone"
                  type="tel"
                  value={customerPhone}
                  maxLength={20}
                  disabled={loading}
                  onChange={(event) =>
                    setCustomerPhone(
                      event.target.value
                    )
                  }
                  placeholder="07XXXXXXXX"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-sky-400 disabled:opacity-60"
                />
              </div>
            </div>
          </section>

          {/* Payment details */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-sky-300">
              Step 3
            </p>

            <h2 className="mt-1 text-lg font-semibold text-white">
              Payment
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  setPaymentType("PAY_LATER")
                }
                className={`rounded-xl border p-4 text-left transition ${
                  paymentType === "PAY_LATER"
                    ? "border-amber-400/40 bg-amber-400/10"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <ShoppingBag
                  className={`h-5 w-5 ${
                    paymentType === "PAY_LATER"
                      ? "text-amber-300"
                      : "text-neutral-400"
                  }`}
                />

                <p className="mt-3 font-semibold text-white">
                  Pay at Pickup
                </p>

                <p className="mt-1 text-xs leading-5 text-neutral-400">
                  Customer pays when collecting
                  the prepared order.
                </p>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  setPaymentType("PAY_NOW")
                }
                className={`rounded-xl border p-4 text-left transition ${
                  paymentType === "PAY_NOW"
                    ? "border-emerald-400/40 bg-emerald-400/10"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <Banknote
                  className={`h-5 w-5 ${
                    paymentType === "PAY_NOW"
                      ? "text-emerald-300"
                      : "text-neutral-400"
                  }`}
                />

                <p className="mt-3 font-semibold text-white">
                  Pay Now
                </p>

                <p className="mt-1 text-xs leading-5 text-neutral-400">
                  Record payment when the
                  cashier creates the order.
                </p>
              </button>
            </div>

            {paymentType === "PAY_NOW" && (
              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="payment-method"
                    className="mb-2 block text-sm font-medium text-neutral-300"
                  >
                    Payment Method
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        setPaymentMethod("CASH")
                      }
                      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        paymentMethod === "CASH"
                          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                          : "border-white/10 bg-black/20 text-neutral-400"
                      }`}
                    >
                      <Banknote className="h-4 w-4" />
                      Cash
                    </button>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        setPaymentMethod("CARD")
                      }
                      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        paymentMethod === "CARD"
                          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                          : "border-white/10 bg-black/20 text-neutral-400"
                      }`}
                    >
                      <CreditCard className="h-4 w-4" />
                      Card
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="payment-note"
                    className="mb-2 block text-sm font-medium text-neutral-300"
                  >
                    Payment Note
                    <span className="ml-2 text-xs text-neutral-500">
                      Optional
                    </span>
                  </label>

                  <input
                    id="payment-note"
                    type="text"
                    value={paymentNote}
                    maxLength={300}
                    disabled={loading}
                    onChange={(event) =>
                      setPaymentNote(
                        event.target.value
                      )
                    }
                    placeholder="Cash received / card reference"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-400 disabled:opacity-60"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Cart */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-sky-300">
                  Step 4
                </p>

                <h2 className="mt-1 text-lg font-semibold text-white">
                  Takeaway Cart
                </h2>

                <p className="mt-1 text-xs text-neutral-500">
                  {totalItems} item(s) selected
                </p>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={clearCart}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-red-300 transition hover:text-red-200 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {cart.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">
                        {item.name}
                      </p>

                      <p className="mt-1 text-xs text-neutral-500">
                        {item.type === "COMBO"
                          ? "Combo offer"
                          : "Menu item"}{" "}
                        •{" "}
                        {formatCurrency(
                          item.price
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        removeItem(
                          item.id,
                          item.type
                        )
                      }
                      className="text-red-300 transition hover:text-red-200 disabled:opacity-60"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          decreaseItem(
                            item.id,
                            item.type
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/15 disabled:opacity-60"
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <span className="min-w-8 text-center text-sm font-semibold text-white">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        disabled={
                          loading ||
                          item.quantity >= 50
                        }
                        onClick={() =>
                          increaseItem(
                            item.id,
                            item.type
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/15 disabled:opacity-60"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="font-semibold text-white">
                      {formatCurrency(
                        item.price *
                          item.quantity
                      )}
                    </p>
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                  <ShoppingBag className="mx-auto h-8 w-8 text-neutral-600" />

                  <p className="mt-3 text-sm text-neutral-500">
                    No items added yet.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5">
              <span className="text-sm text-neutral-400">
                Total Amount
              </span>

              <span className="text-2xl font-bold text-white">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            <button
              type="button"
              disabled={
                loading ||
                cart.length === 0 ||
                customerName.trim().length < 2
              }
              onClick={() =>
                void createTakeawayOrder()
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}

              {loading
                ? "Creating Order..."
                : paymentType === "PAY_NOW"
                  ? `Create & Pay ${formatCurrency(
                      totalAmount
                    )}`
                  : `Create Order ${formatCurrency(
                      totalAmount
                    )}`}
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-neutral-500">
              The final price and stock
              availability are verified by the
              server before creating the order.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}