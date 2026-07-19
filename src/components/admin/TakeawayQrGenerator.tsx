"use client";

import Image from "next/image";

import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import QRCode from "qrcode";

type TakeawayQrGeneratorProps = {
  takeawayUrl: string;
};

function removeTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) => {
      const replacements: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };

      return replacements[character];
    }
  );
}

export default function TakeawayQrGenerator({
  takeawayUrl,
}: TakeawayQrGeneratorProps) {
  const normalizedUrl = removeTrailingSlash(
    takeawayUrl.trim()
  );

  const [qrImage, setQrImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const isLocalUrl =
    normalizedUrl.includes("localhost") ||
    normalizedUrl.includes("127.0.0.1");

  const generateQrCode =
    useCallback(async () => {
      setLoading(true);
      setError("");
      setCopied(false);

      try {
        if (!normalizedUrl) {
          throw new Error(
            "The customer takeaway URL is missing."
          );
        }

        const generatedImage =
          await QRCode.toDataURL(
            normalizedUrl,
            {
              width: 700,
              margin: 3,
              errorCorrectionLevel: "H",

              color: {
                dark: "#111827",
                light: "#FFFFFF",
              },
            }
          );

        setQrImage(generatedImage);
      } catch (qrError) {
        console.error(
          "Takeaway QR generation error:",
          qrError
        );

        setQrImage("");

        setError(
          qrError instanceof Error
            ? qrError.message
            : "Failed to generate the takeaway QR code."
        );
      } finally {
        setLoading(false);
      }
    }, [normalizedUrl]);

  useEffect(() => {
    void generateQrCode();
  }, [generateQrCode]);

  async function copyTakeawayUrl() {
    if (!normalizedUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        normalizedUrl
      );

      setCopied(true);
      setError("");

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (copyError) {
      console.error(
        "Copy takeaway URL error:",
        copyError
      );

      setError(
        "The browser could not copy the takeaway URL."
      );
    }
  }

  function downloadQrCode() {
    if (!qrImage) {
      return;
    }

    const downloadLink =
      document.createElement("a");

    downloadLink.href = qrImage;
    downloadLink.download =
      "saffron-table-takeaway-qr.png";

    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  }

  function printQrCode() {
    if (!qrImage) {
      return;
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=850,height=950"
    );

    if (!printWindow) {
      setError(
        "The print window was blocked. Please allow pop-ups and try again."
      );

      return;
    }

    const safeUrl = escapeHtml(normalizedUrl);

    printWindow.document.open();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />

          <title>Takeaway Ordering QR</title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 30px;
              background: #ffffff;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif;
            }

            .poster {
              width: 100%;
              max-width: 680px;
              margin: 0 auto;
              border: 3px solid #111827;
              border-radius: 24px;
              overflow: hidden;
              text-align: center;
            }

            .header {
              padding: 32px 24px 24px;
              background: #111827;
              color: #ffffff;
            }

            .header h1 {
              margin: 0;
              font-size: 36px;
            }

            .header p {
              margin: 10px 0 0;
              font-size: 16px;
              color: #d1d5db;
            }

            .content {
              padding: 30px;
            }

            .qr-wrapper {
              display: inline-block;
              padding: 12px;
              border: 4px solid #111827;
              border-radius: 18px;
              background: #ffffff;
            }

            .qr-wrapper img {
              display: block;
              width: 420px;
              max-width: 100%;
              height: auto;
            }

            h2 {
              margin: 26px 0 8px;
              font-size: 28px;
            }

            .description {
              margin: 0 auto;
              max-width: 500px;
              color: #4b5563;
              font-size: 16px;
              line-height: 1.6;
            }

            .steps {
              margin-top: 24px;
              padding: 16px;
              border-radius: 12px;
              background: #f3f4f6;
              font-weight: 700;
            }

            .url {
              margin-top: 18px;
              color: #6b7280;
              font-size: 11px;
              overflow-wrap: anywhere;
            }

            .footer {
              padding: 18px 24px;
              border-top: 1px solid #e5e7eb;
              background: #f9fafb;
              color: #4b5563;
              font-size: 14px;
            }

            @media print {
              body {
                padding: 0;
              }

              .poster {
                border-radius: 0;
              }
            }
          </style>
        </head>

        <body>
          <main class="poster">
            <header class="header">
              <h1>Saffron Table</h1>
              <p>Customer Takeaway Ordering</p>
            </header>

            <section class="content">
              <div class="qr-wrapper">
                <img
                  src="${qrImage}"
                  alt="Customer takeaway ordering QR code"
                />
              </div>

              <h2>Scan to Order Takeaway</h2>

              <p class="description">
                Open your phone camera, scan the QR code,
                select your food items and place your
                takeaway order.
              </p>

              <div class="steps">
                Scan QR → Select Items → Place Order →
                Receive Pickup Number
              </div>

              <p class="url">${safeUrl}</p>
            </section>

            <footer class="footer">
              Restaurant Ordering and Management System
            </footer>
          </main>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  return (
    <section className="space-y-6">
      {isLocalUrl && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-semibold">
              Local development URL detected
            </p>

            <p className="mt-1 leading-6 text-amber-200/80">
              A QR generated using localhost will not
              work on a customer&apos;s mobile phone.
              Configure the production Vercel URL before
              downloading or printing the final QR.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      <article className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-white text-black shadow-2xl shadow-black/30">
        <header className="border-b border-neutral-200 bg-neutral-950 px-6 py-7 text-center text-white">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <QrCode className="h-6 w-6" />
          </div>

          <h2 className="mt-4 text-3xl font-bold">
            Saffron Table
          </h2>

          <p className="mt-1 text-sm text-neutral-400">
            Customer Takeaway Ordering
          </p>
        </header>

        <div className="px-6 py-8 text-center">
          {loading && (
            <div className="flex min-h-[380px] flex-col items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-neutral-700" />

              <p className="mt-4 text-sm text-neutral-500">
                Generating QR code...
              </p>
            </div>
          )}

          {!loading && qrImage && (
            <>
              <div className="mx-auto w-fit rounded-2xl border-4 border-neutral-900 bg-white p-3">
                <Image
                  src={qrImage}
                  alt="Customer takeaway ordering QR code"
                  width={700}
                  height={700}
                  priority
                  unoptimized
                  className="h-auto w-full max-w-[370px]"
                />
              </div>

              <h3 className="mt-6 text-2xl font-bold">
                Scan to Order Takeaway
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">
                Customers can scan this QR using their
                phone camera, select food items and place
                takeaway orders without staff assistance.
              </p>

              <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <p className="break-all text-xs text-neutral-600">
                  {normalizedUrl}
                </p>
              </div>
            </>
          )}
        </div>

        <footer className="border-t border-neutral-200 bg-neutral-50 px-6 py-5 text-center">
          <p className="font-semibold">
            Customer Ordering Steps
          </p>

          <p className="mt-2 text-sm text-neutral-600">
            Scan QR → Select Items → Place Order →
            Receive Pickup Number
          </p>
        </footer>
      </article>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={loading || !qrImage}
          onClick={downloadQrCode}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Download QR
        </button>

        <button
          type="button"
          disabled={loading || !qrImage}
          onClick={printQrCode}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
          Print QR
        </button>

        <button
          type="button"
          disabled={!normalizedUrl}
          onClick={() => void copyTakeawayUrl()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-300" />
          ) : (
            <Copy className="h-4 w-4" />
          )}

          {copied ? "URL Copied" : "Copy URL"}
        </button>

        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
        >
          <ExternalLink className="h-4 w-4" />
          Preview Customer Page
        </a>

        <button
          type="button"
          disabled={loading}
          onClick={() => void generateQrCode()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Regenerate
        </button>
      </div>
    </section>
  );
}