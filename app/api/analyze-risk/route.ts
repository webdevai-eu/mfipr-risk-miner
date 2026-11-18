import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Struktura odpowiedzi JSON oczekiwana od modelu Gemini
interface GeminiRiskResponse {
  projectTitle: string;
  estimatedBudgetPln: number;
  baselineDurationDays: number;
  overallRiskIndex: number;
  summary: string;
  risks: Array<{
    id: string;
    title: string;
    category: "Formalno-prawne" | "Finansowe" | "Harmonogramowe" | "Techniczne";
    probability: number;
    impact: number;
    delayDays: number;
    financialImpactPln: number;
    rootCause: string;
    mitigationPlan: string;
  }>;
}

const SYSTEM_INSTRUCTION = `Jesteś głównym analitykiem ryzyka inwestycji publicznych i funduszy europejskich w Ministerstwie Funduszy i Polityki Regionalnej (MFiPR). Przeanalizuj dostarczoną dokumentację lub opis inwestycji. Zidentyfikuj od 4 do 8 najistotniejszych, konkretnych ryzyk projektowych (formalno-prawnych, finansowych, harmonogramowych, technicznych). Zwróć WYŁĄCZNIE poprawny obiekt JSON o strukturze:
{
  "projectTitle": string,
  "estimatedBudgetPln": number,
  "baselineDurationDays": number,
  "overallRiskIndex": number,
  "summary": string,
  "risks": [
    {
      "id": string,
      "title": string,
      "category": "Formalno-prawne" | "Finansowe" | "Harmonogramowe" | "Techniczne",
      "probability": number,
      "impact": number,
      "delayDays": number,
      "financialImpactPln": number,
      "rootCause": string,
      "mitigationPlan": string
    }
  ]
}
Wartości probability oraz impact muszą być liczbami całkowitymi od 1 do 5.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Brak skonfigurowanego klucza GEMINI_API_KEY w środowisku." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { description, fileBase64, fileMimeType, fileName } = body;

    let userPrompt = "Przeanalizuj poniższe dane dotyczące inwestycji publicznej i wygeneruj ocenę ryzyka:\n\n";

    if (fileName) {
      userPrompt += `[Plik załącznika]: ${fileName}\n`;
    }

    // Jeśli przesłano plik tekstowy / CSV, zdekoduj bazę 64 do czystego UTF-8
    if (fileBase64 && (fileMimeType === "text/plain" || fileMimeType === "text/csv")) {
      try {
        const decoded = Buffer.from(fileBase64, "base64").toString("utf-8");
        userPrompt += `[Zawartość pliku ${fileName || "danych"}]:\n${decoded}\n\n`;
      } catch (err) {
        console.error("Błąd dekodowania pliku tekstowego:", err);
      }
    }

    if (description && description.trim()) {
      userPrompt += `[Opis / Notatka z budowy]:\n${description.trim()}\n`;
    }

    const isPdf = fileBase64 && fileMimeType === "application/pdf";
    const isVertexExpress = apiKey.startsWith("AQ.");

    let rawJsonText = "";

    if (isVertexExpress) {
      // Wywołanie Vertex AI Express Endpoint
      const endpoint = `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const contentsParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

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

      const payload = {
        contents: [
          {
            role: "user",
            parts: contentsParts,
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Błąd Vertex AI Express:", response.status, errText);
        throw new Error(`Vertex AI Express returned status ${response.status}: ${errText}`);
      }

      const resJson = await response.json();
      rawJsonText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      // Standardowe wywołanie Google AI Studio SDK (@google/generative-ai)
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
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
      const response = await result.response;
      rawJsonText = response.text();
    }

    if (!rawJsonText) {
      throw new Error("Model Gemini nie zwrócił żadnej odpowiedzi tekstowej.");
    }

    // Wyciągnięcie JSON w razie znaczników markdown
    let cleanJson = rawJsonText.trim();
    if (cleanJson.startsWith("```json")) {
      cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    } else if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```\s*/, "").replace(/```\s*$/, "").trim();
    }

    const parsedData: GeminiRiskResponse = JSON.parse(cleanJson);

    return NextResponse.json(parsedData);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Błąd w route /api/analyze-risk:", err);
    return NextResponse.json(
      {
        error: "Nie udało się przeprowadzić analizy przez model Gemini.",
        details: err?.message || String(error),
      },
      { status: 500 }
    );
  }
}
