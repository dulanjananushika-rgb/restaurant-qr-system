import Link from "next/link";

import {
  ExternalLink,
  QrCode,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";

import { getAppUrl } from "@/lib/appUrl";

import TakeawayQrGenerator from "@/components/admin/TakeawayQrGenerator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function removeTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export default function AdminTakeawayQrPage() {
  const appUrl = removeTrailingSlash(
    getAppUrl()
  );

  const takeawayUrl =
    `${appUrl}/takeaway`;

  return (
    <main className="space-y-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-400">
            Admin Management
          </p>

          <h1 className="mt-2 text-3xl font-bold text-white">
            Customer Takeaway QR
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            Generate, download and print the permanent
            QR code customers use to open the public
            takeaway ordering page.
          </p>
        </div>

        <Link
          href="/takeaway"
          target="_blank"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.07]"
        >
          <ExternalLink className="h-4 w-4" />
          Open Customer Page
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
            <QrCode className="h-5 w-5" />
          </div>

          <h2 className="mt-4 font-semibold text-white">
            Permanent QR
          </h2>

          <p className="mt-2 text-sm leading-6 text-neutral-500">
            The restaurant can use one permanent QR
            code for all customer takeaway orders.
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300">
            <ShoppingBag className="h-5 w-5" />
          </div>

          <h2 className="mt-4 font-semibold text-white">
            Customer Ordering
          </h2>

          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Customers scan the QR, select menu items,
            enter their details and receive a pickup
            number.
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <h2 className="mt-4 font-semibold text-white">
            Admin Controlled
          </h2>

          <p className="mt-2 text-sm leading-6 text-neutral-500">
            QR generation, downloading and printing
            are available only through the Admin
            workspace.
          </p>
        </article>
      </section>

      <TakeawayQrGenerator
        takeawayUrl={takeawayUrl}
      />
    </main>
  );
}