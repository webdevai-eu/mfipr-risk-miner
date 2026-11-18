"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Upload,
  FileText,
  Mic,
  MicOff,
  Sparkles,
  AlertTriangle,
  Clock,
  Banknote,
  Activity,
  Download,
  Sun,
  Moon,
  Filter,
  RotateCcw,
  CheckCircle2,
  Scale,
  CalendarClock,
  Wrench,
  Building2,
  Info,
  X,
  Eye,
  EyeOff,
  ChevronRight,
  SlidersHorizontal,
  Cpu,
  BookOpen,
  Check,
  Ban,
  UserCheck,
  ChevronDown,
} from "lucide-react";
import { CookieBanner } from "@/components/cookie-banner";
import {
  type RiskCategory,
  type RiskSeverity,
  type MatrixScore,
  type VerificationStatus,
  type InvestmentAnalysisReport,
  type InvestmentRiskItem,
  DEMO_JURY_INPUT_TEXT,
  DEMO_JURY_REPORT,
  applyRodoShieldMasking,
  calculateMatrixSeverity,
  buildLocalFallbackReport,
} from "@/lib/risk-data";

interface SpeechRecognitionAlternativeItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultItem {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeItem;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEventPayload extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorPayload extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionBrowserInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventPayload) => void) | null;
  onerror: ((event: SpeechRecognitionErrorPayload) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionBrowserInstance;

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

interface GeminiApiResponse {
  projectTitle?: string;
  estimatedBudgetPln?: number;
  baselineDurationDays?: number;
  overallRiskIndex?: number;
  summary?: string;
  risks?: Array<{
    id: string;
    title: string;
    category: RiskCategory;
    probability: number;
    impact: number;
    delayDays: number;
    financialImpactPln: number;
    rootCause: string;
    sourceCitation?: string;
    legalBasis?: string;
    mitigationPlan: string;
  }>;
  error?: string;
}

type FooterModalType = "rodo" | "terms" | "wcag" | null;

const RISK_CATEGORIES: RiskCategory[] = [
  "Formalno-prawne",
  "Finansowe",
  "Harmonogramowe",
  "Techniczne",
];

const PROBABILITY_AXIS: MatrixScore[] = [5, 4, 3, 2, 1];
const IMPACT_AXIS: MatrixScore[] = [1, 2, 3, 4, 5];

const PROBABILITY_LABELS: Record<MatrixScore, string> = {
  5: "5 – Bardzo wysokie (>80%)",
  4: "4 – Wysokie (50–80%)",
  3: "3 – Umiarkowane (25–50%)",
  2: "2 – Niskie (10–25%)",
  1: "1 – Rzadkie (<10%)",
};

const IMPACT_LABELS: Record<MatrixScore, string> = {
  1: "1 – Nieznaczny",
  2: "2 – Mały",
  3: "3 – Umiarkowany",
  4: "4 – Poważny",
  5: "5 – Katastrofalny",
};

function formatPln(amount: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function addDaysToIsoDate(isoDate: string, daysToAdd: number): string {
  const parsed = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  parsed.setUTCDate(parsed.getUTCDate() + daysToAdd);
  return parsed.toISOString().slice(0, 10);
}

function diffDaysBetweenIsoDates(firstIso: string, secondIso: string): number {
  const d1 = new Date(`${firstIso}T12:00:00Z`).getTime();
  const d2 = new Date(`${secondIso}T12:00:00Z`).getTime();
  if (Number.isNaN(d1) || Number.isNaN(d2)) return 0;
  return Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
}

export default function RiskMinerDashboardPage() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const [inputText, setInputText] = useState<string>(DEMO_JURY_INPUT_TEXT);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    "HRF_SWZ_Obwodnica_DK22_FEnIKS_2026.pdf"
  );
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>("2.4 MB");
  const [uploadedFileBase64, setUploadedFileBase64] = useState<string | null>(null);
  const [uploadedFileMimeType, setUploadedFileMimeType] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [rodoShieldEnabled, setRodoShieldEnabled] = useState<boolean>(true);
  const [showMaskedPreview, setShowMaskedPreview] = useState<boolean>(false);

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [speechStatusMessage, setSpeechStatusMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionBrowserInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [report, setReport] = useState<InvestmentAnalysisReport>(DEMO_JURY_REPORT);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string>(
    "Załadowano scenariusz referencyjny: Budowa obwodnicy północnej w ciągu DK-22 (FEnIKS 148 mln PLN)."
  );

  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{
    probability: MatrixScore;
    impact: MatrixScore;
  } | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<RiskCategory | "ALL">(
    "ALL"
  );

  const [proceduralDelaySliderDays, setProceduralDelaySliderDays] = useState<number>(35);
  const [costIndexationSliderPercent, setCostIndexationSliderPercent] = useState<number>(8);

  const [activeFooterModal, setActiveFooterModal] = useState<FooterModalType>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const rodoMaskResult = useMemo(() => {
    return applyRodoShieldMasking(inputText, rodoShieldEnabled);
  }, [inputText, rodoShieldEnabled]);

  const stopVoiceDictation = useCallback((reasonMessage?: string) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignorujemy błędy zatrzymania
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
    if (reasonMessage) {
      setSpeechStatusMessage(reasonMessage);
    }
  }, []);

  const handleUpdateRiskStatus = (riskId: string, newStatus: VerificationStatus) => {
    setReport((prev) => ({
      ...prev,
      risks: prev.risks.map((r) =>
        r.id === riskId
          ? {
              ...r,
              verificationStatus: r.verificationStatus === newStatus ? "pending" : newStatus,
            }
          : r
      ),
    }));
  };

  const humanInTheLoopStats = useMemo(() => {
    const approved = report.risks.filter((r) => r.verificationStatus === "approved").length;
    const rejected = report.risks.filter((r) => r.verificationStatus === "rejected").length;
    const pending = report.risks.filter(
      (r) => !r.verificationStatus || r.verificationStatus === "pending"
    ).length;
    return { approved, rejected, pending, total: report.risks.length };
  }, [report.risks]);

  const handleToggleVoiceDictation = () => {
    if (isRecording) {
      stopVoiceDictation("Zakończono nagrywanie notatki głosowej.");
      return;
    }

    if (typeof window === "undefined") return;
    const speechWindow = window as unknown as WindowWithSpeechRecognition;
    const SpeechRecognitionApi =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      setSpeechStatusMessage(
        "Twoja przeglądarka nie wspiera Web Speech API. Użyj Google Chrome lub Microsoft Edge."
      );
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.lang = "pl-PL";
    recognition.continuous = true;
    recognition.interimResults = true;

    const resetSilenceTimeout = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        stopVoiceDictation(
          "Auto-stop po 3 sekundach ciszy – notatka głosowa została dołączona do opisu."
        );
      }, 3000);
    };

    recognition.onresult = (event: SpeechRecognitionEventPayload) => {
      resetSilenceTimeout();
      let finalTranscriptChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        if (res && res.isFinal && res[0]) {
          finalTranscriptChunk += `${res[0].transcript.trim()} `;
        }
      }
      if (finalTranscriptChunk.trim().length > 0) {
        setInputText((prev) => {
          const separator = prev.trim().length > 0 ? "\n" : "";
          return `${prev.trim()}${separator}${finalTranscriptChunk.trim()}`;
        });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorPayload) => {
      stopVoiceDictation(`Komunikat mikrofonu: ${event.error}`);
    };

    recognition.onend = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    setIsRecording(true);
    setSpeechStatusMessage(
      "Nasłuchiwanie (pl-PL, tryb ciągły)... Mów do mikrofonu (auto-stop po 3 s ciszy)."
    );
    recognition.start();
    resetSilenceTimeout();
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const res = reader.result as string;
        const base64 = res.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const processSelectedFile = async (file: File) => {
    const allowedExtensions = [".pdf", ".csv", ".txt"];
    const lowerName = file.name.toLowerCase();
    const isSupported = allowedExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isSupported) {
      setStatusBanner(
        "Nieobsługiwany format pliku. Wybierz dokument .pdf, .csv lub .txt (np. HRF, SWZ, raport z budowy)."
      );
      return;
    }

    const sizeKb = (file.size / 1024).toFixed(1);
    setUploadedFileName(file.name);
    setUploadedFileSize(`${sizeKb} KB`);

    let mimeType = file.type;
    if (!mimeType) {
      if (lowerName.endsWith(".pdf")) mimeType = "application/pdf";
      else if (lowerName.endsWith(".csv")) mimeType = "text/csv";
      else mimeType = "text/plain";
    }
    setUploadedFileMimeType(mimeType);

    try {
      const b64 = await fileToBase64(file);
      setUploadedFileBase64(b64);
    } catch (err) {
      console.error("Błąd odczytu b64:", err);
    }

    if (lowerName.endsWith(".txt") || lowerName.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = typeof e.target?.result === "string" ? e.target.result : "";
        if (content.trim().length > 0) {
          setInputText(content);
          setStatusBanner(
            `Wczytano treść pliku „${file.name}” (${sizeKb} KB). Kliknij „Przeanalizuj z AI na żywo (Gemini 2.5 Flash)”!`
          );
        }
      };
      reader.readAsText(file, "utf-8");
    } else {
      setStatusBanner(
        `Załączono dokument PDF „${file.name}” (${sizeKb} KB). Gotowy do bezpośredniej analizy multimodalnej przez Gemini 2.5 Flash!`
      );
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  };

  async function analyzeInvestment(options?: {
    customText?: string;
    customFileName?: string | null;
    isDemoPreset?: boolean;
    forceLiveAi?: boolean;
  }): Promise<void> {
    const rawSource = options?.customText ?? inputText;
    const targetFileName =
      options?.customFileName !== undefined ? options.customFileName : uploadedFileName;

    if (!rawSource.trim() && !uploadedFileBase64) {
      setStatusBanner(
        "Wprowadź opis inwestycji, załącz plik lub załaduj przykładową inwestycję Demo Jury."
      );
      return;
    }

    setIsAnalyzing(true);
    setSelectedMatrixCell(null);
    setSelectedCategoryFilter("ALL");

    const { processedText, maskedCount } = applyRodoShieldMasking(
      rawSource,
      rodoShieldEnabled
    );

    try {
      if (options?.isDemoPreset && !options?.forceLiveAi) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setReport({
          ...DEMO_JURY_REPORT,
          sourceInputSample: processedText,
          generatedAt: new Date().toISOString(),
        });
        setProceduralDelaySliderDays(35);
        setCostIndexationSliderPercent(8);
        setStatusBanner(
          `Załadowano zweryfikowany wzorzec Demo Jury MFiPR: „Budowa obwodnicy północnej DK-22” ${
            rodoShieldEnabled ? `• RODO Shield zamaskował ${maskedCount} encji.` : ""
          }`
        );
        return;
      }

      setStatusBanner("Przesyłanie danych do Gemini 2.5 Flash... Strict Grounding i identyfikacja ryzyk...");

      const response = await fetch("/api/analyze-risk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: processedText,
          fileBase64: uploadedFileBase64,
          fileMimeType: uploadedFileMimeType,
          fileName: targetFileName,
        }),
      });

      if (response.ok) {
        const apiData = (await response.json()) as GeminiApiResponse;

        if (apiData && Array.isArray(apiData.risks) && apiData.risks.length > 0) {
          const convertedRisks: InvestmentRiskItem[] = apiData.risks.map((item, idx) => {
            const prob = Math.min(5, Math.max(1, Math.round(item.probability))) as MatrixScore;
            const imp = Math.min(5, Math.max(1, Math.round(item.impact))) as MatrixScore;
            const severity = calculateMatrixSeverity(prob, imp);

            let prefix = "RISK";
            if (item.category === "Formalno-prawne") prefix = "LEG";
            else if (item.category === "Finansowe") prefix = "FIN";
            else if (item.category === "Harmonogramowe") prefix = "SCH";
            else if (item.category === "Techniczne") prefix = "TECH";

            return {
              id: item.id || `risk-${idx + 1}`,
              code: `${prefix}-0${idx + 1}`,
              title: item.title,
              category: item.category,
              severity,
              probability: prob,
              impact: imp,
              estimatedDelayDays: item.delayDays || 30,
              budgetAtRiskPln: item.financialImpactPln || 5_000_000,
              rootCause: item.rootCause,
              sourceCitation:
                item.sourceCitation ||
                "„Na podstawie analizy harmonogramu i wytycznych kwalifikowalności wydatków funduszy UE.”",
              legalBasis:
                item.legalBasis || "Ustawa Prawo zamówień publicznych / Wytyczne MFiPR 2021–2027",
              mitigationPlan: item.mitigationPlan,
              legalBasisOrClause: item.legalBasis || "Standard Zarządzania Inwestycjami MFiPR",
              ownerUnit: "Wydział Realizacji i Rozliczeń Projektów",
              verificationStatus: "pending",
            };
          });

          const totalThreatened = convertedRisks.reduce((acc, curr) => acc + curr.budgetAtRiskPln, 0);
          const maxDelay = Math.max(...convertedRisks.map((r) => r.estimatedDelayDays), 45);

          const newReport: InvestmentAnalysisReport = {
            projectId: "MFiPR-GEMINI-2026",
            projectTitle: apiData.projectTitle || targetFileName || "Analizowana Inwestycja Publiczna",
            fundingProgram: "Program FEnIKS 2021–2027 / Krajowy Plan Odbudowy (KPO)",
            beneficiaryName: "Beneficjent Inwestycji Publicznej / Nadzór MFiPR",
            stageDescription: "Ocena analityczna na podstawie dokumentacji i notatek z realizacji",
            totalBudgetPln: apiData.estimatedBudgetPln || 214_500_000,
            euFundingPln: Math.round((apiData.estimatedBudgetPln || 214_500_000) * 0.7),
            basePlannedEndDate: "2029-06-15",
            euSettlementDeadline: "2029-12-31",
            overallRiskScore: apiData.overallRiskIndex || 75,
            criticalPathDelayDays: maxDelay,
            threatenedBudgetPln: totalThreatened,
            executiveSummary:
              apiData.summary ||
              "Analiza AI oparta o model Gemini 2.5 Flash zidentyfikowała kluczowe punkty zapalne w obszarze ścieżki krytycznej i kwalifikowalności wydatków unijnych.",
            sourceInputSample: processedText,
            generatedAt: new Date().toISOString(),
            modelEngine: "Gemini 2.5 Flash (Google Cloud AI)",
            risks: convertedRisks,
          };

          setReport(newReport);
          setStatusBanner(
            `Analiza Gemini 2.5 Flash zakończona sukcesem! Zidentyfikowano ${convertedRisks.length} kluczowych ryzyk projektowych (Strict Grounding).`
          );
          return;
        }
      }

      const localReport = buildLocalFallbackReport(rawSource, targetFileName, rodoShieldEnabled);
      setReport(localReport);
      setStatusBanner(
        `Analiza zrealizowana w trybie GovTech Offline/Fallback (${localReport.risks.length} ryzyk).`
      );
    } catch (err) {
      console.error("Błąd podczas analizy:", err);
      const localReport = buildLocalFallbackReport(rawSource, targetFileName, rodoShieldEnabled);
      setReport(localReport);
      setStatusBanner(
        `Wygenerowano analizę w trybie lokalnym Edge (${localReport.risks.length} ryzyk).`
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  const handleLoadDemoJuryInvestment = () => {
    setInputText(DEMO_JURY_INPUT_TEXT);
    setUploadedFileName("HRF_SWZ_Obwodnica_DK22_FEnIKS_2026.pdf");
    setUploadedFileSize("2.4 MB");
    setUploadedFileBase64(null);
    setUploadedFileMimeType(null);
    void analyzeInvestment({
      customText: DEMO_JURY_INPUT_TEXT,
      customFileName: "HRF_SWZ_Obwodnica_DK22_FEnIKS_2026.pdf",
      isDemoPreset: true,
    });
  };

  const activeUnrejectedRisks = useMemo(() => {
    return report.risks.filter((r) => r.verificationStatus !== "rejected");
  }, [report.risks]);

  const simulationMetrics = useMemo(() => {
    const activeThreatened = activeUnrejectedRisks.reduce((acc, curr) => acc + curr.budgetAtRiskPln, 0);
    const activeMaxDelay =
      activeUnrejectedRisks.length > 0
        ? Math.max(...activeUnrejectedRisks.map((r) => r.estimatedDelayDays))
        : 0;

    const totalDelayDays = activeMaxDelay + proceduralDelaySliderDays;
    const projectedEndDate = addDaysToIsoDate(report.basePlannedEndDate, totalDelayDays);

    const daysAfterEuDeadline = diffDaysBetweenIsoDates(
      projectedEndDate,
      report.euSettlementDeadline
    );
    const exceedsEuDeadline = daysAfterEuDeadline > 0;

    const additionalIndexationCostPln =
      report.totalBudgetPln * (costIndexationSliderPercent / 100);

    const simulatedThreatenedBudgetPln =
      activeThreatened + additionalIndexationCostPln * 0.65;

    const activeCritical = activeUnrejectedRisks.filter((r) => r.severity === "Krytyczne").length;
    const activeHigh = activeUnrejectedRisks.filter((r) => r.severity === "Wysokie").length;

    const delayScorePenalty = Math.round((proceduralDelaySliderDays / 120) * 11);
    const costScorePenalty = Math.round((costIndexationSliderPercent / 25) * 9);
    const baseDynamic = Math.min(100, (activeCritical * 18 + activeHigh * 10) + delayScorePenalty + costScorePenalty);
    const dynamicRiskIndex = Math.max(10, Math.min(100, activeUnrejectedRisks.length > 0 ? baseDynamic : 15));

    return {
      totalDelayDays,
      projectedEndDate,
      daysAfterEuDeadline,
      exceedsEuDeadline,
      additionalIndexationCostPln,
      simulatedThreatenedBudgetPln,
      dynamicRiskIndex,
      criticalCount: activeCritical,
      highCount: activeHigh,
      criticalAndHighTotal: activeCritical + activeHigh,
    };
  }, [report, activeUnrejectedRisks, proceduralDelaySliderDays, costIndexationSliderPercent]);

  const filteredRisks = useMemo(() => {
    return report.risks.filter((risk) => {
      const matchesCell =
        !selectedMatrixCell ||
        (risk.probability === selectedMatrixCell.probability &&
          risk.impact === selectedMatrixCell.impact);
      const matchesCategory =
        selectedCategoryFilter === "ALL" || risk.category === selectedCategoryFilter;
      return matchesCell && matchesCategory;
    });
  }, [report.risks, selectedMatrixCell, selectedCategoryFilter]);

  const groupedRisksByCategory = useMemo(() => {
    const groups: Record<RiskCategory, InvestmentRiskItem[]> = {
      "Formalno-prawne": [],
      Finansowe: [],
      Harmonogramowe: [],
      Techniczne: [],
    };
    for (const item of filteredRisks) {
      groups[item.category].push(item);
    }
    return groups;
  }, [filteredRisks]);

  const getRisksInMatrixCell = (probability: MatrixScore, impact: MatrixScore) => {
    return report.risks.filter(
      (r) => r.probability === probability && r.impact === impact
    );
  };

  const handleDownloadSteeringCommitteeReport = () => {
    const nowFormatted = new Date().toLocaleString("pl-PL", {
      dateStyle: "short",
      timeStyle: "medium",
    });

    const lines: string[] = [
      "================================================================================",
      "  MINISTERSTWO FUNDUSZY I POLITYKI REGIONALNEJ (MFiPR) × RISKMINER AI",
      "  KARTA RYZYKA INWESTYCJI PUBLICZNEJ DLA KOMITETU STERUJĄCEGO",
      "================================================================================",
      `Data wygenerowania raportu : ${nowFormatted}`,
      `Silnik analityczny         : ${report.modelEngine} (Strict Grounding / Gemini 2.5 Flash)`,
      `Status AI Act (HITL)       : Zatwierdzone: ${humanInTheLoopStats.approved} | Odrzucone: ${humanInTheLoopStats.rejected} | Do przeglądu: ${humanInTheLoopStats.pending}`,
      `Status ochrony RODO Shield : ${
        rodoShieldEnabled
          ? `AKTYWNY (Zanonimizowano ${rodoMaskResult.maskedCount} encji wrażliwych)`
          : "WYŁĄCZONY"
      }`,
      "",
      "1. METRYKA INWESTYCJI PUBLICZNEJ",
      "--------------------------------------------------------------------------------",
      `ID Projektu                : ${report.projectId}`,
      `Nazwa inwestycji           : ${report.projectTitle}`,
      `Program operacyjny         : ${report.fundingProgram}`,
      `Etap realizacji            : ${report.stageDescription}`,
      `Budżet całkowity brutto    : ${formatPln(report.totalBudgetPln)}`,
      `Dofinansowanie UE (FEnIKS) : ${formatPln(report.euFundingPln)}`,
      `Bazowy termin zakończenia  : ${report.basePlannedEndDate}`,
      `Termin kwalifikowalności UE: ${report.euSettlementDeadline}`,
      "",
      "2. KLUCZOWE WSKAŹNIKI RYZYKA (PO WERYFIKACJI HUMAN-IN-THE-LOOP)",
      "--------------------------------------------------------------------------------",
      `• Ogólny Indeks Ryzyka Inwestycji          : ${simulationMetrics.dynamicRiskIndex} / 100 pkt`,
      `• Liczba Ryzyk Krytycznych i Wysokich      : ${simulationMetrics.criticalAndHighTotal} (${simulationMetrics.criticalCount} krytycznych, ${simulationMetrics.highCount} wysokich)`,
      `• Szacowane Opóźnienie Ścieżki Krytycznej  : +${simulationMetrics.totalDelayDays} dni`,
      `• Wartość Zagrożonego Budżetu / UE         : ${formatPln(simulationMetrics.simulatedThreatenedBudgetPln)}`,
      "",
      "3. PARAMETRY SYMULATORA SCENARIUSZY „WHAT-IF”",
      "--------------------------------------------------------------------------------",
      `• Suwak 1 – Opóźnienie procedur KIO / ZRID : +${proceduralDelaySliderDays} dni (zakres 0..+120 dni)`,
      `• Suwak 2 – Wzrost kosztów i waloryzacja   : +${costIndexationSliderPercent}% (zakres 0%..+25%)`,
      `• Prognozowana data zakończenia inwestycji : ${simulationMetrics.projectedEndDate}`,
      `• Dodatkowy koszt waloryzacji robót        : +${formatPln(simulationMetrics.additionalIndexationCostPln)}`,
      `• Status terminu rozliczenia perspektywy UE: ${
        simulationMetrics.exceedsEuDeadline
          ? `ALARM KRYTYCZNY! Przekroczenie terminu kwalifikowalności (${report.euSettlementDeadline}) o ${simulationMetrics.daysAfterEuDeadline} dni!`
          : `W TERMINIE – bufor bezpieczeństwa wynosi ${Math.abs(simulationMetrics.daysAfterEuDeadline)} dni.`
      }`,
      "",
      "4. SYNTEZA ZARZĄDCZA (EXECUTIVE SUMMARY)",
      "--------------------------------------------------------------------------------",
      report.executiveSummary,
      "",
      "5. ZIDENTYFIKOWANE RYZYKA I DOWODY W DOKUMENTACJI (STRICT GROUNDING)",
      "--------------------------------------------------------------------------------",
    ];

    for (const category of RISK_CATEGORIES) {
      const catRisks = report.risks.filter((r) => r.category === category);
      lines.push(`\n### KATEGORIA: ${category.toUpperCase()} (${catRisks.length}) ###`);
      for (const r of catRisks) {
        lines.push(
          `--------------------------------------------------------------------------------`,
          `[${r.code}] ${r.title} | STATUS HITL: ${(r.verificationStatus || "pending").toUpperCase()}`,
          `Poziom ryzyka : ${r.severity.toUpperCase()} (P: ${r.probability}/5, W: ${r.impact}/5, Wynik: ${
            r.probability * r.impact
          }/25)`,
          `Wpływ czasowy : +${r.estimatedDelayDays} dni | Ekspozycja finansowa: ${formatPln(r.budgetAtRiskPln)}`,
          `Podstawa prawna / PZP: ${r.legalBasis}`,
          `Cytat źródłowy (Strict Grounding):`,
          `  ${r.sourceCitation}`,
          `Przyczyna źródłowa (Root Cause):`,
          `  ${r.rootCause}`,
          `Rekomendacja naprawcza (Plan Mitygacji):`,
          `  ${r.mitigationPlan}`
        );
      }
    }

    lines.push(
      "",
      "================================================================================",
      "Wygenerowano przez: MFiPR × RiskMiner AI | Architektura i wdrożenie: WebDevAI",
      "================================================================================"
    );

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Karta_Ryzyka_MFiPR_${report.projectId.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getSeverityBadgeClasses = (severity: RiskSeverity): string => {
    switch (severity) {
      case "Krytyczne":
        return "bg-[#D52B1E] text-white border-[#D52B1E] shadow-xs";
      case "Wysokie":
        return "bg-orange-600 text-white border-orange-600";
      case "Średnie":
        return "bg-amber-500 text-slate-950 border-amber-500 font-semibold";
      case "Niskie":
        return "bg-emerald-600 text-white border-emerald-600";
    }
  };

  const getMatrixCellClasses = (
    probability: MatrixScore,
    impact: MatrixScore,
    isSelected: boolean,
    hasRisks: boolean
  ): string => {
    const severity = calculateMatrixSeverity(probability, impact);
    const selectionRing = isSelected
      ? "ring-4 ring-[#002D62] dark:ring-sky-400 scale-[1.03] z-10 shadow-md"
      : "hover:scale-[1.02] hover:shadow-sm";

    const opacityStyle = hasRisks ? "opacity-100" : "opacity-65 hover:opacity-95";

    switch (severity) {
      case "Krytyczne":
        return `bg-[#D52B1E]/90 dark:bg-[#D52B1E]/85 text-white border-[#B01F15] ${selectionRing} ${opacityStyle}`;
      case "Wysokie":
        return `bg-orange-500/90 dark:bg-orange-600/80 text-white border-orange-600 ${selectionRing} ${opacityStyle}`;
      case "Średnie":
        return `bg-amber-400/90 dark:bg-amber-500/80 text-slate-950 border-amber-500 ${selectionRing} ${opacityStyle}`;
      case "Niskie":
        return `bg-emerald-500/85 dark:bg-emerald-600/75 text-white border-emerald-600 ${selectionRing} ${opacityStyle}`;
    }
  };

  const renderCategoryIcon = (category: RiskCategory) => {
    switch (category) {
      case "Formalno-prawne":
        return <Scale className="size-5 text-[#002D62] dark:text-sky-400" strokeWidth={1.75} />;
      case "Finansowe":
        return <Banknote className="size-5 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />;
      case "Harmonogramowe":
        return <CalendarClock className="size-5 text-orange-600 dark:text-orange-400" strokeWidth={1.75} />;
      case "Techniczne":
        return <Wrench className="size-5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F5F7] dark:bg-[#0B132B] text-[#002D62] dark:text-slate-100 font-sans">
      <CookieBanner />

      {/* 1. OFICJALNY NAGŁÓWEK GOV.PL / MFiPR */}
      <header className="sticky top-0 z-30 bg-white dark:bg-[#152238] border-b border-[#D1D5DB] dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Znak gov.pl zgodny z Księgą Znaku gov.pl */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col w-6 h-5 rounded-[2px] overflow-hidden border border-slate-300 dark:border-slate-600 shadow-2xs shrink-0">
                <div className="h-1/2 bg-white" />
                <div className="h-1/2 bg-[#D52B1E]" />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-[#002D62] dark:text-white font-sans">
                gov<span className="text-[#D52B1E]">.pl</span>
              </span>
            </div>

            <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 hidden sm:block" />

            {/* Pełna nazwa instytucji i podtytuł */}
            <div>
              <h1 className="text-sm sm:text-base font-bold text-[#002D62] dark:text-white tracking-tight leading-snug">
                Ministerstwo Funduszy i Polityki Regionalnej
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                RiskMiner AI — System Analizy Ryzyk Inwestycji Publicznych
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-semibold text-[#002D62] dark:text-sky-300">
              <Building2 className="size-3.5 text-[#D52B1E]" strokeWidth={1.75} />
              <span>Programy: FEnIKS • KPO • Fundusze Europejskie 2021–2027</span>
            </div>

            <button
              type="button"
              onClick={() => setIsDarkMode((prev) => !prev)}
              aria-label={isDarkMode ? "Przełącz na motyw jasny GovTech" : "Przełącz na motyw ciemny"}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-[#002D62] dark:text-white transition-colors cursor-pointer"
            >
              {isDarkMode ? (
                <>
                  <Sun className="size-4 text-amber-400" strokeWidth={1.75} />
                  <span className="hidden md:inline">Tryb Jasny</span>
                </>
              ) : (
                <>
                  <Moon className="size-4 text-[#002D62]" strokeWidth={1.75} />
                  <span className="hidden md:inline">Tryb Ciemny</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pasek okruszków (breadcrumbs) gov.pl */}
        <div className="bg-[#E5E7EB]/60 dark:bg-[#0E1A2D] border-t border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 lg:px-8 py-1.5 text-xs text-slate-600 dark:text-slate-400">
          <div className="max-w-7xl mx-auto flex items-center gap-1.5">
            <span className="hover:underline cursor-pointer">Strona główna</span>
            <span className="text-slate-400">/</span>
            <span className="hover:underline cursor-pointer">Inwestycje i Fundusze UE</span>
            <span className="text-slate-400">/</span>
            <span className="font-semibold text-[#002D62] dark:text-white">RiskMiner AI</span>
          </div>
        </div>
      </header>

      {/* GŁÓWNA ZAWARTOŚĆ STRONY */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Pasek statusu operacyjnego */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 px-4 py-2.5 shadow-2xs">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#002D62] dark:text-slate-200">
            {isAnalyzing ? (
              <Cpu className="size-4 text-[#D52B1E] animate-spin shrink-0" strokeWidth={1.75} />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
            )}
            <span className="font-semibold">{statusBanner}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-mono">
            <span>Projekt: {report.projectId}</span>
            <span>•</span>
            <span>Silnik: {report.modelEngine}</span>
            <span>•</span>
            <span>Ryzyk w macierzy: {report.risks.length}</span>
          </div>
        </div>

        {/* =====================================================================
            SEKCJA 1: PANEL WEJŚCIOWY INWESTYCJI
           ===================================================================== */}
        <section
          aria-labelledby="investment-input-heading"
          className="rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 shadow-xs overflow-hidden"
        >
          <div className="bg-slate-50/90 dark:bg-slate-900/50 border-b border-[#D1D5DB] dark:border-slate-800 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center size-6 rounded-md bg-[#002D62] text-white text-xs font-bold">
                  1
                </span>
                <h2
                  id="investment-input-heading"
                  className="text-base sm:text-lg font-bold text-[#002D62] dark:text-white"
                >
                  Panel Wejściowy Inwestycji Publicznej (Wieloźródłowa Ingestia Danych)
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Wgraj dokumentację przetargową/HRF, podyktuj notatkę z rady budowy lub załaduj przypadek demonstracyjny Jury MFiPR.
              </p>
            </div>

            {/* Przełącznik RODO Shield */}
            <div className="flex items-center gap-3 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 rounded-xl px-3.5 py-2">
              <div className="flex items-center gap-2">
                {rodoShieldEnabled ? (
                  <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
                ) : (
                  <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400 shrink-0" strokeWidth={1.75} />
                )}
                <div>
                  <label
                    htmlFor="rodo-shield-toggle"
                    className="text-xs font-bold text-[#002D62] dark:text-emerald-100 cursor-pointer block"
                  >
                    RODO Shield (Lokalne maskowanie danych wykonawców i PESEL)
                  </label>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 block">
                    {rodoShieldEnabled
                      ? `Aktywny w przeglądarce • Zamaskowano ${rodoMaskResult.maskedCount} encji wrażliwych`
                      : "Ostrzeżenie: Dane osobowe i nazwy spółek nie są maskowane"}
                  </span>
                </div>
              </div>

              <button
                id="rodo-shield-toggle"
                type="button"
                role="switch"
                aria-checked={rodoShieldEnabled}
                onClick={() => setRodoShieldEnabled((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  rodoShieldEnabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    rodoShieldEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Strefa Drag & Drop + Przycisk Demo Jury MFiPR */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleDropFile}
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed p-5 transition-all cursor-pointer ${
                  isDraggingFile
                    ? "border-[#D52B1E] bg-red-50/50 dark:border-red-400 dark:bg-red-950/20"
                    : "border-slate-300 dark:border-slate-700 hover:border-[#D52B1E] dark:hover:border-red-400 bg-slate-50/60 dark:bg-slate-900/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.csv,.txt"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="size-11 rounded-full bg-[#002D62]/10 dark:bg-sky-400/10 flex items-center justify-center mb-2.5">
                  <Upload className="size-5 text-[#002D62] dark:text-sky-400" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-bold text-[#002D62] dark:text-white">
                  Przeciągnij i upuść dokument lub kliknij, aby wybrać
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Obsługiwane formaty: <span className="font-mono font-semibold">.pdf, .csv, .txt</span> (Multimodalny PDF lub dane tabelaryczne)
                </p>

                {uploadedFileName && (
                  <div className="mt-3.5 inline-flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-[#002D62] dark:text-sky-300 shadow-2xs">
                    <FileText className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
                    <span className="truncate max-w-[210px]">{uploadedFileName}</span>
                    {uploadedFileSize && (
                      <span className="text-slate-400 font-mono">({uploadedFileSize})</span>
                    )}
                  </div>
                )}
              </div>

              {/* Przycisk „Załaduj przykładową inwestycję (Demo Jury MFiPR)” */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 p-3.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#002D62] dark:text-sky-300">
                    Scenariusz Referencyjny HackNation 2026
                  </span>
                  <span className="text-[11px] font-mono bg-slate-200 dark:bg-slate-800 text-[#002D62] dark:text-sky-300 px-2 py-0.5 rounded font-bold">
                    FEnIKS • 148 mln PLN
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLoadDemoJuryInvestment}
                  disabled={isAnalyzing}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#002D62] hover:bg-[#002047] active:bg-[#001733] text-white font-bold text-xs sm:text-sm px-4 py-2.5 shadow-xs transition-all cursor-pointer"
                >
                  <Sparkles className="size-4 shrink-0 text-amber-400" strokeWidth={1.75} />
                  <span>Załaduj przykładową inwestycję (Demo Jury MFiPR)</span>
                </button>
              </div>
            </div>

            {/* Opis tekstowy lub notatka głosowa */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="investment-description-textarea"
                  className="text-xs sm:text-sm font-bold text-[#002D62] dark:text-slate-100 flex items-center gap-2"
                >
                  <span>Opis tekstowy inwestycji / Notatka z Rady Budowy lub Komisji Przetargowej</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMaskedPreview((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    {showMaskedPreview ? (
                      <>
                        <EyeOff className="size-3.5 text-emerald-600" strokeWidth={1.75} />
                        <span>Pokaż oryginał</span>
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5 text-emerald-600" strokeWidth={1.75} />
                        <span>Podgląd RODO Shield</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleVoiceDictation}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      isRecording
                        ? "bg-[#D52B1E] text-white animate-pulse shadow-sm"
                        : "bg-slate-100 text-[#002D62] hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="size-3.5" strokeWidth={1.75} />
                        <span>Zatrzymaj dyktowanie (Auto-stop 3 s)</span>
                      </>
                    ) : (
                      <>
                        <Mic className="size-3.5 text-[#D52B1E]" strokeWidth={1.75} />
                        <span>Notatka głosowa (pl-PL)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {speechStatusMessage && (
                <div className="rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-3 py-1.5 text-xs text-sky-900 dark:text-sky-200 flex items-center justify-between gap-2">
                  <span>{speechStatusMessage}</span>
                  <button
                    type="button"
                    onClick={() => setSpeechStatusMessage(null)}
                    className="text-sky-600 dark:text-sky-400 hover:underline text-[11px]"
                  >
                    Ukryj
                  </button>
                </div>
              )}

              {showMaskedPreview ? (
                <div className="w-full min-h-[168px] max-h-[220px] overflow-y-auto rounded-xl border border-emerald-400/80 bg-emerald-950/5 dark:bg-emerald-950/30 p-3.5 text-xs font-mono leading-relaxed text-[#002D62] dark:text-emerald-100 whitespace-pre-wrap">
                  <div className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400 mb-1.5">
                    [PODGLĄD DANYCH PO MASKOWANIU LOKALNYM RODO SHIELD – GOTOWE DO WYSYŁKI DO MODELU AI]:
                  </div>
                  {rodoMaskResult.processedText}
                </div>
              ) : (
                <textarea
                  id="investment-description-textarea"
                  rows={6}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Wklej opis inwestycji publicznej, wyciąg z protokołu rady budowy, odwołania KIO, problemów z decyzją ZRID lub użyj przycisku Notatka głosowa..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-3.5 text-xs sm:text-sm text-[#002D62] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D52B1E] font-sans leading-relaxed"
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Długość wsadu: <span className="font-mono font-semibold">{inputText.length}</span> znaków •{" "}
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                    Strict Grounding: Eliminacja halucynacji AI
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => void analyzeInvestment({ forceLiveAi: true })}
                    disabled={isAnalyzing}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#D52B1E] hover:bg-[#B01F15] active:bg-[#921910] text-white font-bold text-xs sm:text-sm px-5 py-2.5 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                  >
                    <Sparkles className="size-4" strokeWidth={1.75} />
                    <span>
                      {isAnalyzing
                        ? "Analizowanie przez Gemini 2.5 Flash..."
                        : "Przeanalizuj z AI na żywo (Gemini 2.5 Flash)"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            SEKCJA 2: 4 KARTY KPI
           ===================================================================== */}
        <section aria-label="Kluczowe Wskaźniki Ryzyka Inwestycji (KPI)">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Ogólny Indeks Ryzyka
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold font-mono text-[#002D62] dark:text-white">
                      {simulationMetrics.dynamicRiskIndex}
                    </span>
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      / 100 pkt
                    </span>
                  </div>
                </div>
                <div
                  className={`size-10 rounded-xl flex items-center justify-center ${
                    simulationMetrics.dynamicRiskIndex >= 75
                      ? "bg-[#D52B1E]/10 text-[#D52B1E]"
                      : simulationMetrics.dynamicRiskIndex >= 50
                      ? "bg-orange-500/10 text-orange-600"
                      : "bg-emerald-500/10 text-emerald-600"
                  }`}
                >
                  <Activity className="size-5" strokeWidth={1.75} />
                </div>
              </div>

              <div className="mt-4">
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      simulationMetrics.dynamicRiskIndex >= 75
                        ? "bg-[#D52B1E]"
                        : simulationMetrics.dynamicRiskIndex >= 55
                        ? "bg-orange-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${simulationMetrics.dynamicRiskIndex}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 flex items-center justify-between">
                  <span>Aktywne ryzyka: {activeUnrejectedRisks.length}/{report.risks.length}</span>
                  <span className="font-semibold text-[#D52B1E] dark:text-red-400">
                    {simulationMetrics.dynamicRiskIndex >= 75 ? "Stan Alarmowy" : "Podwyższony"}
                  </span>
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Ryzyka Krytyczne i Wysokie
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold font-mono text-[#D52B1E] dark:text-red-400">
                      {simulationMetrics.criticalAndHighTotal}
                    </span>
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      z {activeUnrejectedRisks.length} aktywnych
                    </span>
                  </div>
                </div>
                <div className="size-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <AlertTriangle className="size-5" strokeWidth={1.75} />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-md bg-[#D52B1E]/10 text-[#D52B1E] dark:bg-[#D52B1E]/20 dark:text-red-300 px-2 py-0.5 text-xs font-bold">
                  {simulationMetrics.criticalCount} Krytyczne
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-orange-500/15 text-orange-700 dark:text-orange-300 px-2 py-0.5 text-xs font-bold">
                  {simulationMetrics.highCount} Wysokie
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                  Wymaga Komitetu
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Opóźnienie Ścieżki Krytycznej
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold font-mono text-[#002D62] dark:text-white">
                      +{simulationMetrics.totalDelayDays}
                    </span>
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      dni kalendarzowych
                    </span>
                  </div>
                </div>
                <div className="size-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Clock className="size-5" strokeWidth={1.75} />
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>Bazowe: <strong>+{report.criticalPathDelayDays} dni</strong></span>
                <span className="font-mono text-amber-700 dark:text-amber-300 font-semibold">
                  What-If: +{proceduralDelaySliderDays} dni
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Zagrożony Budżet / Kwalifikowalność UE
                  </p>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#D52B1E] dark:text-red-400">
                      {formatPln(simulationMetrics.simulatedThreatenedBudgetPln)}
                    </span>
                  </div>
                </div>
                <div className="size-10 rounded-xl bg-[#D52B1E]/10 text-[#D52B1E] flex items-center justify-center shrink-0">
                  <Banknote className="size-5" strokeWidth={1.75} />
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>Dofinansowanie UE: {formatPln(report.euFundingPln)}</span>
                <span className="font-semibold text-[#002D62] dark:text-sky-300">
                  {Math.round(
                    (simulationMetrics.simulatedThreatenedBudgetPln / report.euFundingPln) * 100
                  )}
                  % dotacji
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            SEKCJA 3: INTERAKTYWNA MACIERZ RYZYKA 5×5 + SYMULATOR „WHAT-IF”
           ===================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#D1D5DB] dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center size-6 rounded-md bg-[#002D62] text-white text-xs font-bold">
                      2
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-[#002D62] dark:text-white">
                      Interaktywna Macierz Ryzyka 5×5 (Prawdopodobieństwo × Wpływ)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Kliknij dowolną komórkę siatki, aby przefiltrować listę ryzyk i planów mitygacji poniżej.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedMatrixCell(null);
                    setSelectedCategoryFilter("ALL");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border ${
                    selectedMatrixCell === null && selectedCategoryFilter === "ALL"
                      ? "bg-[#002D62] text-white border-[#002D62] dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500"
                      : "bg-slate-100 hover:bg-slate-200 text-[#002D62] border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                  }`}
                >
                  <RotateCcw className="size-3.5" strokeWidth={1.75} />
                  <span>Pokaż wszystkie ({report.risks.length})</span>
                </button>
              </div>

              <div className="mt-4">
                <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
                  <div className="grid grid-rows-5 gap-2 text-right pr-1">
                    {PROBABILITY_AXIS.map((prob) => (
                      <div
                        key={`prob-label-${prob}`}
                        className="h-16 sm:h-18 flex flex-col justify-center text-[11px] leading-tight font-semibold text-slate-600 dark:text-slate-300"
                      >
                        <span className="font-bold text-[#002D62] dark:text-white">P = {prob}</span>
                        <span className="hidden sm:inline text-[10px] text-slate-500 dark:text-slate-400">
                          {PROBABILITY_LABELS[prob].split("–")[1]}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {PROBABILITY_AXIS.map((prob) =>
                      IMPACT_AXIS.map((imp) => {
                        const cellRisks = getRisksInMatrixCell(prob, imp);
                        const isSelected =
                          selectedMatrixCell?.probability === prob &&
                          selectedMatrixCell?.impact === imp;
                        const score = prob * imp;

                        return (
                          <button
                            key={`cell-p${prob}-i${imp}`}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedMatrixCell(null);
                              } else {
                                setSelectedMatrixCell({ probability: prob, impact: imp });
                              }
                            }}
                            title={`Prawdopodobieństwo ${prob}/5 × Wpływ ${imp}/5 (Wynik: ${score}/25) – Liczba ryzyk: ${cellRisks.length}`}
                            className={`h-16 sm:h-18 rounded-xl border p-1.5 flex flex-col items-center justify-between transition-all cursor-pointer ${getMatrixCellClasses(
                              prob,
                              imp,
                              isSelected,
                              cellRisks.length > 0
                            )}`}
                          >
                            <div className="w-full flex items-center justify-between text-[10px] font-mono opacity-85 px-0.5">
                              <span>P{prob}×W{imp}</span>
                              <span>{score}p</span>
                            </div>

                            <div className="text-lg sm:text-xl font-extrabold font-mono leading-none">
                              {cellRisks.length}
                            </div>

                            <div className="w-full truncate text-[9px] font-mono font-semibold text-center">
                              {cellRisks.length > 0 ? cellRisks.map((r) => r.code).join(", ") : "—"}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[auto_1fr] gap-3 mt-2">
                  <div className="w-12 sm:w-28" />
                  <div className="grid grid-cols-5 gap-2 text-center">
                    {IMPACT_AXIS.map((imp) => (
                      <div
                        key={`imp-label-${imp}`}
                        className="text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                      >
                        <span className="font-bold text-[#002D62] dark:text-white block">W = {imp}</span>
                        <span className="hidden sm:block text-[10px] text-slate-500 dark:text-slate-400">
                          {IMPACT_LABELS[imp].split("–")[1]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-[#D1D5DB] dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-xs bg-emerald-500 inline-block" />
                  <span>Niskie (1–4 pkt)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-xs bg-amber-400 inline-block" />
                  <span>Średnie (5–9 pkt)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-xs bg-orange-500 inline-block" />
                  <span>Wysokie (10–15 pkt)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-xs bg-[#D52B1E] inline-block" />
                  <span className="font-semibold text-[#D52B1E] dark:text-red-400">
                    Krytyczne (16–25 pkt)
                  </span>
                </span>
              </div>

              {selectedMatrixCell && (
                <span className="font-mono text-xs font-bold text-[#002D62] dark:text-sky-400">
                  Aktywny filtr: P={selectedMatrixCell.probability} × W={selectedMatrixCell.impact}
                </span>
              )}
            </div>
          </div>

          {/* Symulator Scenariuszy „What-If” */}
          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#D1D5DB] dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center size-6 rounded-md bg-[#002D62] text-white text-xs font-bold">
                      3
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-[#002D62] dark:text-white">
                      Symulator Scenariuszy „What-If”
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Symulacja wrażliwości harmonogramu i budżetu w czasie rzeczywistym.
                  </p>
                </div>
                <SlidersHorizontal className="size-5 text-[#002D62] dark:text-sky-400 shrink-0" strokeWidth={1.75} />
              </div>

              {/* Suwak 1 */}
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="slider-procedural-delay"
                    className="text-xs sm:text-sm font-bold text-[#002D62] dark:text-slate-100"
                  >
                    1. Opóźnienie procedur / odwołań KIO / decyzji ZRID
                  </label>
                  <span className="font-mono text-sm font-extrabold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-lg">
                    +{proceduralDelaySliderDays} dni
                  </span>
                </div>
                <input
                  id="slider-procedural-delay"
                  type="range"
                  min={0}
                  max={120}
                  step={5}
                  value={proceduralDelaySliderDays}
                  onChange={(e) => setProceduralDelaySliderDays(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#002D62] dark:accent-sky-400"
                />
                <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <span>0 dni (Plan bazowy)</span>
                  <span>+60 dni (Spór KIO)</span>
                  <span>+120 dni (Korekta ZRID/OOŚ)</span>
                </div>
              </div>

              {/* Suwak 2 */}
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="slider-cost-indexation"
                    className="text-xs sm:text-sm font-bold text-[#002D62] dark:text-slate-100"
                  >
                    2. Wzrost kosztów materiałów i robót / waloryzacja
                  </label>
                  <span className="font-mono text-sm font-extrabold text-[#D52B1E] dark:text-red-300 bg-[#D52B1E]/10 px-2.5 py-0.5 rounded-lg">
                    +{costIndexationSliderPercent}%
                  </span>
                </div>
                <input
                  id="slider-cost-indexation"
                  type="range"
                  min={0}
                  max={25}
                  step={1}
                  value={costIndexationSliderPercent}
                  onChange={(e) => setCostIndexationSliderPercent(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#D52B1E]"
                />
                <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <span>0% (Kosztorys bazowy)</span>
                  <span>+10% (Limit umowny Pzp)</span>
                  <span>+25% (Szok cenowy)</span>
                </div>
              </div>

              {/* Wyliczenia */}
              <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Bazowy termin zakończenia kontraktu:</span>
                  <span className="font-mono font-semibold text-[#002D62] dark:text-slate-200">
                    {report.basePlannedEndDate}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-[#002D62] dark:text-white">Nowa prognozowana data zakończenia:</span>
                  <span className="font-mono font-extrabold text-base text-[#002D62] dark:text-sky-400">
                    {simulationMetrics.projectedEndDate}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-[#002D62] dark:text-white">Dodatkowy koszt waloryzacji i robót:</span>
                  <span className="font-mono font-extrabold text-base text-[#D52B1E] dark:text-red-400">
                    +{formatPln(simulationMetrics.additionalIndexationCostPln)}
                  </span>
                </div>
              </div>

              {/* Alert unijny */}
              <div
                role="alert"
                className={`mt-4 rounded-xl border p-3.5 flex items-start gap-3 transition-colors ${
                  simulationMetrics.exceedsEuDeadline
                    ? "bg-[#D52B1E]/10 border-[#D52B1E] text-[#D52B1E] dark:bg-[#D52B1E]/20 dark:text-red-200"
                    : "bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-200"
                }`}
              >
                {simulationMetrics.exceedsEuDeadline ? (
                  <AlertTriangle className="size-5 text-[#D52B1E] dark:text-red-400 shrink-0 mt-0.5" strokeWidth={1.75} />
                ) : (
                  <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" strokeWidth={1.75} />
                )}
                <div className="text-xs leading-relaxed">
                  <p className="font-bold uppercase tracking-wide">
                    {simulationMetrics.exceedsEuDeadline
                      ? `ALARM KWALIFIKOWALNOŚCI UE: Przekroczono termin rozliczenia perspektywy (${report.euSettlementDeadline})!`
                      : `Kwalifikowalność FEnIKS zachowana (Termin graniczny: ${report.euSettlementDeadline})`}
                  </p>
                  <p className="mt-1">
                    {simulationMetrics.exceedsEuDeadline
                      ? `Prognozowany termin zakończenia (${simulationMetrics.projectedEndDate}) wykracza o ${simulationMetrics.daysAfterEuDeadline} dni poza horyzont kwalifikowalności wydatków UE. Zagrożenie utratą dofinansowania w kwocie do ${formatPln(
                          report.euFundingPln
                        )}.`
                      : `Do krytycznego terminu rozliczenia perspektywy unijnej pozostało ${Math.abs(
                          simulationMetrics.daysAfterEuDeadline
                        )} dni buforu bezpieczeństwa.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-[#D1D5DB] dark:border-slate-800">
              <button
                type="button"
                onClick={handleDownloadSteeringCommitteeReport}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#002D62] hover:bg-[#002047] active:bg-[#001733] text-white font-bold text-xs sm:text-sm px-4 py-3 shadow-sm transition-all cursor-pointer"
              >
                <Download className="size-4 shrink-0" strokeWidth={1.75} />
                <span>Pobierz Kartę Ryzyka dla Komitetu Sterującego (.txt)</span>
              </button>
            </div>
          </div>
        </section>

        {/* =====================================================================
            SEKCJA 4: LISTA RYZYK Z MECHANIZMEM STRICT GROUNDING & HUMAN-IN-THE-LOOP
           ===================================================================== */}
        <section
          aria-labelledby="risks-list-heading"
          className="rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 p-5 shadow-xs space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#D1D5DB] dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center size-6 rounded-md bg-[#002D62] text-white text-xs font-bold">
                  4
                </span>
                <h2
                  id="risks-list-heading"
                  className="text-base sm:text-lg font-bold text-[#002D62] dark:text-white"
                >
                  Lista Zidentyfikowanych Ryzyk i Planów Mitygacji ({filteredRisks.length})
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Każde ryzyko posiada przypisany dosłowny cytat z dokumentacji (Strict Grounding) oraz wymaga zatwierdzenia przez eksperta.
              </p>
            </div>

            {/* Licznik Human-in-the-Loop */}
            <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-xs font-mono">
              <UserCheck className="size-4 text-[#002D62] dark:text-sky-400" strokeWidth={1.75} />
              <span>
                <strong>Status AI Act (HITL):</strong>{" "}
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  Zatwierdzone: {humanInTheLoopStats.approved}
                </span>{" "}
                •{" "}
                <span className="text-[#D52B1E] dark:text-red-400 font-bold">
                  Odrzucone: {humanInTheLoopStats.rejected}
                </span>{" "}
                •{" "}
                <span className="text-amber-700 dark:text-amber-300 font-bold">
                  Do przeglądu: {humanInTheLoopStats.pending}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1 inline-flex items-center gap-1">
              <Filter className="size-3.5" strokeWidth={1.75} />
              <span>Kategoria:</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter("ALL")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                selectedCategoryFilter === "ALL"
                  ? "bg-[#002D62] text-white dark:bg-sky-500 dark:text-slate-950"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              Wszystkie ({report.risks.length})
            </button>
            {RISK_CATEGORIES.map((category) => {
              const count = report.risks.filter((r) => r.category === category).length;
              return (
                <button
                  key={`filter-btn-${category}`}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(category)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    selectedCategoryFilter === category
                      ? "bg-[#002D62] text-white dark:bg-sky-500 dark:text-slate-950"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {category} ({count})
                </button>
              );
            })}
          </div>

          <div className="rounded-xl bg-[#002D62]/5 dark:bg-slate-900/80 border border-[#002D62]/15 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#002D62] dark:text-sky-400">
                Synteza Zarządcza dla Komitetu Sterującego • {report.projectTitle}
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {report.fundingProgram}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {report.executiveSummary}
            </p>
          </div>

          {filteredRisks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
              <p className="text-sm font-bold text-[#002D62] dark:text-white">
                Brak zidentyfikowanych ryzyk dla wybranego filtra komórki macierzy
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedMatrixCell(null);
                  setSelectedCategoryFilter("ALL");
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#002D62] text-white px-4 py-2 text-xs font-bold cursor-pointer"
              >
                <RotateCcw className="size-3.5" strokeWidth={1.75} />
                <span>Pokaż wszystkie ryzyka</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {RISK_CATEGORIES.map((category) => {
                const categoryItems = groupedRisksByCategory[category];
                if (categoryItems.length === 0) return null;

                return (
                  <div key={`group-${category}`} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#D1D5DB] dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        {renderCategoryIcon(category)}
                        <h3 className="text-sm sm:text-base font-bold text-[#002D62] dark:text-white">
                          Kategoria: {category}
                        </h3>
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-mono font-bold text-[#002D62] dark:text-sky-300">
                          {categoryItems.length}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {categoryItems.map((risk) => {
                        const isRejected = risk.verificationStatus === "rejected";
                        const isApproved = risk.verificationStatus === "approved";

                        return (
                          <article
                            key={risk.id}
                            className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-all ${
                              isRejected
                                ? "opacity-50 bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 line-through"
                                : isApproved
                                ? "bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-500/50 shadow-xs"
                                : "bg-[#F8FAFC] dark:bg-slate-900/60 border-[#D1D5DB] dark:border-slate-800 hover:border-[#002D62]/40 dark:hover:border-sky-500/40"
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#002D62] text-white dark:bg-slate-800 dark:text-sky-300">
                                    {risk.code}
                                  </span>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${getSeverityBadgeClasses(
                                      risk.severity
                                    )}`}
                                  >
                                    Ryzyko {risk.severity}
                                  </span>
                                  {isApproved && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-bold">
                                      <Check className="size-3" strokeWidth={2} /> Zweryfikowane (HITL)
                                    </span>
                                  )}
                                  {isRejected && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-[#D52B1E] dark:bg-red-900/50 dark:text-red-300 px-2 py-0.5 text-[11px] font-bold">
                                      <Ban className="size-3" strokeWidth={2} /> Odrzucone (Wykluczone z KPI)
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                                  P:{risk.probability}/5 × W:{risk.impact}/5 ({risk.probability * risk.impact} pkt)
                                </span>
                              </div>

                              <h4 className="text-sm sm:text-base font-bold text-[#002D62] dark:text-white mt-2.5 leading-snug">
                                {risk.title}
                              </h4>

                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-mono">
                                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold">
                                  <Clock className="size-3.5" strokeWidth={1.75} />
                                  Opóźnienie: +{risk.estimatedDelayDays} dni
                                </span>
                                <span className="inline-flex items-center gap-1 text-[#D52B1E] dark:text-red-400 font-semibold">
                                  <Banknote className="size-3.5" strokeWidth={1.75} />
                                  Ekspozycja: {formatPln(risk.budgetAtRiskPln)}
                                </span>
                              </div>

                              <div className="mt-3 rounded-lg bg-white dark:bg-[#152238] border border-slate-200/80 dark:border-slate-800 p-3">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Przyczyna źródłowa (Root Cause):
                                </p>
                                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                                  {risk.rootCause}
                                </p>
                              </div>

                              {/* WIDOCZNY DOWÓD W DOKUMENCIE (STRICT GROUNDING) */}
                              <div className="mt-2.5 rounded-lg bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 p-3">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-[#002D62] dark:text-sky-300 flex items-center gap-1.5">
                                  <BookOpen className="size-3.5" strokeWidth={1.75} />
                                  <span>Źródło w dokumencie (Strict Grounding):</span>
                                </p>
                                <p className="text-xs font-mono text-slate-800 dark:text-sky-200 mt-1 italic leading-relaxed">
                                  {risk.sourceCitation}
                                </p>
                              </div>

                              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                                <span className="font-bold text-[#002D62] dark:text-sky-300">
                                  Podstawa formalna / PZP:
                                </span>
                                <span className="font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700">
                                  {risk.legalBasis}
                                </span>
                              </div>

                              <div className="mt-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 p-3">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                                  <ChevronRight className="size-3.5" strokeWidth={1.75} />
                                  <span>Rekomendacja naprawcza (Plan Mitygacji):</span>
                                </p>
                                <p className="text-xs text-slate-800 dark:text-slate-200 mt-1 leading-relaxed font-medium">
                                  {risk.mitigationPlan}
                                </p>
                              </div>
                            </div>

                            {/* PANELE HUMAN-IN-THE-LOOP */}
                            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                Jednostka: {risk.ownerUnit}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateRiskStatus(risk.id, "approved")}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                    isApproved
                                      ? "bg-emerald-600 text-white"
                                      : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                  }`}
                                >
                                  <Check className="size-3" strokeWidth={2} />
                                  <span>{isApproved ? "Zatwierdzono" : "Zatwierdź do rejestru"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateRiskStatus(risk.id, "rejected")}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                    isRejected
                                      ? "bg-[#D52B1E] text-white"
                                      : "bg-red-50 text-[#D52B1E] hover:bg-red-100 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800"
                                  }`}
                                >
                                  <Ban className="size-3" strokeWidth={2} />
                                  <span>{isRejected ? "Odrzucono" : "Odrzuć (False Positive)"}</span>
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* STOPKA W STYLU GOV.PL (#1B2432) */}
      <footer className="mt-auto bg-[#1B2432] text-slate-300 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-700/60">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex flex-col w-5 h-4 rounded-[1px] overflow-hidden border border-slate-400 shrink-0">
                  <div className="h-1/2 bg-white" />
                  <div className="h-1/2 bg-[#D52B1E]" />
                </div>
                <p className="text-sm font-bold text-white tracking-wide">
                  Ministerstwo Funduszy i Polityki Regionalnej
                </p>
              </div>
              <p className="text-xs text-slate-400">
                RiskMiner AI — Proaktywny System Analizy Ryzyk Inwestycji Publicznych
              </p>
            </div>

            <nav
              aria-label="Informacje prawne i dostępność cyfrowa"
              className="flex flex-wrap items-center gap-4 text-xs font-medium"
            >
              <button
                type="button"
                onClick={() => setActiveFooterModal("rodo")}
                className="text-slate-300 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
              >
                Klauzula RODO
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={() => setActiveFooterModal("terms")}
                className="text-slate-300 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
              >
                Regulamin
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={() => setActiveFooterModal("wcag")}
                className="text-slate-300 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
              >
                Deklaracja dostępności WCAG 2.1
              </button>
            </nav>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
            <p>
              Architektura i wdrożenie: WebDevAI (webdevai.eu) • Licencja MIT • Prototyp konkursowy HackNation 2026
            </p>
            <p className="font-mono text-[11px] text-slate-400">
              MFiPR × RiskMiner AI v1.0-prod
            </p>
          </div>
        </div>
      </footer>

      {activeFooterModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
        >
          <div className="max-w-lg w-full rounded-2xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-700 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Info className="size-5 text-[#002D62] dark:text-sky-400" strokeWidth={1.75} />
                <h3 className="text-base font-bold text-[#002D62] dark:text-white">
                  {activeFooterModal === "rodo" && "Klauzula Informacyjna RODO i Architektura Privacy-by-Design"}
                  {activeFooterModal === "terms" && "Regulamin Systemu Analitycznego MFiPR × RiskMiner AI"}
                  {activeFooterModal === "wcag" && "Deklaracja Dostępności Cyfrowej (WCAG 2.1 Poziom AA)"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveFooterModal(null)}
                aria-label="Zamknij okno"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="size-5" strokeWidth={1.75} />
              </button>
            </div>

            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-2.5 leading-relaxed">
              {activeFooterModal === "rodo" && (
                <>
                  <p>
                    Moduł <strong>RODO Shield</strong> działa bezpośrednio w pamięci przeglądarki użytkownika (Edge Anonymization) przed jakimkolwiek przesłaniem tekstu do modeli językowych AI.
                  </p>
                  <p>
                    Numery PESEL, NIP oraz dane osobowe kierowników kontraktów i wykonawców są automatycznie zastępowane tokenami anonimizującymi zgodnie z art. 25 oraz art. 32 Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO).
                  </p>
                </>
              )}
              {activeFooterModal === "terms" && (
                <>
                  <p>
                    System <strong>RiskMiner AI</strong> stanowi narzędzie wspomagania decyzji (Decision Support System) dla ekspertów Ministerstwa Funduszy i Polityki Regionalnej, Instytucji Pośredniczących (CUPT) oraz Beneficjentów projektów kluczowych.
                  </p>
                  <p>
                    Generowane predykcje ścieżki krytycznej oraz kalkulacje w symulatorze „What-If” mają charakter analityczno-doradczy dla Komitetów Sterujących. Oprogramowanie udostępnione na licencji MIT przez zespół WebDevAI (webdevai.eu).
                  </p>
                </>
              )}
              {activeFooterModal === "wcag" && (
                <>
                  <p>
                    Interfejs <strong>MFiPR × RiskMiner AI</strong> został zaprojektowany zgodnie z wymogami ustawy z dnia 4 kwietnia 2019 r. o dostępności cyfrowej stron internetowych i aplikacji mobilnych podmiotów publicznych (standard <strong>WCAG 2.1 AA</strong>).
                  </p>
                  <p>
                    Zapewniono wysoki kontrast typografii bezszeryfowej (Geist), pełną nawigację klawiaturową, semantyczne znaczniki ARIA, komunikaty głosowe (Web Speech API pl-PL) oraz czytelne kodowanie poziomów ryzyka.
                  </p>
                </>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveFooterModal(null)}
                className="rounded-xl bg-[#002D62] text-white dark:bg-sky-500 dark:text-slate-950 px-4 py-2 text-xs font-bold cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
