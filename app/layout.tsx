import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ministerstwo Funduszy i Polityki Regionalnej | RiskMiner AI",
  description:
    "Oficjalny system wczesnego ostrzegania o ryzykach inwestycji publicznych współfinansowanych z programów FEnIKS i KPO. Opracowany dla MFiPR w ramach HackNation 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full font-sans antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F4F5F7] text-[#002D62] dark:bg-[#0B132B] dark:text-[#F8FAFC] font-sans transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
