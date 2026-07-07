"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";

type Table = {
  _id: string;
  name: string;
  capacity: number;
  qrCode: string;
  status: string;
};

type Category = {
  _id: string;
  name: string;
  description?: string;
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

type CartItem = {
  menuItem: MenuItem;
  quantity: number;
};

type ActiveOrderItem = {
  _id: string;
  menuItem?: MenuItem;
  quantity: number;
  price: number;
};

type ActiveOrder = {
  _id: string;
  table?: Table;
  customerName?: string;
  customerPhone?: string;
  items: ActiveOrderItem[];
  totalAmount: number;
  status:
    | "PENDING"
    | "ACCEPTED"
    | "PREPARING"
    | "READY"
    | "PICKED_UP"
    | "DELIVERED"
    | "CANCELLED";
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "PARTIALLY_PAID";
  paymentType: "PAY_NOW" | "PAY_LATER";
  createdAt: string;
};

function formatCurrency(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US")}`;
}

function getOrderStorageKey(tableId: string) {
  return `restaurant_active_order_${tableId}`;
}

function getOrderNotification(order: ActiveOrder | null) {
  if (!order) {
    return {
      title: "",
      message: "",
      className: "",
      icon: CheckCircle2,
      editable: false,
    };
  }

  if (order.status === "PENDING") {
    return {
      title: "Order waiting for kitchen acceptance",
      message:
        "Your order is placed. You can still edit it until the kitchen accepts it.",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      icon: Clock,
      editable: order.paymentStatus !== "PAID",
    };
  }

  if (order.status === "ACCEPTED") {
    return {
      title: "Kitchen accepted your order",
      message:
        "Your order is now locked. Please place a new order if you need extra items.",
      className: "border-sky-200 bg-sky-50 text-sky-800",
      icon: CheckCircle2,
      editable: false,
    };
  }

  if (order.status === "PREPARING") {
    return {
      title: "Your food is being prepared",
      message:
        "The kitchen has started preparing your order. Editing is no longer available.",
      className: "border-purple-200 bg-purple-50 text-purple-800",
      icon: Clock,
      editable: false,
    };
  }

  if (order.status === "READY") {
    return {
      title: "Your order is ready",
      message:
        "Your food is ready. A waiter will pick it up and deliver it to your table.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: CheckCircle2,
      editable: false,
    };
  }

  if (order.status === "PICKED_UP") {
    return {
      title: "Order picked up",
      message: "Your order has been picked up by the waiter.",
      className: "border-sky-200 bg-sky-50 text-sky-800",
      icon: ShoppingBag,
      editable: false,
    };
  }

  if (order.status === "DELIVERED") {
    return {
      title: "Order delivered",
      message:
        order.paymentStatus === "PAID"
          ? "Your order has been delivered and payment is complete."
          : "Your order has been delivered. Please settle payment at the cashier.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: CheckCircle2,
      editable: false,
    };
  }

  if (order.status === "CANCELLED") {
    return {
      title: "Order cancelled",
      message: "This order has been cancelled.",
      className: "border-red-200 bg-red-50 text-red-800",
      icon: AlertCircle,
      editable: false,
    };
  }

  return {
    title: "Order status updated",
    message: "Your order status has been updated.",
    className: "border-neutral-200 bg-white text-neutral-700",
    icon: CheckCircle2,
    editable: false,
  };
}

export default function CustomerMenu({
  table,
  categories,
  menuItems,
}: {
  table: Table;
  categories: Category[];
  menuItems: MenuItem[];
}) {
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentType, setPaymentType] = useState<"PAY_NOW" | "PAY_LATER">(
    "PAY_LATER"
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "CARD" | "ONLINE" | "NOT_SELECTED"
  >("NOT_SELECTED");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [activeOrderId, setActiveOrderId] = useState("");
  const [editToken, setEditToken] = useState("");
  const [editMode, setEditMode] = useState(false);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "ALL" || item.category?._id === selectedCategory;

      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());

      return matchesCategory && matchesSearch && item.available;
    });
  }, [menuItems, selectedCategory, search]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0
  );

  const notification = getOrderNotification(activeOrder);
  const NotificationIcon = notification.icon;

  async function loadActiveOrder(orderId: string) {
    try {
      const response = await fetch(`/api/public/orders/${orderId}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return;
      }

      const order = result.data as ActiveOrder;
      setActiveOrder(order);

      if (order.status === "DELIVERED" || order.status === "CANCELLED") {
        // Keep notification visible, but stop edit mode if completed/cancelled.
        setEditMode(false);
      }
    } catch {
      // Customer page should not crash if status refresh fails.
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem(getOrderStorageKey(table._id));

    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as {
        orderId?: string;
        editToken?: string;
      };

      if (parsed.orderId) {
        setActiveOrderId(parsed.orderId);
        setEditToken(parsed.editToken || "");
        loadActiveOrder(parsed.orderId);
      }
    } catch {
      localStorage.removeItem(getOrderStorageKey(table._id));
    }
  }, [table._id]);

  useEffect(() => {
    if (!activeOrderId) return;

    const interval = setInterval(() => {
      loadActiveOrder(activeOrderId);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeOrderId]);

  function addToCart(menuItem: MenuItem) {
    setError("");

    setCart((current) => {
      const existing = current.find((item) => item.menuItem._id === menuItem._id);

      if (existing) {
        return current.map((item) =>
          item.menuItem._id === menuItem._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...current, { menuItem, quantity: 1 }];
    });
  }

  function decreaseItem(menuItemId: string) {
    setCart((current) =>
      current
        .map((item) =>
          item.menuItem._id === menuItemId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function getQuantity(menuItemId: string) {
    return cart.find((item) => item.menuItem._id === menuItemId)?.quantity || 0;
  }

  function startEditOrder() {
    if (!activeOrder || activeOrder.status !== "PENDING") {
      setError(
        "Kitchen has already accepted this order. Please place a new order for extra items."
      );
      return;
    }

    if (activeOrder.paymentStatus === "PAID") {
      setError(
        "This order is already paid. Please place a new order for extra items."
      );
      return;
    }

    const editableCart: CartItem[] = [];

    for (const orderItem of activeOrder.items || []) {
      if (!orderItem.menuItem) continue;

      editableCart.push({
        menuItem: orderItem.menuItem,
        quantity: orderItem.quantity,
      });
    }

    setCart(editableCart);
    setCustomerName(activeOrder.customerName || "");
    setCustomerPhone(activeOrder.customerPhone || "");
    setPaymentType(activeOrder.paymentType || "PAY_LATER");
    setPaymentMethod(
      activeOrder.paymentType === "PAY_NOW" ? "ONLINE" : "NOT_SELECTED"
    );
    setEditMode(true);
    setCheckoutOpen(true);
    setError("");
  }

  function clearCurrentOrderTracking() {
    localStorage.removeItem(getOrderStorageKey(table._id));
    setActiveOrder(null);
    setActiveOrderId("");
    setEditToken("");
    setEditMode(false);
  }

  async function createOrder() {
    const response = await fetch("/api/public/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tableId: table._id,
        customerName,
        customerPhone,
        paymentType,
        paymentMethod,
        items: cart.map((item) => ({
          menuItemId: item.menuItem._id,
          quantity: item.quantity,
        })),
      }),
    });

    return response;
  }

  async function updatePendingOrder() {
    const response = await fetch(`/api/public/orders/${activeOrderId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        editToken,
        customerName,
        customerPhone,
        items: cart.map((item) => ({
          menuItemId: item.menuItem._id,
          quantity: item.quantity,
        })),
      }),
    });

    return response;
  }

  async function placeOrder() {
    setError("");

    if (cart.length === 0) {
      setError("Please add at least one item to your order.");
      return;
    }

    setLoading(true);

    try {
      const response = editMode ? await updatePendingOrder() : await createOrder();
      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to place order");
        return;
      }

      if (editMode) {
        const updatedOrder = result.data as ActiveOrder;

        setActiveOrder(updatedOrder);
        setCart([]);
        setCheckoutOpen(false);
        setEditMode(false);
        setError("");

        if (updatedOrder.paymentType === "PAY_NOW") {
          router.push(`/payment/${updatedOrder._id}`);
          return;
        }

        router.refresh();
        return;
      }

      const orderId =
        result.data?.orderId ||
        result.data?._id ||
        result.orderId ||
        result.order?._id;

      const returnedEditToken = result.data?.editToken || "";

      if (!orderId) {
        setError("Order was created, but order ID was not returned.");
        return;
      }

      localStorage.setItem(
        getOrderStorageKey(table._id),
        JSON.stringify({
          orderId,
          editToken: returnedEditToken,
        })
      );

      setActiveOrderId(orderId);
      setEditToken(returnedEditToken);

      await loadActiveOrder(orderId);

      if (paymentType === "PAY_NOW") {
        router.push(`/payment/${orderId}`);
        return;
      }

      setCart([]);
      setCheckoutOpen(false);
      setCustomerName("");
      setCustomerPhone("");
      setPaymentType("PAY_LATER");
      setPaymentMethod("NOT_SELECTED");
      setError("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F5EF] text-[#1C1A16]">
      <section className="mx-auto max-w-6xl px-4 pb-28 pt-5">
        <header className="sticky top-0 z-20 -mx-4 border-b border-black/5 bg-[#F8F5EF]/90 px-4 pb-4 pt-3 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1C1A16] text-white">
                <Store size={23} />
              </div>

              <div>
                <p className="text-xs font-medium text-emerald-700">
                  Welcome to Saffron Table
                </p>
                <h1 className="text-xl font-bold tracking-tight">
                  {table.name}
                </h1>
              </div>
            </div>

            <div className="rounded-2xl bg-white px-4 py-2 text-right shadow-sm">
              <p className="text-xs text-neutral-500">Table</p>
              <p className="text-sm font-semibold">{table.name}</p>
            </div>
          </div>

          {activeOrder && (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${notification.className}`}
            >
              <div className="flex items-start gap-3">
                <NotificationIcon size={19} className="mt-0.5 shrink-0" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{notification.title}</p>

                    <span className="rounded-full bg-black/10 px-2.5 py-1 text-[11px] font-bold">
                      #{activeOrder._id.slice(-6).toUpperCase()}
                    </span>

                    <span className="rounded-full bg-black/10 px-2.5 py-1 text-[11px] font-bold">
                      {activeOrder.status}
                    </span>

                    <span className="rounded-full bg-black/10 px-2.5 py-1 text-[11px] font-bold">
                      {activeOrder.paymentStatus}
                    </span>
                  </div>

                  <p className="mt-1 leading-5">{notification.message}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {notification.editable && (
                      <button
                        type="button"
                        onClick={startEditOrder}
                        className="inline-flex items-center gap-2 rounded-xl bg-black px-3 py-2 text-xs font-bold text-white"
                      >
                        <Edit3 size={14} />
                        Edit order
                      </button>
                    )}

                    {activeOrder.paymentType === "PAY_NOW" &&
                      activeOrder.paymentStatus !== "PAID" && (
                        <button
                          type="button"
                          onClick={() => router.push(`/payment/${activeOrder._id}`)}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
                        >
                          Continue payment
                        </button>
                      )}

                    {(activeOrder.status === "DELIVERED" ||
                      activeOrder.status === "CANCELLED") && (
                      <button
                        type="button"
                        onClick={clearCurrentOrderTracking}
                        className="inline-flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-black"
                      >
                        Clear notification
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <Search size={18} className="text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search food or drinks..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
            />
          </div>
        </header>

        <section className="mt-5 overflow-x-auto pb-2">
          <div className="flex min-w-max gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                selectedCategory === "ALL"
                  ? "bg-[#1C1A16] text-white"
                  : "bg-white text-neutral-600"
              }`}
            >
              All
            </button>

            {categories.map((category) => (
              <button
                key={category._id}
                type="button"
                onClick={() => setSelectedCategory(category._id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedCategory === category._id
                    ? "bg-[#1C1A16] text-white"
                    : "bg-white text-neutral-600"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const quantity = getQuantity(item._id);

            return (
              <article
                key={item._id}
                className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-black/5"
              >
                <div className="h-48 w-full bg-neutral-100">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
                      No image
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">{item.name}</h2>
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        {item.category?.name || "Food item"}
                      </p>
                    </div>

                    <p className="rounded-full bg-[#F8F5EF] px-3 py-1 text-sm font-bold">
                      {formatCurrency(item.price)}
                    </p>
                  </div>

                  <p className="line-clamp-2 min-h-10 text-sm leading-5 text-neutral-500">
                    {item.description || "Freshly prepared restaurant item."}
                  </p>

                  <div className="mt-4">
                    {quantity === 0 ? (
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1C1A16] px-4 py-3 text-sm font-bold text-white transition hover:bg-black"
                      >
                        <Plus size={17} />
                        Add to Order
                      </button>
                    ) : (
                      <div className="flex items-center justify-between rounded-2xl bg-[#1C1A16] px-3 py-2 text-white">
                        <button
                          type="button"
                          onClick={() => decreaseItem(item._id)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"
                        >
                          <Minus size={16} />
                        </button>

                        <span className="text-sm font-bold">
                          {quantity} added
                        </span>

                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="rounded-3xl bg-white p-8 text-center text-sm text-neutral-500 md:col-span-2 lg:col-span-3">
              No menu items found.
            </div>
          )}
        </section>
      </section>

      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/10 bg-white p-4 shadow-2xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">{totalItems} items</p>
              <p className="text-lg font-bold">{formatCurrency(totalAmount)}</p>
            </div>

            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-[#1C1A16] px-5 py-3 text-sm font-bold text-white"
            >
              <ShoppingBag size={18} />
              {editMode ? "Review Changes" : "View Order"}
            </button>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto flex max-h-full max-w-xl flex-col overflow-hidden rounded-[30px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 p-5">
              <div>
                <h2 className="text-xl font-bold">
                  {editMode ? "Edit Your Order" : "Your Order"}
                </h2>
                <p className="text-sm text-neutral-500">{table.name}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCheckoutOpen(false);

                  if (editMode) {
                    setEditMode(false);
                    setCart([]);
                  }
                }}
                className="rounded-full bg-neutral-100 p-2"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {editMode && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  You can edit this order only while it is still pending. Once
                  the kitchen accepts it, editing will be locked.
                </div>
              )}

              {cart.map((item) => (
                <div
                  key={item.menuItem._id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 p-3"
                >
                  <div>
                    <p className="font-semibold">{item.menuItem.name}</p>
                    <p className="text-sm text-neutral-500">
                      {formatCurrency(item.menuItem.price)} × {item.quantity}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => decreaseItem(item.menuItem._id)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100"
                    >
                      <Minus size={15} />
                    </button>

                    <span className="min-w-5 text-center text-sm font-bold">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => addToCart(item.menuItem)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100"
                    >
                      <Plus size={15} />
                    </button>

                    <p className="w-20 text-right font-bold">
                      {formatCurrency(item.menuItem.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
              {/* Edit Mode Message - Add this block */}
{editMode && (
  <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
    You can still add more items from the menu while editing this order.
  </div>
)}

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">
                  Customer name optional
                </span>
                <input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">
                  Phone number optional
                </span>
                <input
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="07XXXXXXXX"
                  className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </label>

              {!editMode && (
                <div>
                  <p className="mb-2 text-sm font-semibold">Payment option</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType("PAY_LATER");
                        setPaymentMethod("NOT_SELECTED");
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left ${
                        paymentType === "PAY_LATER"
                          ? "border-black bg-black text-white"
                          : "border-black/10 bg-white"
                      }`}
                    >
                      <p className="font-bold">Pay Later</p>
                      <p className="mt-1 text-xs opacity-70">
                        Pay at cashier after meal.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType("PAY_NOW");
                        setPaymentMethod("ONLINE");
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left ${
                        paymentType === "PAY_NOW"
                          ? "border-black bg-black text-white"
                          : "border-black/10 bg-white"
                      }`}
                    >
                      <p className="font-bold">Pay Now</p>
                      <p className="mt-1 text-xs opacity-70">
                        Demo online payment.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="border-t border-black/10 p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-neutral-500">Total</span>
                <span className="text-2xl font-bold">
                  {formatCurrency(totalAmount)}
                </span>
              </div>

              <button
                type="button"
                disabled={loading || cart.length === 0}
                onClick={placeOrder}
                className="w-full rounded-2xl bg-[#1C1A16] px-5 py-4 text-sm font-bold text-white disabled:opacity-60"
              >
                {loading
                  ? editMode
                    ? "Updating order..."
                    : "Placing order..."
                  : editMode
                  ? "Save Changes"
                  : paymentType === "PAY_NOW"
                  ? "Continue to Payment"
                  : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}