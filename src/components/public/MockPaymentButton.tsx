"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";

function formatCurrency(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US")}`;
}

export default function MockPaymentButton({
  orderId,
  amount,
}: {
  orderId: string;
  amount: number;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function completePayment() {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/public/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          method: "ONLINE",
          note: "Mock online payment completed",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Payment failed");
        return;
      }

      router.push(`/payment/${orderId}/success`);
      router.refresh();
    } catch {
      setError("Something went wrong while completing payment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={completePayment}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-5 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <CheckCircle2 size={18} />
        )}

        {loading ? "Processing..." : `Pay ${formatCurrency(amount)}`}
      </button>
    </div>
  );
}