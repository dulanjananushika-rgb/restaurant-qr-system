"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, QrCode } from "lucide-react";

export default function TableQRCode({
  tableName,
  qrCode,
}: {
  tableName: string;
  qrCode: string;
}) {
  const [qrImage, setQrImage] = useState("");
  const [copied, setCopied] = useState(false);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const tableUrl = `${appUrl}/table/${qrCode}`;

  useEffect(() => {
    async function generateQr() {
      try {
        const image = await QRCode.toDataURL(tableUrl, {
          width: 220,
          margin: 2,
        });

        setQrImage(image);
      } catch (error) {
        console.error("QR generate error:", error);
      }
    }

    if (tableUrl) {
      generateQr();
    }
  }, [tableUrl]);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(tableUrl);
      setCopied(true);

      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Copy error:", error);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{tableName} QR</p>
          <p className="mt-1 text-xs text-neutral-500">Customer scan link</p>
        </div>

        <QrCode size={20} className="text-emerald-300" />
      </div>

      <div className="flex justify-center rounded-2xl bg-white p-3">
        {qrImage ? (
          <img
            src={qrImage}
            alt={`${tableName} QR Code`}
            className="h-40 w-40"
          />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center text-sm text-black">
            Loading...
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={copyUrl}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 transition hover:bg-white/10"
      >
        <Copy size={14} />
        {copied ? "Copied" : "Copy scan link"}
      </button>

      <p className="mt-2 break-all text-center text-[11px] leading-5 text-neutral-600">
        {tableUrl}
      </p>
    </div>
  );
}