import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MFiPR × RiskMiner AI – System Wczesnego Ostrzegania o Ryzykach Inwestycji Publicznych",
    short_name: "RiskMiner AI",
    description: "System analityczny GovTech wczesnego wykrywania i mitygacji ryzyk inwestycji publicznych FEnIKS i KPO.",
    start_url: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#0F294A",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
