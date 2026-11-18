import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Konfiguracja bezszeryfowej czcionki Geist dla interfejsu GovTech
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// Konfiguracja czcionki monospaced dla identyfikatorów, kwot i logów
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MFiPR × RiskMiner AI | System Wczesnego Ostrzegania o Ryzykach Inwestycji Publicznych",
  description:
    "Platforma analityczna GovTech do wczesnego wykrywania ryzyk formalno-prawnych, finansowych, harmonogramowych i technicznych w inwestycjach współfinansowanych z funduszy UE (FEnIKS, KPO).",
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
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-[#0F294A] dark:bg-[#071120] dark:text-[#F8FAFC] font-sans transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
