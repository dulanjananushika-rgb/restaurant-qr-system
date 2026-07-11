"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TakeawayMenuClient({
  categories,
  menuItems,
  comboOffers,
}: {
  categories: any[];
  menuItems: any[];
  comboOffers: any[];
}) {
  const router = useRouter();

  const [cart, setCart] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentType, setPaymentType] = useState<"PAY_NOW" | "PAY_LATER">("PAY_LATER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Add Menu Item
  function addMenuItem(item: any) {
    setCart((current) => {
      const existing = current.find((i) => i.id === item._id && i.type === "MENU_ITEM");
      if (existing) {
        return current.map((i) =>
          i.id === item._id && i.type === "MENU_ITEM"
            ? { ...i, quantity: i.quantity + 1 }
            : i
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
        },
      ];
    });
  }

  // Add Combo Offer
  function addCombo(combo: any) {
    setCart((current) => {
      const existing = current.find((i) => i.id === combo._id && i.type === "COMBO");
      if (existing) {
        return current.map((i) =>
          i.id === combo._id && i.type === "COMBO"
            ? { ...i, quantity: i.quantity + 1 }
            : i
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
        },
      ];
    });
  }

  // Decrease quantity
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

  // Increase quantity
  function increaseItem(id: string, type: "MENU_ITEM" | "COMBO") {
    setCart((current) =>
      current.map((item) =>
        item.id === id && item.type === type
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  }

  async function placeTakeawayOrder() {
    if (cart.length === 0) {
      setError("Please add at least one item");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "TAKE_AWAY",
          tableId: null,
          customerName,
          customerPhone,
          paymentType,
          items: cart
            .filter((i) => i.type === "MENU_ITEM")
            .map((i) => ({ menuItemId: i.id, quantity: i.quantity })),
          comboItems: cart
            .filter((i) => i.type === "COMBO")
            .map((i) => ({ comboOfferId: i.id, quantity: i.quantity })),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to place order");
        return;
      }

      const orderId = result.data?.orderId || result.data?._id;

      if (paymentType === "PAY_NOW" && orderId) {
        router.push(`/payment/${orderId}`);
      } else {
        alert("Takeaway order placed successfully!");
        setCart([]);
        router.refresh();
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Menu Items + Combos */}
      <div className="space-y-8">
        {/* Menu Items */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Menu Items</h2>
          {menuItems.map((item: any) => (
            <div key={item._id} className="flex justify-between items-center border-b border-white/10 py-3">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-white/60">Rs. {item.price}</p>
              </div>
              <button
                onClick={() => addMenuItem(item)}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-sm font-bold transition"
              >
                Add
              </button>
            </div>
          ))}
        </div>

        {/* Combo Offers */}
        {comboOffers.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Combo Offers</h2>
            {comboOffers.map((combo: any) => (
              <div key={combo._id} className="flex justify-between items-center border-b border-white/10 py-3">
                <div>
                  <p className="font-semibold">{combo.name}</p>
                  <p className="text-sm text-white/60 line-through">Rs. {combo.originalPrice}</p>
                  <p className="text-emerald-400 font-bold">Rs. {combo.offerPrice}</p>
                </div>
                <button
                  onClick={() => addCombo(combo)}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-sm font-bold transition"
                >
                  Add Combo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Section */}
      <div className="bg-white/5 p-6 rounded-3xl">
        <h2 className="text-2xl font-bold mb-4">Your Takeaway Order</h2>

        {cart.length === 0 && <p className="text-white/50 mb-6">No items added yet</p>}

        {cart.map((item, index) => (
          <div key={index} className="flex justify-between items-center py-3 border-b border-white/10">
            <div>
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-white/60">Rs. {item.price} × {item.quantity}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => decreaseItem(item.id, item.type)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-lg"
              >
                −
              </button>
              <span className="w-6 text-center font-bold">{item.quantity}</span>
              <button
                onClick={() => increaseItem(item.id, item.type)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-lg"
              >
                +
              </button>
            </div>
          </div>
        ))}

        <div className="mt-6 space-y-4">
          <input
            type="text"
            placeholder="Your Name (optional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full rounded-2xl bg-white/10 px-4 py-3"
          />
          <input
            type="text"
            placeholder="Phone Number (optional)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full rounded-2xl bg-white/10 px-4 py-3"
          />

          {/* Payment Option */}
          <div>
            <p className="mb-2 text-sm font-bold text-white/70">Payment Option</p>
            <div className="flex gap-3">
              <button
                onClick={() => setPaymentType("PAY_LATER")}
                className={`flex-1 rounded-2xl py-3 text-sm font-bold transition ${
                  paymentType === "PAY_LATER" ? "bg-emerald-500 text-black" : "bg-white/10"
                }`}
              >
                Pay Later (at counter)
              </button>
              <button
                onClick={() => setPaymentType("PAY_NOW")}
                className={`flex-1 rounded-2xl py-3 text-sm font-bold transition ${
                  paymentType === "PAY_NOW" ? "bg-emerald-500 text-black" : "bg-white/10"
                }`}
              >
                Pay Now (Online)
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={placeTakeawayOrder}
            disabled={loading || cart.length === 0}
            className="w-full mt-4 rounded-2xl bg-white py-4 text-lg font-black text-black disabled:opacity-60"
          >
            {loading
              ? "Placing Order..."
              : `Place Takeaway Order - Rs. ${totalAmount}`}
          </button>
        </div>
      </div>
    </div>
  );
}