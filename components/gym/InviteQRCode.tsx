"use client";

import { useRef } from "react";
import { useLocale } from "@/lib/i18n";

interface Props {
  inviteCode: string;
}

export default function InviteQRCode({ inviteCode }: Props) {
  const { t } = useLocale();
  const printRef = useRef<HTMLDivElement>(null);

  const inviteUrl = `https://bjj-app.net/gym/join/${inviteCode}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}&format=png`;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${t("gym.qrPrintTitle")}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, -apple-system, sans-serif;
              background: #fff;
            }
            .card {
              text-align: center;
              padding: 48px;
              border: 2px solid #e4e4e7;
              border-radius: 16px;
              max-width: 320px;
            }
            .card h2 {
              margin: 0 0 8px;
              font-size: 20px;
              color: #09090b;
            }
            .card p {
              margin: 16px 0 0;
              font-size: 12px;
              color: #71717a;
              word-break: break-all;
            }
            .card img {
              width: 200px;
              height: 200px;
              margin-top: 16px;
            }
            .brand {
              margin-top: 24px;
              font-size: 14px;
              font-weight: 600;
              color: #10B981;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>${t("gym.qrScanToJoin")}</h2>
            <img src="${qrImageUrl}" alt="QR Code" />
            <p>${inviteUrl}</p>
            <p class="brand">BJJ App</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="mt-4" ref={printRef}>
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-zinc-300 mb-3">
          {t("gym.qrTitle")}
        </h4>
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white rounded-lg p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrImageUrl}
              alt={t("gym.qrAltText")}
              width={200}
              height={200}
              className="block"
            />
          </div>
          <p className="text-xs text-zinc-500 text-center break-all max-w-[260px]">
            {inviteUrl}
          </p>
          <button type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {t("gym.qrPrint")}
          </button>
        </div>
      </div>
    </div>
  );
}
