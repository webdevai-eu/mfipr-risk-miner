"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, X } from "lucide-react";

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Sprawdzenie czy użytkownik zaakceptował już politykę cookies w GovTech
    try {
      const consent = localStorage.getItem("mfipr_cookie_consent");
      if (!consent) {
        setIsVisible(true);
      }
    } catch {
      // Dostęp do localStorage może być zablokowany w restrykcyjnych środowiskach
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem("mfipr_cookie_consent", "accepted");
    } catch {
      // Ignorujemy błędy zapisu
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Informacja o plikach cookies i anonimizacji danych"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 rounded-2xl bg-white dark:bg-[#0F2138] border border-slate-200 dark:border-slate-700 p-4 shadow-xl text-xs text-slate-700 dark:text-slate-300 transition-all duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-[#0F294A]/10 dark:bg-sky-400/10 text-[#0F294A] dark:text-sky-400 shrink-0">
          <ShieldCheck className="size-5" />
        </div>
        <div className="flex-1 space-y-1.5">
          <h4 className="font-bold text-[#0F294A] dark:text-white text-sm">
            Polityka Prywatności i Plików Cookies MFiPR
          </h4>
          <p className="leading-relaxed">
            Portal wykorzystuje wyłącznie niezbędne pliki cookies do prawidłowego działania sesji analitycznej oraz lokalnego modułu RODO Shield (maskowanie danych w pamięci podręcznej). Nie stosujemy śledzących ciasteczek marketingowych.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleAccept}
              className="rounded-lg bg-[#0F294A] dark:bg-sky-500 text-white dark:text-slate-950 font-bold px-3 py-1.5 text-xs hover:bg-[#163B68] dark:hover:bg-sky-400 transition-colors cursor-pointer"
            >
              Rozumiem i akceptuję
            </button>
            <button
              type="button"
              onClick={() => setIsVisible(false)}
              aria-label="Zamknij powiadomienie"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
