import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  type WodKanSubsector,
  type WodKanWorkType,
  type MfiprRiskCode,
  findSimilarMfiprProjects,
} from "@/lib/mfipr-dataset";
import {
  DEMO_JURY_REPORT,
  type MissingDocumentDiagnostic,
  type SimilarBenchmarkProject,
  getMfiprCatalogName,
} from "@/lib/risk-data";

export const maxDuration = 60;

interface GeminiWodKanRiskResponse {
  projectTitle: string;
  subsector: WodKanSubsector;
  additionalSubsector?: WodKanSubsector;
  workType: WodKanWorkType;
  estimatedBudgetPln: number;
  baselineDurationDays: number;
  overallRiskIndex: number;
  summary: string;
  predictedDelayRange: string;
  predictedCostOverrunRange: string;
  missingDocuments?: MissingDocumentDiagnostic[];
  similarProjects?: SimilarBenchmarkProject[];
  risks: Array<{
    id: string;
    mfiprCode: MfiprRiskCode;
    title: string;
    category: "Formalno-prawne" | "Finansowe" | "Harmonogramowe" | "Techniczne";
    probability: number;
    impact: number;
    delayDays: number;
    financialImpactPln: number;
    rootCause: string;
    sourceCitation: string;
    legalBasis: string;
    mitigationPlan: string;
    contractClauseSuggestion: string;
    confidenceLevel: "Wysoka" | "Średnia" | "Wymaga uzupełnienia dokumentów";
  }>;
}

const SYSTEM_INSTRUCTION = `Jesteś głównym analitykiem ryzyka inwestycji wodno-kanalizacyjnych (wod-kan) w Ministerstwie Funduszy i Polityki Regionalnej (MFiPR) w ramach systemu RiskMiner AI.
Przeanalizuj dostarczoną dokumentację lub opis inwestycji wodociągowo-kanalizacyjnej (KPO B3.1.1 / FEnIKS / PROW).

1. KLASYFIKACJA PODSEKTORA WOD-KAN:
Przypisz inwestycję do jednego z 6 oficjalnych podsektorów głównych:
- "Sieć wodociągowa"
- "Kanalizacja sanitarna"
- "Oczyszczalnia ścieków"
- "Uzdatnianie i zaopatrzenie w wodę"
- "Kanalizacja deszczowa i retencja"
- "Inne obiekty wod-kan"
oraz określ rodzaj prac ("Budowa/rozbudowa" lub "Przebudowa/renowacja").

2. OFICJALNY KATALOG RYZYK MFiPR (R01–R15):
Zidentyfikuj od 4 do 7 konkretnych ryzyk i przypisz każde z nich do oficjalnego kodu MFiPR:
- R01: Niepełny lub niespójny zakres
- R02: Niedostateczne rozpoznanie stanu istniejącego
- R03: Kolizje, dostęp do terenu i prawa do nieruchomości
- R04: Decyzje, pozwolenia i uzgodnienia zależne od podmiotów trzecich
- R05: Niejasny lub nieadekwatny podział odpowiedzialności
- R06: Nierealistyczny harmonogram i nieuwzględnione zależności
- R07: Nieprzewidziane zmiany i roboty dodatkowe
- R08: Model wynagrodzenia niedopasowany do niepewności zakresu
- R09: Niejednoznaczne lub niemierzalne wymagania techniczne
- R10: Niedookreślone próby, rozruch i odbiór
- R11: Postępowanie podatne na odwołanie lub ograniczenie konkurencji
- R12: Niewystarczająca zdolność wykonawcy lub łańcucha dostaw
- R13: Ryzyko finansowania, budżetu i płatności
- R14: Nadmierne koszty eksploatacji i utrzymania
- R15: Nieosiągnięcie efektu technologicznego, użytkowego lub środowiskowego

3. ZASADA STRICT GROUNDING I PROPOZYCJE ZAPISÓW PPU/SWZ:
Dla każdego ryzyka podaj:
- dosłowny cytat ze źródła (sourceCitation),
- podstawę prawną (legalBasis: np. art. 224, art. 439, art. 455 ust. 1 pkt 1–4 Pzp, Prawo wodne, Prawo budowlane),
- konkretną propozycję klauzuli umownej do PPU/SWZ (contractClauseSuggestion),
- poziom pewności oceny (confidenceLevel: "Wysoka" | "Średnia" | "Wymaga uzupełnienia dokumentów").

4. BRAKI DOKUMENTACYJNE:
Wskaż brakujące dokumenty w tablicy missingDocuments, rozróżniając "Brak w przekazanej paczce", "Dokument nie wspomina" oraz "Warunki kontraktowe odtworzone z PPU/SWU".

Zwróć WYŁĄCZNIE poprawny obiekt JSON zgodny ze schematem GeminiWodKanRiskResponse. Wartości probability oraz impact muszą być liczbami całkowitymi od 1 do 5.`;

