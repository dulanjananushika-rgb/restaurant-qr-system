"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

export default function AddTableForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/tables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          capacity,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to create table");
        return;
      }

      setName("");
      setCapacity("2");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5"
    >
      <div className="mb-5">
        <p className="text-sm font-medium text-emerald-300">
          Table Management
        </p>
        <h2 className="mt-2 text-xl font-semibold">Add new table</h2>
        <p className="mt-1 text-sm leading-6 text-neutral-500">
          Create restaurant tables and generate unique QR codes for customer
          ordering.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm text-neutral-400">
            Table name
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Table 05"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-neutral-400">Capacity</span>
          <input
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            type="number"
            min="1"
            placeholder="4"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
          />
        </label>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Plus size={18} />
          )}
          {loading ? "Creating..." : "Create table"}
        </button>
      </div>
    </form>
  );
}