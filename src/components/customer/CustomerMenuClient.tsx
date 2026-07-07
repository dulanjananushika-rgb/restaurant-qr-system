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
  Sparkles,
  Store,
  Utensils,
  X,
} from "lucide-react";

type TableData = {
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
  image?: string;
  quantity: number;
  menuItem?: MenuItem;
  comboOffer?: ComboOffer;
};

type ActiveOrderItem = {
  _id: string;
  menuItem?: MenuItem;
  quantity: number;
  price: number;
};

type ActiveComboItem = {
  _id: string;
  comboOffer?: ComboOffer;
  quantity: number;
  price: number;
  originalPrice: number;
  comboItemsSnapshot?: {
    name: string;
    quantity: number;
    priceSnapshot: number;
  }[];
};

type ActiveOrder = {
  _id: string;
  table?: TableData;
  customerName?: string;
  customerPhone?: string;
  items: ActiveOrderItem[];
  comboItems?: ActiveComboItem[];
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
      className: "border-amber-300/30 bg-amber-400/15 text-amber-50",
      icon: Clock,
      editable: order.paymentStatus !== "PAID",
    };
  }

  if (order.status === "ACCEPTED") {
    return {
      title: "Kitchen accepted your order",
      message:
        "Your order is now locked. Please place a new order if you need extra items.",
      className: "border-sky-300/30 bg-sky-400/15 text-sky-50",
      icon: CheckCircle2,
      editable: false,
    };
  }

  if (order.status === "PREPARING") {
    return {
      title: "Your food is being prepared",
      message:
        "The kitchen has started preparing your order. Editing is no longer available.",
      className: "border-purple-300/30 bg-purple-400/15 text-purple-50",
      icon: Clock,
      editable: false,
    };
  }

  if (order.status === "READY") {
    return {
      title: "Your order is ready",
      message:
        "Your food is ready. A waiter will pick it up and deliver it to your table.",
      className: "border-emerald-300/30 bg-emerald-400/15 text-emerald-50",
      icon: CheckCircle2,
      editable: false,
    };
  }

  if (order.status === "PICKED_UP") {
    return {
      title: "Order picked up",
      message: "Your order has been picked up by the waiter.",
      className: "border-sky-300/30 bg-sky-400/15 text-sky-50",
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
      className: "border-emerald-300/30 bg-emerald-400/15 text-emerald-50",
      icon: CheckCircle2,
      editable: false,
    };
  }

  if (order.status === "CANCELLED") {
    return {
      title: "Order cancelled",
      message: "This order has been cancelled.",
      className: "border-red-300/30 bg-red-400/15 text-red-50",
      icon: AlertCircle,
      editable: false,
    };
  }

  return {
    title: "Order status updated",
    message: "Your order status has been updated.",
    className: "border-white/15 bg-white/10 text-white",
    icon: CheckCircle2,
    editable: false,
  };
}

