"use client";

import {
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { useState } from "react";

type PaymentResponse = {
  success: boolean;
  message?: string;

  data?: {
    paymentId: string;
    orderId: string;
    amount: number;
    paymentStatus: "PAID";

    successUrl?: string;
    receiptUrl?: string;
  };
};

function formatCurrency(amount: number) {
  return `Rs. ${Number(
    amount || 0
  ).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function MockPaymentButton({
  orderId,
  amount,
}: {
  orderId: string;
  amount: number;
}) {
  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function completePayment() {
    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/public/payments",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          cache: "no-store",

          body: JSON.stringify({
            orderId,
            method: "ONLINE",
            note:
              "Mock online payment completed",
          }),
        }
      );

      const result =
        (await response
          .json()
          .catch(() => ({
            success: false,
            message:
              "The server returned an invalid response.",
          }))) as PaymentResponse;

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
            "Payment could not be completed."
        );
      }

      /*
       * Use a full page navigation so the
       * success page loads the latest data
       * directly from MongoDB.
       */
      const successUrl =
        result.data?.successUrl ||
        `/payment/${orderId}/success`;

      window.location.assign(successUrl);
    } catch (paymentError) {
      console.error(
        "Mock payment error:",
        paymentError
      );

      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Something went wrong while completing payment."
      );

      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={() =>
          void completePayment()
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-5 w-5" />
        )}

        {loading
          ? "Processing Payment..."
          : `Pay ${formatCurrency(amount)}`}
      </button>

      <p className="text-center text-xs text-neutral-500">
        This is a simulated payment for
        project demonstration purposes.
      </p>
    </div>
  );
}