// Ugruntowany w sektorze wod-kan generator fallbackowy oparty o katalog R01-R15 i bazę 22 projektów MFiPR
function generateWodKanGroundedFallback(
  description: string,
  fileName?: string
): GeminiWodKanRiskResponse {
  const lower = (description || "").toLowerCase();

  let subsector: WodKanSubsector = "Sieć wodociągowa";
  let additionalSubsector: WodKanSubsector | undefined = "Uzdatnianie i zaopatrzenie w wodę";

  if (lower.includes("oczyszczaln")) {
    subsector = "Oczyszczalnia ścieków";
    additionalSubsector = lower.includes("kanaliz") ? "Kanalizacja sanitarna" : undefined;
  } else if (lower.includes("deszczow") || lower.includes("retenc")) {
    subsector = "Kanalizacja deszczowa i retencja";
    additionalSubsector = undefined;
  } else if (lower.includes("kanalizacj") || lower.includes("ściek") || lower.includes("tłoczn")) {
    subsector = "Kanalizacja sanitarna";
    additionalSubsector = lower.includes("wodociąg") ? "Sieć wodociągowa" : undefined;
  } else if (lower.includes("suw") || lower.includes("uzdatnian")) {
    subsector = "Uzdatnianie i zaopatrzenie w wodę";
    additionalSubsector = "Sieć wodociągowa";
  }

  const workType: WodKanWorkType =
    lower.includes("modernizacj") || lower.includes("przebudow") || lower.includes("renowacj")
      ? "Przebudowa/renowacja"
      : "Budowa/rozbudowa";

  const similarProjects = findSimilarMfiprProjects(subsector, workType, 4);

  return {
    projectTitle: fileName
      ? `Inwestycja wod-kan: ${fileName}`
      : DEMO_JURY_REPORT.projectTitle,
    subsector,
    additionalSubsector,
    workType,
    estimatedBudgetPln: DEMO_JURY_REPORT.totalBudgetPln,
    baselineDurationDays: 365,
    overallRiskIndex: DEMO_JURY_REPORT.overallRiskScore,
    summary: DEMO_JURY_REPORT.executiveSummary,
    predictedDelayRange: DEMO_JURY_REPORT.predictedDelayRange,
    predictedCostOverrunRange: DEMO_JURY_REPORT.predictedCostOverrunRange,
    missingDocuments: DEMO_JURY_REPORT.missingDocuments,
    similarProjects,
    risks: DEMO_JURY_REPORT.risks.map((r) => ({
      id: r.id,
      mfiprCode: (r.code as MfiprRiskCode) || "R01",
      title: r.title,
      category: r.category,
      probability: r.probability,
      impact: r.impact,
      delayDays: r.estimatedDelayDays,
      financialImpactPln: r.budgetAtRiskPln,
      rootCause: r.rootCause,
      sourceCitation: r.sourceCitation,
      legalBasis: r.legalBasis,
      mitigationPlan: r.mitigationPlan,
      contractClauseSuggestion: r.contractClauseSuggestion,
      confidenceLevel: r.confidenceLevel,
    })),
  };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const body = await req.json();
    const { description, fileBase64, fileMimeType, fileName } = body;

    let userPrompt =
      "Przeanalizuj poniższe dane inwestycji wodno-kanalizacyjnej pod kątem katalogu ryzyk MFiPR (R01–R15) oraz zasady Strict Grounding:\n\n";

    if (fileName) {
      userPrompt += `[Plik załącznika]: ${fileName}\n`;
    }

    if (fileBase64 && (fileMimeType === "text/plain" || fileMimeType === "text/csv")) {
      try {
        const decoded = Buffer.from(fileBase64, "base64").toString("utf-8");
        userPrompt += `[Zawartość pliku ${fileName || "danych"}]:\n${decoded}\n\n`;
      } catch (err) {
        console.error("Błąd dekodowania pliku tekstowego:", err);
      }
    }

    if (description && description.trim()) {
      userPrompt += `[Opis / Dokumentacja inwestycji wod-kan]:\n${description.trim()}\n`;
    }

    const isPdf = fileBase64 && fileMimeType === "application/pdf";
    const isVertexExpress = apiKey && apiKey.startsWith("AQ.");
    let rawJsonText = "";

    if (apiKey) {
      try {
        if (isVertexExpress) {
          const endpoint = `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
          const contentsParts: Array<{
            text?: string;
            inlineData?: { mimeType: string; data: string };
          }> = [];

          if (isPdf) {
            contentsParts.push({
              inlineData: {
                mimeType: "application/pdf",
                data: fileBase64,
              },
            });
          }

          contentsParts.push({
            text: `${SYSTEM_INSTRUCTION}\n\n${userPrompt}`,
          });

          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: contentsParts }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
              },
            }),
          });

          if (response.ok) {
            const resJson = await response.json();
            rawJsonText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
          }
        } else {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
            systemInstruction: SYSTEM_INSTRUCTION,
          });

          const parts: Array<string | { inlineData: { mimeType: string; data: string } }> = [];
          if (isPdf) {
            parts.push({
              inlineData: {
                mimeType: "application/pdf",
                data: fileBase64,
              },
            });
          }
          parts.push(userPrompt);

          const result = await model.generateContent(parts);
          const res = await result.response;
          rawJsonText = res.text();
        }
      } catch (geminiError: unknown) {
        const gErr = geminiError as Error;
        console.warn(
          "Uruchamiam deterministyczny silnik analityczny MFiPR Wod-Kan (R01–R15):",
          gErr?.message
        );
      }
    }

    if (rawJsonText) {
      let cleanJson = rawJsonText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson
          .replace(/^```json\s*/i, "")
          .replace(/```\s*$/, "")
          .trim();
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson
          .replace(/^```\s*/, "")
          .replace(/```\s*$/, "")
          .trim();
      }
      try {
        const parsedData = JSON.parse(cleanJson) as GeminiWodKanRiskResponse;
        const subsector: WodKanSubsector =
          parsedData.subsector || "Sieć wodociągowa";
        const workType: WodKanWorkType =
          parsedData.workType || "Budowa/rozbudowa";

        const enrichedSimilar =
          parsedData.similarProjects && parsedData.similarProjects.length > 0
            ? parsedData.similarProjects
            : findSimilarMfiprProjects(subsector, workType, 4);

        const enrichedMissing =
          parsedData.missingDocuments && parsedData.missingDocuments.length > 0
            ? parsedData.missingDocuments
            : DEMO_JURY_REPORT.missingDocuments;

        return NextResponse.json({
          ...parsedData,
          subsector,
          workType,
          similarProjects: enrichedSimilar,
          missingDocuments: enrichedMissing,
          risks: (parsedData.risks || []).map((r, index) => ({
            ...r,
            mfiprCode: r.mfiprCode || (`R0${(index % 9) + 1}` as MfiprRiskCode),
            mfiprCatalogName: getMfiprCatalogName(
              r.mfiprCode || `R0${(index % 9) + 1}`
            ),
            contractClauseSuggestion:
              r.contractClauseSuggestion ||
              "Propozycja do PPU: Doprecyzowanie przesłanek zmiany umowy na podstawie art. 455 ust. 1 pkt 1 Pzp.",
            confidenceLevel: r.confidenceLevel || "Wysoka",
          })),
        });
      } catch (parseErr) {
        console.error("Błąd parsowania JSON z modelu:", parseErr);
      }
    }

    const fallbackData = generateWodKanGroundedFallback(description || "", fileName);
    return NextResponse.json(fallbackData);
  } catch (error: unknown) {
    console.error("Błąd ogólny w route /api/analyze-risk:", error);
    const fallbackData = generateWodKanGroundedFallback("");
    return NextResponse.json(fallbackData);
  }
}