export default function CustomerMenuClient({
  table,
  categories,
  menuItems,
  comboOffers,
}: {
  table: TableData;
  categories: Category[];
  menuItems: MenuItem[];
  comboOffers: ComboOffer[];
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

      const keyword = search.toLowerCase();

      const matchesSearch =
        item.name.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword) ||
        item.category?.name.toLowerCase().includes(keyword);

      return matchesCategory && matchesSearch && item.available;
    });
  }, [menuItems, selectedCategory, search]);

  const activeComboOffers = useMemo(() => {
    return comboOffers.filter((combo) => combo.active);
  }, [comboOffers]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const notification = getOrderNotification(activeOrder);
  const NotificationIcon = notification.icon;

  function getQuantity(id: string, type: "MENU_ITEM" | "COMBO") {
    return (
      cart.find((item) => item.id === id && item.type === type)?.quantity || 0
    );
  }

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

      if (order.status !== "PENDING") {
        setEditMode(false);
      }
    } catch {
      // Do not break customer menu if order status refresh fails.
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
      const existing = current.find(
        (item) => item.id === menuItem._id && item.type === "MENU_ITEM"
      );

      if (existing) {
        return current.map((item) =>
          item.id === menuItem._id && item.type === "MENU_ITEM"
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          id: menuItem._id,
          type: "MENU_ITEM",
          name: menuItem.name,
          price: menuItem.price,
          image: menuItem.image,
          quantity: 1,
          menuItem,
        },
      ];
    });
  }

  function addComboToCart(combo: ComboOffer) {
    setError("");

    setCart((current) => {
      const existing = current.find(
        (item) => item.id === combo._id && item.type === "COMBO"
      );

      if (existing) {
        return current.map((item) =>
          item.id === combo._id && item.type === "COMBO"
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          id: combo._id,
          type: "COMBO",
          name: combo.name,
          price: combo.offerPrice,
          image: combo.image,
          quantity: 1,
          comboOffer: combo,
        },
      ];
    });
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

  function increaseCartItem(id: string, type: "MENU_ITEM" | "COMBO") {
    setCart((current) =>
      current.map((item) =>
        item.id === id && item.type === type
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
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

  // Load existing items into cart
  for (const orderItem of activeOrder.items || []) {
    if (!orderItem.menuItem) continue;

    editableCart.push({
      id: orderItem.menuItem._id,
      type: "MENU_ITEM",
      name: orderItem.menuItem.name,
      price: Number(orderItem.price || orderItem.menuItem.price || 0),
      image: orderItem.menuItem.image,
      quantity: Number(orderItem.quantity || 1),
      menuItem: orderItem.menuItem,
    });
  }

  for (const comboItem of activeOrder.comboItems || []) {
    if (!comboItem.comboOffer) continue;

    editableCart.push({
      id: comboItem.comboOffer._id,
      type: "COMBO",
      name: comboItem.comboOffer.name,
      price: Number(comboItem.price || comboItem.comboOffer.offerPrice || 0),
      image: comboItem.comboOffer.image,
      quantity: Number(comboItem.quantity || 1),
      comboOffer: comboItem.comboOffer,
    });
  }

  setCart(editableCart);
  setCustomerName(activeOrder.customerName || "");
  setCustomerPhone(activeOrder.customerPhone || "");
  setPaymentType(activeOrder.paymentType || "PAY_LATER");
  setEditMode(true);
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
    return fetch("/api/public/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tableId: table._id,
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
  }

  async function updatePendingOrder() {
    return fetch(`/api/public/orders/${activeOrderId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        editToken,
        customerName,
        customerPhone,
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

        window.scrollTo({ top: 0, behavior: "smooth" });
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
      setError("");

      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#0E1118] text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-emerald-400/30 blur-3xl" />
        <div className="absolute right-[-130px] top-32 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-[-160px] left-20 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%)]" />
      </div>

      <section className="mx-auto max-w-5xl px-4 pb-36 pt-4">
        <header className="sticky top-3 z-30 mb-5 rounded-[32px] border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-emerald-200 shadow-lg backdrop-blur-xl">
                <Store size={22} />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                    Saffron Table
                  </p>
                  <Sparkles size={13} className="text-emerald-200" />
                </div>

                <h1 className="mt-1 truncate text-xl font-black tracking-tight">
                  {table.name}
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => totalItems > 0 && setCheckoutOpen(true)}
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur-xl transition active:scale-95"
            >
              <ShoppingBag size={21} />
              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-[11px] font-black text-black shadow-lg">
                  {totalItems}
                </span>
              )}
            </button>
          </div>

          {activeOrder && (
            <div
              className={`mt-4 rounded-[26px] border p-4 shadow-lg backdrop-blur-xl ${notification.className}`}
            >
              <div className="flex gap-3">
                <NotificationIcon className="shrink-0" size={22} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{notification.title}</p>

                    <span className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-black">
                      #{activeOrder._id.slice(-6).toUpperCase()}
                    </span>

                    <span className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-black">
                      {activeOrder.status}
                    </span>

                    <span className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-black">
                      {activeOrder.paymentStatus}
                    </span>
                  </div>

                  <p className="mt-1 text-xs leading-5 opacity-85">
                    {notification.message}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {notification.editable && (
                      <button
                        type="button"
                        onClick={startEditOrder}
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#111827]"
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
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-black text-black"
                        >
                          Continue payment
                        </button>
                      )}

                    {(activeOrder.status === "DELIVERED" ||
                      activeOrder.status === "CANCELLED") && (
                      <button
                        type="button"
                        onClick={clearCurrentOrderTracking}
                        className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-black text-white"
                      >
                        Clear notification
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-[24px] border border-white/15 bg-white/10 p-2 shadow-inner backdrop-blur-xl">
            <div className="flex items-center gap-3 px-3 py-2">
              <Search size={18} className="text-white/50" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search rice, kottu, drinks..."
                className="w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/40"
              />
            </div>
          </div>
        </header>

        {activeComboOffers.length > 0 && (
          <section className="mb-6">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200/80">
                  Special Offers
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  Combo deals
                </h2>
              </div>

              <p className="rounded-full border border-emerald-300/30 bg-emerald-300/15 px-3 py-2 text-xs font-black text-emerald-100 backdrop-blur-xl">
                Save more
              </p>
            </div>

            <div className="-mx-4 overflow-x-auto px-4 pb-2">
              <div className="flex items-stretch gap-4">
                {activeComboOffers.map((combo) => {
                  const quantity = getQuantity(combo._id, "COMBO");
                  const savings = Math.max(
                    Number(combo.originalPrice || 0) - Number(combo.offerPrice || 0),
                    0
                  );

                  return (
                    <article
                      key={combo._id}
                      className="flex h-[430px] w-[300px] shrink-0 flex-col overflow-hidden rounded-[34px] border border-emerald-300/25 bg-emerald-300/10 shadow-2xl shadow-black/25 backdrop-blur-2xl"
                    >
                      <div className="relative h-40 w-full shrink-0 bg-white/10">
                        {combo.image ? (
                          <img
                            src={combo.image}
                            alt={combo.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-white/40">
                            <Sparkles size={32} />
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />

                        <div className="absolute left-3 top-3 rounded-full border border-emerald-300/30 bg-emerald-300/20 px-3 py-1 text-xs font-black text-emerald-50 backdrop-blur-xl">
                          Combo Deal
                        </div>

                        <div className="absolute bottom-3 left-3 right-3">
                          <h3 className="line-clamp-1 text-lg font-black text-white">
                            {combo.name}
                          </h3>
                          <p className="mt-1 line-clamp-1 text-xs text-white/60">
                            {combo.description || "Special restaurant combo"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col p-4">
                        <div className="min-h-[70px] space-y-1">
                          {combo.items.slice(0, 3).map((item, index) => (
                            <p
                              key={`${combo._id}-combo-item-${index}`}
                              className="line-clamp-1 text-xs text-white/60"
                            >
                              • {item.menuItem?.name || "Menu item"} ×{" "}
                              {item.quantity}
                            </p>
                          ))}

                          {combo.items.length > 3 && (
                            <p className="text-xs text-white/40">
                              + {combo.items.length - 3} more item(s)
                            </p>
                          )}
                        </div>

                        <div className="mt-3 flex items-end justify-between gap-3">
                          <div>
                            <p className="text-xs text-white/45 line-through">
                              Rs. {combo.originalPrice}
                            </p>
                            <p className="text-2xl font-black text-emerald-100">
                              Rs. {combo.offerPrice}
                            </p>
                          </div>

                          <p className="shrink-0 rounded-full border border-emerald-300/30 bg-emerald-300/15 px-3 py-1 text-xs font-black text-emerald-100">
                            Save Rs. {savings}
                          </p>
                        </div>

                        <div className="mt-auto pt-4">
                          {quantity === 0 ? (
                            <button
                              type="button"
                              onClick={() => addComboToCart(combo)}
                              className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-gradient-to-r from-emerald-100 to-white px-4 py-3.5 text-sm font-black text-[#10141F] shadow-lg shadow-black/20 transition active:scale-[0.98]"
                            >
                              <Plus size={17} />
                              Add combo
                            </button>
                          ) : (
                            <div className="flex items-center justify-between rounded-[22px] border border-white/15 bg-white/15 p-2 text-white backdrop-blur-xl">
                              <button
                                type="button"
                                onClick={() => decreaseItem(combo._id, "COMBO")}
                                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/20 transition active:scale-95"
                              >
                                <Minus size={16} />
                              </button>

                              <span className="text-sm font-black">
                                {quantity} added
                              </span>

                              <button
                                type="button"
                                onClick={() => addComboToCart(combo)}
                                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/20 transition active:scale-95"
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
              </div>
            </div>
          </section>
        )}

        <section className="mb-5">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
                Explore Menu
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                What would you like?
              </h2>
            </div>

            <p className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white/70 backdrop-blur-xl">
              {filteredItems.length} items
            </p>
          </div>

          <div className="-mx-4 overflow-x-auto px-4 pb-2">
            <div className="flex min-w-max gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className={`rounded-full border px-5 py-2.5 text-sm font-extrabold backdrop-blur-xl transition active:scale-95 ${
                  selectedCategory === "ALL"
                    ? "border-emerald-300/40 bg-emerald-300/25 text-emerald-50 shadow-lg shadow-emerald-950/20"
                    : "border-white/15 bg-white/10 text-white/70"
                }`}
              >
                All
              </button>

              {categories.map((category) => (
                <button
                  key={category._id}
                  type="button"
                  onClick={() => setSelectedCategory(category._id)}
                  className={`rounded-full border px-5 py-2.5 text-sm font-extrabold backdrop-blur-xl transition active:scale-95 ${
                    selectedCategory === category._id
                      ? "border-emerald-300/40 bg-emerald-300/25 text-emerald-50 shadow-lg shadow-emerald-950/20"
                      : "border-white/15 bg-white/10 text-white/70"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const quantity = getQuantity(item._id, "MENU_ITEM");

            return (
              <article
                key={item._id}
                className="overflow-hidden rounded-[34px] border border-white/15 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur-2xl"
              >
                <div className="relative h-48 w-full bg-white/10">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/40">
                      <div className="text-center">
                        <Utensils className="mx-auto mb-2" size={28} />
                        <p className="text-sm font-semibold">No image</p>
                      </div>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />

                  <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/25 px-3 py-1 text-xs font-black text-white backdrop-blur-xl">
                    {item.category?.name || "Menu"}
                  </div>

                  <div className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-white/20 px-3 py-1 text-sm font-black text-white backdrop-blur-xl">
                    Rs. {item.price}
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="line-clamp-1 text-lg font-black">
                    {item.name}
                  </h3>

                  <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-white/55">
                    {item.description || "Freshly prepared restaurant item."}
                  </p>

                  <div className="mt-4">
                    {quantity === 0 ? (
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-black text-[#111827] shadow-lg shadow-black/10 transition active:scale-[0.98]"
                      >
                        <Plus size={17} />
                        Add to order
                      </button>
                    ) : (
                      <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/15 p-2 text-white backdrop-blur-xl">
                        <button
                          type="button"
                          onClick={() => decreaseItem(item._id, "MENU_ITEM")}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 transition active:scale-95"
                        >
                          <Minus size={16} />
                        </button>

                        <span className="text-sm font-black">
                          {quantity} added
                        </span>

                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 transition active:scale-95"
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
            <div className="rounded-[34px] border border-white/15 bg-white/10 p-10 text-center shadow-2xl backdrop-blur-2xl sm:col-span-2 lg:col-span-3">
              <Utensils className="mx-auto mb-3 text-white/30" size={38} />
              <h3 className="text-lg font-black">No items found</h3>
              <p className="mt-2 text-sm text-white/50">
                Try another category or search keyword.
              </p>
            </div>
          )}
        </section>
      </section>

      {totalItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-5xl rounded-[30px] border border-white/20 bg-white/15 p-3 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-4">
            <div className="pl-2">
              <p className="text-xs font-bold uppercase tracking-wide text-white/50">
                {editMode ? "Editing order" : "Your order"}
              </p>
              <p className="text-lg font-black">
                {totalItems} item{totalItems > 1 ? "s" : ""} · Rs.{" "}
                {totalAmount}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-[#111827] shadow-lg transition active:scale-[0.98]"
            >
              <ShoppingBag size={18} />
              {editMode ? "Review" : "View"}
            </button>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 px-3 py-4 backdrop-blur-md">
          <div className="mx-auto flex h-full max-w-xl flex-col overflow-hidden rounded-[38px] border border-white/20 bg-white/15 text-white shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
                  {editMode ? "Edit Order" : "Checkout"}
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  {editMode ? "Update your order" : "Your order"}
                </h2>
                <p className="text-sm text-white/50">{table.name}</p>
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
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {editMode && (
                <div className="rounded-2xl border border-amber-300/30 bg-amber-400/15 px-4 py-3 text-sm text-amber-50">
                  You can edit this order only while it is still pending. Once
                  the kitchen accepts it, editing will be locked.
                </div>
              )}

              {cart.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="rounded-3xl border border-white/15 bg-white/10 p-4"
                 >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{item.name}</p>
                      <p className="mt-1 text-sm text-white/50">
                        {item.type === "COMBO" ? "Combo" : "Menu item"} · Rs.{" "}
                        {item.price} × {item.quantity}
                      </p>
                    </div>

                    <p className="font-black">
                      Rs. {item.price * item.quantity}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => decreaseItem(item.id, item.type)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"
                    >
                      <Minus size={15} />
                    </button>

                    <span className="w-8 text-center text-sm font-black">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => increaseCartItem(item.id, item.type)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {/* Edit Mode Message - Add this block */}
                {editMode && (
                <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  You can still add more items from the menu while editing this order.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-white/80">
                    Name optional
                  </span>
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-300/60"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-white/80">
                    Phone optional
                  </span>
                  <input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="07XXXXXXXX"
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-300/60"
                  />
                </label>
              </div>

              {!editMode && (
                <div>
                  <p className="mb-2 text-sm font-black">Payment option</p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setPaymentType("PAY_LATER")}
                      className={`rounded-3xl border p-4 text-left transition ${
                        paymentType === "PAY_LATER"
                          ? "border-emerald-300/40 bg-emerald-300/20 text-white"
                          : "border-white/15 bg-white/10 text-white/70"
                      }`}
                    >
                      <p className="font-black">Pay later</p>
                      <p className="mt-1 text-xs opacity-70">
                        Pay at cashier after meal.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentType("PAY_NOW")}
                      className={`rounded-3xl border p-4 text-left transition ${
                        paymentType === "PAY_NOW"
                          ? "border-emerald-300/40 bg-emerald-300/20 text-white"
                          : "border-white/15 bg-white/10 text-white/70"
                      }`}
                    >
                      <p className="font-black">Pay now</p>
                      <p className="mt-1 text-xs opacity-70">
                        Demo online payment.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-300/30 bg-red-500/15 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-white/50">
                    Total amount
                  </p>
                  <p className="text-2xl font-black">Rs. {totalAmount}</p>
                </div>

                <p className="rounded-full border border-emerald-300/30 bg-emerald-300/15 px-3 py-1 text-xs font-black text-emerald-100">
                  {editMode
                    ? "Editing"
                    : paymentType === "PAY_LATER"
                    ? "Pay later"
                    : "Pay now"}
                </p>
              </div>

              <button
                type="button"
                disabled={loading || cart.length === 0}
                onClick={placeOrder}
                className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-black text-[#111827] shadow-lg shadow-black/10 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? editMode
                    ? "Updating order..."
                    : "Placing order..."
                  : editMode
                  ? "Save changes"
                  : paymentType === "PAY_NOW"
                  ? "Continue to payment"
                  : "Place order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}