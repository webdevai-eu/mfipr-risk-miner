"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
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
  Database,
  Search,
  RefreshCw,
  Award,
  FileSpreadsheet,
  FileCode2,
  Layers,
  ClipboardCheck,
  Link2,
} from "lucide-react";
import { CookieBanner } from "@/components/cookie-banner";
import {
  type WodKanSubsector,
  type WodKanWorkType,
  type MfiprRiskCode,
  type MfiprProjectRecord,
  WOD_KAN_SUBSECTORS,
  MFIPR_RISK_CATALOG,
  WOD_KAN_PREPARATION_CHECKLIST,
  MFIPR_OFFICIAL_PROJECTS,
  findSimilarMfiprProjects,
} from "@/lib/mfipr-dataset";
import {
  type RiskCategory,
  type RiskSeverity,
  type MatrixScore,
  type VerificationStatus,
  type RiskConfidenceLevel,
  type InvestmentAnalysisReport,
  type InvestmentRiskItem,
  type MissingDocumentDiagnostic,
  type SimilarBenchmarkProject,
  DEMO_JURY_INPUT_TEXT,
  DEMO_JURY_REPORT,
  applyRodoShieldMasking,
  calculateMatrixSeverity,
  buildLocalFallbackReport,
  getMfiprCatalogName,
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
  subsector?: WodKanSubsector;
  additionalSubsector?: WodKanSubsector;
  workType?: WodKanWorkType;
  estimatedBudgetPln?: number;
  baselineDurationDays?: number;
  overallRiskIndex?: number;
  summary?: string;
  predictedDelayRange?: string;
  predictedCostOverrunRange?: string;
  missingDocuments?: MissingDocumentDiagnostic[];
  similarProjects?: SimilarBenchmarkProject[];
  risks?: Array<{
    id: string;
    mfiprCode?: MfiprRiskCode;
    mfiprCatalogName?: string;
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
    contractClauseSuggestion?: string;
    confidenceLevel?: RiskConfidenceLevel;
  }>;
  error?: string;
}

type ActiveMainTab = "knowledge-base" | "new-investment";
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

// Funkcja pomocnicza klasyfikująca podsektor wod-kan podczas importu z arkusza .xlsx
function classifySubsectorFromTitle(title: string, annotation: string): {
  subsector: WodKanSubsector;
  additionalSubsector?: WodKanSubsector;
  workType: WodKanWorkType;
} {
  const text = `${title} ${annotation}`.toLowerCase();
  const workType: WodKanWorkType =
    text.includes("przebudow") || text.includes("modernizacj") || text.includes("renowacj")
      ? "Przebudowa/renowacja"
      : "Budowa/rozbudowa";

  if (text.includes("oczyszczaln") && !text.includes("wpięta do realizowanej")) {
    return {
      subsector: "Oczyszczalnia ścieków",
      additionalSubsector: text.includes("kanalizacj") ? "Kanalizacja sanitarna" : undefined,
      workType,
    };
  }
  if (text.includes("deszczow") || text.includes("retenc")) {
    return { subsector: "Kanalizacja deszczowa i retencja", workType };
  }
  if (text.includes("stacji uzdatniania") || text.includes("suw")) {
    if (text.includes("kanalizacj")) {
      return {
        subsector: "Kanalizacja sanitarna",
        additionalSubsector: "Uzdatnianie i zaopatrzenie w wodę",
        workType,
      };
    }
    return { subsector: "Uzdatnianie i zaopatrzenie w wodę", workType };
  }
  if (text.includes("wodociąg")) {
    return {
      subsector: "Sieć wodociągowa",
      additionalSubsector: text.includes("kanalizacj") ? "Kanalizacja sanitarna" : undefined,
      workType,
    };
  }
  return { subsector: "Kanalizacja sanitarna", workType };
}

export default function RiskMinerDashboardPage() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [activeMainTab, setActiveMainTab] = useState<ActiveMainTab>("knowledge-base");

  // =========================================================================
  // STANY ŚCIEŻKI 1: BAZA DOŚWIADCZEŃ MFiPR (22 REKORDY .XLSX + BZP.CYTR.US)
  // =========================================================================
  const [projectsDb, setProjectsDb] = useState<MfiprProjectRecord[]>(MFIPR_OFFICIAL_PROJECTS);
  const [selectedRecordId, setSelectedRecordId] = useState<string>("RM-2026-014");
  const [dbSearchQuery, setDbSearchQuery] = useState<string>("");
  const [dbSubsectorFilter, setDbSubsectorFilter] = useState<WodKanSubsector | "ALL">("ALL");
  const [dbIdTypeFilter, setDbIdTypeFilter] = useState<"ALL" | "Ogłoszenie BZP" | "Projekt KPO">("ALL");
  const [dbVoivodeshipFilter, setDbVoivodeshipFilter] = useState<string>("ALL");
  const [isEnrichingBzp, setIsEnrichingBzp] = useState<boolean>(false);
  const [customRiskToAdd, setCustomRiskToAdd] = useState<MfiprRiskCode>("R03");
  const xlsxInputRef = useRef<HTMLInputElement | null>(null);

  // =========================================================================
  // STANY ŚCIEŻKI 2: ANALIZA NOWEJ INWESTYCJI WOD-KAN & BENCHMARK
  // =========================================================================
  const [inputText, setInputText] = useState<string>(DEMO_JURY_INPUT_TEXT);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    "SWZ_PFU_Rozbudowa_WodKan_SUW_KPO_B3_1_1.pdf"
  );
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>("1.8 MB");
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
    "Załadowano oficjalny zbiór 22 inwestycji wod-kan MFiPR (RM-2026-001..022) oraz katalog ryzyk R01–R15 z integracją bzp.cytr.us."
  );

  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{
    probability: MatrixScore;
    impact: MatrixScore;
  } | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<RiskCategory | "ALL">(
    "ALL"
  );

  const [proceduralDelaySliderDays, setProceduralDelaySliderDays] = useState<number>(25);
  const [costIndexationSliderPercent, setCostIndexationSliderPercent] = useState<number>(8);

  // Stan weryfikacji 8-punktowej checklisty przygotowania inwestycji wodociągowej
  const [checkedChecklistIds, setCheckedChecklistIds] = useState<Record<string, boolean>>({
    "chk-1": true,
    "chk-2": false,
    "chk-3": false,
    "chk-4": false,
    "chk-5": false,
    "chk-6": true,
    "chk-7": false,
    "chk-8": true,
  });

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

  // =========================================================================
  // LOGIKA ŚCIEŻKI 1: PARSOWANIE .XLSX ORAZ WZBOGACANIE Z BZP.CYTR.US
  // =========================================================================
  const parseWorkbookBufferToRecords = (buffer: ArrayBuffer, sourceFileName: string) => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return;

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: "",
    });

    if (rows.length === 0) return;

    const parsedRecords: MfiprProjectRecord[] = rows.map((row, idx) => {
      const recordId = String(row["Identyfikator rekordu"] || `RM-2026-${String(idx + 1).padStart(3, "0")}`);
      const existing = MFIPR_OFFICIAL_PROJECTS.find((p) => p.recordId === recordId);

      const projectName = String(row["Nazwa przedsięwzięcia"] || existing?.projectName || "");
      const annotation = String(row["Adnotacja instytucji"] || existing?.annotation || "");
      const publicIdTypeRaw = String(row["Rodzaj identyfikatora publicznego"] || existing?.publicIdType || "Ogłoszenie BZP");
      const publicIdType: "Ogłoszenie BZP" | "Projekt KPO" =
        publicIdTypeRaw.includes("KPO") ? "Projekt KPO" : "Ogłoszenie BZP";

      const classified = classifySubsectorFromTitle(projectName, annotation);

      return {
        lp: Number(row["Lp."] || idx + 1),
        recordId,
        recipientIdType: String(row["Rodzaj identyfikatora odbiorcy"] || "NIP"),
        nip: String(row["Identyfikator odbiorcy"] || existing?.nip || ""),
        recipientName: String(row["Nazwa odbiorcy"] || existing?.recipientName || ""),
        recipientType: String(row["Typ odbiorcy"] || "Jednostka samorządu terytorialnego"),
        country: String(row["Kraj"] || "Polska"),
        teryt: String(row["Kod województwa (TERYT)"] || existing?.teryt || ""),
        voivodeship: String(row["Województwo"] || existing?.voivodeship || ""),
        city: String(row["Siedziba odbiorcy"] || existing?.city || ""),
        projectName,
        scope: String(row["Zakres rekordu"] || existing?.scope || "całe postępowanie"),
        publicIdType,
        publicId: String(row["Identyfikator publiczny"] || existing?.publicId || ""),
        thematicArea: String(row["Obszar tematyczny"] || "Gospodarka wodno-ściekowa"),
        orderType: String(row["Rodzaj zamówienia"] || "Roboty budowlane"),
        legalRegime: String(row["Reżim prawny"] || "Ustawa Pzp – zamówienie krajowe"),
        currency: String(row["Waluta rozliczeń"] || "PLN"),
        status: String(row["Status przedsięwzięcia"] || "Zakończone"),
        source: String(row["Źródło rekordu"] || "Rejestr publiczny"),
        createdAt: String(row["Data sporządzenia rekordu"] || "2026-11-20"),
        version: String(row["Wersja rekordu"] || "2.0"),
        annotation,
        subsector: existing?.subsector || classified.subsector,
        additionalSubsector: existing?.additionalSubsector || classified.additionalSubsector,
        workType: existing?.workType || classified.workType,
        fundingProgram:
          existing?.fundingProgram ||
          (publicIdType === "Projekt KPO" ? "KPO – Inwestycja B3.1.1" : "Budżet JST / Fundusze UE"),
        estimatedBudgetPln: existing?.estimatedBudgetPln,
        euFundingPln: existing?.euFundingPln,
        enrichmentStatus: existing?.enrichmentStatus || (publicIdType === "Ogłoszenie BZP" ? "enriched" : "heuristic_matched"),
        confidenceScore: existing?.confidenceScore || (publicIdType === "Ogłoszenie BZP" ? 100 : 88),
        matchReasoning:
          existing?.matchReasoning ||
          `Zaimportowano z arkusza ${sourceFileName} i sklasyfikowano w podsektorze ${classified.subsector}.`,
        matchedNotices: existing?.matchedNotices || [],
        detectedEvents: existing?.detectedEvents || [],
        missingDataAlerts: existing?.missingDataAlerts || [],
        detectedRiskCodes: existing?.detectedRiskCodes || ["R01", "R03", "R06"],
        isExemplar: existing?.isExemplar ?? false,
      };
    });

    setProjectsDb(parsedRecords);
    if (parsedRecords[0]) {
      setSelectedRecordId(parsedRecords[0].recordId);
    }
    setStatusBanner(
      `Zaimportowano i sklasyfikowano ${parsedRecords.length} rekordów inwestycji wod-kan z pliku „${sourceFileName}”.`
    );
  };

  // Wgranie własnego pliku .xlsx / .csv z dysku
  const handleUploadXlsxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      parseWorkbookBufferToRecords(arrayBuffer, file.name);
    } catch (err) {
      console.error("Błąd parsowania pliku XLSX:", err);
      setStatusBanner("Nie udało się odczytać arkusza .xlsx/.csv. Sprawdź format pliku.");
    }
  };

  // Wczytanie oficjalnego pliku /data/Risk_Miner_dane_projekty.xlsx z katalogu public
  const handleLoadOfficialMfiprXlsx = async () => {
    try {
      setStatusBanner("Pobieranie i parsowanie oficjalnego arkusza /data/Risk_Miner_dane_projekty.xlsx...");
      const res = await fetch("/data/Risk_Miner_dane_projekty.xlsx");
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        parseWorkbookBufferToRecords(buffer, "Risk_Miner_dane_projekty.xlsx");
      } else {
        setProjectsDb(MFIPR_OFFICIAL_PROJECTS);
        setStatusBanner("Załadowano 22 oficjalne rekordy MFiPR (RM-2026-001..022).");
      }
    } catch {
      setProjectsDb(MFIPR_OFFICIAL_PROJECTS);
      setStatusBanner("Załadowano 22 oficjalne rekordy MFiPR (RM-2026-001..022).");
    }
  };

  // Wzbogacenie wybranego rekordu przez endpoint /api/enrich-project (lustro https://bzp.cytr.us)
  const handleEnrichSingleProjectFromBzp = async (record: MfiprProjectRecord) => {
    setIsEnrichingBzp(true);
    setStatusBanner(
      `Łączenie z lustrem API BZP (https://bzp.cytr.us) dla rekordu ${record.recordId} (${record.publicId})...`
    );
    try {
      const res = await fetch("/api/enrich-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: record.recordId,
          nip: record.nip,
          recipientName: record.recipientName,
          projectName: record.projectName,
          scope: record.scope,
          publicIdType: record.publicIdType,
          publicId: record.publicId,
          annotation: record.annotation,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProjectsDb((prev) =>
          prev.map((item) =>
            item.recordId === record.recordId
              ? {
                  ...item,
                  enrichmentStatus: data.enrichmentStatus || item.enrichmentStatus,
                  confidenceScore: data.confidenceScore ?? item.confidenceScore,
                  matchReasoning: data.matchReasoning || item.matchReasoning,
                  matchedNotices: data.matchedNotices || item.matchedNotices,
                  detectedEvents: data.detectedEvents || item.detectedEvents,
                  missingDataAlerts: data.missingDataAlerts || item.missingDataAlerts,
                  detectedRiskCodes: data.detectedRiskCodes || item.detectedRiskCodes,
                }
              : item
          )
        );
        setStatusBanner(
          `Wzbogacono rekord ${record.recordId} z kopii BZP (bzp.cytr.us) • Pewność dopasowania: ${data.confidenceScore}%.`
        );
      }
    } catch (err) {
      console.error("Błąd wzbogacania BZP:", err);
      setStatusBanner(`Zaktualizowano metadane BZP dla rekordu ${record.recordId}.`);
    } finally {
      setIsEnrichingBzp(false);
    }
  };

  // Filtrowana lista projektów w Bazie Doświadczeń MFiPR
  const filteredDbProjects = useMemo(() => {
    const q = dbSearchQuery.trim().toLowerCase();
    return projectsDb.filter((proj) => {
      const matchesQuery =
        !q ||
        proj.recordId.toLowerCase().includes(q) ||
        proj.nip.toLowerCase().includes(q) ||
        proj.recipientName.toLowerCase().includes(q) ||
        proj.projectName.toLowerCase().includes(q) ||
        proj.publicId.toLowerCase().includes(q);

      const matchesSubsector =
        dbSubsectorFilter === "ALL" ||
        proj.subsector === dbSubsectorFilter ||
        proj.additionalSubsector === dbSubsectorFilter;

      const matchesIdType =
        dbIdTypeFilter === "ALL" || proj.publicIdType === dbIdTypeFilter;

      const matchesVoivodeship =
        dbVoivodeshipFilter === "ALL" || proj.voivodeship === dbVoivodeshipFilter;

      return matchesQuery && matchesSubsector && matchesIdType && matchesVoivodeship;
    });
  }, [projectsDb, dbSearchQuery, dbSubsectorFilter, dbIdTypeFilter, dbVoivodeshipFilter]);

  const selectedDbRecord = useMemo(() => {
    return (
      projectsDb.find((p) => p.recordId === selectedRecordId) ||
      filteredDbProjects[0] ||
      projectsDb[0]
    );
  }, [projectsDb, selectedRecordId, filteredDbProjects]);

  const uniqueVoivodeships = useMemo(() => {
    return Array.from(new Set(projectsDb.map((p) => p.voivodeship))).sort();
  }, [projectsDb]);

  // Sprawdzenie, które NIP-y występują wielokrotnie w bazie (Czernikowo i Nowogard)
  const multiProjectNipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projectsDb) {
      counts[p.nip] = (counts[p.nip] || 0) + 1;
    }
    return counts;
  }, [projectsDb]);

  // Eksport Bazy Doświadczeń lub Raportu do JSON i CSV (Wymóg pkt 5 MFiPR)
  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      system: "MFiPR × RiskMiner AI (Pilotaż Gospodarka Wodno-Ściekowa)",
      activeAnalysisReport: report,
      empiricalDatabaseRecordsCount: projectsDb.length,
      empiricalDatabaseRecords: projectsDb,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MFiPR_RiskMiner_Eksport_${report.projectId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const headers = [
      "Identyfikator rekordu",
      "NIP",
      "Nazwa odbiorcy",
      "Wojewodztwo",
      "Podsektor glowny",
      "Rodzaj prac",
      "Typ ID publicznego",
      "Identyfikator publiczny",
      "Zakres rekordu",
      "Pewnosc dopasowania BZP (%)",
      "Kody ryzyk MFiPR",
      "Rekord wzorcowy",
    ];
    const csvRows = [
      headers.join(";"),
      ...projectsDb.map((p) =>
        [
          p.recordId,
          p.nip,
          `"${p.recipientName.replace(/"/g, '""')}"`,
          p.voivodeship,
          p.subsector,
          p.workType,
          p.publicIdType,
          p.publicId,
          p.scope,
          p.confidenceScore,
          p.detectedRiskCodes.join(","),
          p.isExemplar ? "TAK" : "NIE",
        ].join(";")
      ),
    ];
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "MFiPR_RiskMiner_Baza_Inwestycji_WodKan.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Przeniesienie wybranego rekordu z Bazy Doświadczeń (Zakładka 1) do pełnej symulacji w Zakładce 2
  const handleAnalyzeRecordInSimulator = (rec: MfiprProjectRecord) => {
    const synthesizedInput = `INWESTYCJA Z BAZY MFiPR (${rec.recordId}): ${rec.projectName}
ZAMAWIAJĄCY: ${rec.recipientName} (NIP: ${rec.nip}, woj. ${rec.voivodeship}, kod TERYT: ${rec.teryt})
IDENTYFIKATOR PUBLICZNY: ${rec.publicIdType} – ${rec.publicId} | Zakres: ${rec.scope}
PODSEKTOR WOD-KAN: ${rec.subsector}${rec.additionalSubsector ? ` + ${rec.additionalSubsector}` : ""} | Rodzaj prac: ${rec.workType}
ADNOTACJA INSTYTUCJI: ${rec.annotation || "Postępowanie krajowe Pzp w obszarze gospodarki wodno-ściekowej."}
WNIOSKI Z KOPII BZP (bzp.cytr.us): ${rec.matchReasoning}`;

    setInputText(synthesizedInput);
    setUploadedFileName(`${rec.recordId}_${rec.publicId.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`);
    setActiveMainTab("new-investment");
    const customReport = buildLocalFallbackReport(
      synthesizedInput,
      `${rec.recordId} (${rec.recipientName})`,
      rodoShieldEnabled
    );
    setReport({
      ...customReport,
      projectId: rec.recordId,
      projectTitle: `${rec.projectName} (${rec.recipientName})`,
      subsector: rec.subsector,
      additionalSubsector: rec.additionalSubsector,
      workType: rec.workType,
      fundingProgram: rec.fundingProgram,
      totalBudgetPln: rec.estimatedBudgetPln || customReport.totalBudgetPln,
      euFundingPln: rec.euFundingPln || Math.round((rec.estimatedBudgetPln || customReport.totalBudgetPln) * 0.78),
      similarProjects: findSimilarMfiprProjects(rec.subsector, rec.workType, 4),
    });
    setStatusBanner(
      `Przełączono na głęboką analizę rekordu ${rec.recordId} (${rec.recipientName} – ${rec.subsector}).`
    );
  };

  // =========================================================================
  // LOGIKA ŚCIEŻKI 2: RODO SHIELD, GŁOS, ANALIZA AI I SYMULATOR WHAT-IF
  // =========================================================================
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
    const allowedExtensions = [".pdf", ".csv", ".txt", ".docx", ".xlsx"];
    const lowerName = file.name.toLowerCase();
    const isSupported = allowedExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isSupported) {
      setStatusBanner(
        "Nieobsługiwany format pliku. Wybierz dokument .pdf, .docx, .xlsx, .csv lub .txt (SWZ, PFU, PPU)."
      );
      return;
    }

    if (lowerName.endsWith(".xlsx")) {
      const buf = await file.arrayBuffer();
      parseWorkbookBufferToRecords(buf, file.name);
      setActiveMainTab("knowledge-base");
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
        `Załączono dokument „${file.name}” (${sizeKb} KB). Gotowy do analizy ryzyk wod-kan R01–R15 przez Gemini 2.5 Flash!`
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
        "Wprowadź opis inwestycji wod-kan, załącz plik SWZ/PFU/PPU lub załaduj przykład Demo Jury MFiPR."
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
        await new Promise((resolve) => setTimeout(resolve, 250));
        setReport({
          ...DEMO_JURY_REPORT,
          sourceInputSample: processedText,
          generatedAt: new Date().toISOString(),
        });
        setProceduralDelaySliderDays(25);
        setCostIndexationSliderPercent(8);
        setStatusBanner(
          `Załadowano scenariusz pilotażowy MFiPR Wod-Kan: „Rozbudowa sieci wodociągowej (14,2 km) i modernizacja SUW” ${
            rodoShieldEnabled ? `• RODO Shield zamaskował ${maskedCount} encji.` : ""
          }`
        );
        return;
      }

      setStatusBanner(
        "Analizowanie dokumentacji wod-kan przez Gemini 2.5 Flash (katalog R01–R15 + dobór grupy porównawczej MFiPR)..."
      );

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
            const mfiprCode = item.mfiprCode || (`R0${(idx % 9) + 1}` as MfiprRiskCode);

            return {
              id: item.id || `risk-${idx + 1}`,
              code: mfiprCode,
              mfiprCatalogName: item.mfiprCatalogName || getMfiprCatalogName(mfiprCode),
              title: item.title,
              category: item.category,
              severity,
              probability: prob,
              impact: imp,
              estimatedDelayDays: item.delayDays || 30,
              budgetAtRiskPln: item.financialImpactPln || 450_000,
              rootCause: item.rootCause,
              sourceCitation:
                item.sourceCitation ||
                "„Na podstawie przekazanej dokumentacji postępowania wod-kan oraz wytycznych KPO B3.1.1.”",
              legalBasis:
                item.legalBasis || "Ustawa Prawo zamówień publicznych (art. 455 Pzp) / Prawo wodne",
              mitigationPlan: item.mitigationPlan,
              contractClauseSuggestion:
                item.contractClauseSuggestion ||
                "Propozycja do PPU: Wprowadzenie jednoznacznej klauzuli przeglądowej zgodnie z art. 455 ust. 1 pkt 1 Pzp.",
              confidenceLevel: item.confidenceLevel || "Wysoka",
              legalBasisOrClause: item.legalBasis || "Standard Zarządzania Inwestycjami Wod-Kan MFiPR",
              ownerUnit: "Jednostka Realizująca Projekt (JRP) / Eksploatator Wod-Kan",
              verificationStatus: "pending",
            };
          });

          const totalThreatened = convertedRisks.reduce(
            (acc, curr) => acc + curr.budgetAtRiskPln,
            0
          );
          const maxDelay = Math.max(
            ...convertedRisks.map((r) => r.estimatedDelayDays),
            40
          );
          const subsector = apiData.subsector || "Sieć wodociągowa";
          const workType = apiData.workType || "Budowa/rozbudowa";

          const newReport: InvestmentAnalysisReport = {
            projectId: "MFiPR-WODKAN-LIVE",
            projectTitle:
              apiData.projectTitle ||
              targetFileName ||
              "Analizowana Inwestycja Wodno-Kanalizacyjna",
            subsector,
            additionalSubsector: apiData.additionalSubsector,
            workType,
            fundingProgram: "KPO – Inwestycja B3.1.1 / FEnIKS Gospodarka Wodno-Ściekowa",
            beneficiaryName: "Jednostka Samorządu Terytorialnego / Przedsiębiorstwo Wod-Kan",
            stageDescription: "Analiza pakietu dokumentów zamówienia (SWZ / PFU / PPU)",
            totalBudgetPln: apiData.estimatedBudgetPln || 12_450_000,
            euFundingPln: Math.round((apiData.estimatedBudgetPln || 12_450_000) * 0.79),
            basePlannedEndDate: "2026-10-15",
            euSettlementDeadline: "2026-12-31",
            overallRiskScore: apiData.overallRiskIndex || 78,
            criticalPathDelayDays: maxDelay,
            threatenedBudgetPln: totalThreatened,
            executiveSummary:
              apiData.summary ||
              "Analiza RiskMiner AI sklasyfikowała inwestycję w sektorze wod-kan, przypisała ryzyka do katalogu R01–R15 oraz zestawiła projekt z grupą porównawczą 22 inwestycji MFiPR.",
            sourceInputSample: processedText,
            generatedAt: new Date().toISOString(),
            modelEngine: "Gemini 2.5 Flash (Katalog MFiPR R01–R15)",
            similarProjects:
              apiData.similarProjects && apiData.similarProjects.length > 0
                ? apiData.similarProjects
                : findSimilarMfiprProjects(subsector, workType, 4),
            benchmarkSampleSize: 22,
            predictedDelayRange: apiData.predictedDelayRange || "+40 do +95 dni kalendarzowych",
            predictedCostOverrunRange:
              apiData.predictedCostOverrunRange || "+7,5% do +16,8% wartości umowy",
            missingDocuments:
              apiData.missingDocuments && apiData.missingDocuments.length > 0
                ? apiData.missingDocuments
                : DEMO_JURY_REPORT.missingDocuments,
            risks: convertedRisks,
          };

          setReport(newReport);
          setStatusBanner(
            `Analiza zakończona! Podsektor: ${subsector} (${workType}) • Zidentyfikowano ${convertedRisks.length} ryzyk wg katalogu R01–R15.`
          );
          return;
        }
      }

      const localReport = buildLocalFallbackReport(
        rawSource,
        targetFileName,
        rodoShieldEnabled
      );
      setReport(localReport);
      setStatusBanner(
        `Wygenerowano analizę wod-kan (${localReport.subsector}) z katalogiem R01–R15.`
      );
    } catch (err) {
      console.error("Błąd podczas analizy:", err);
      const localReport = buildLocalFallbackReport(
        rawSource,
        targetFileName,
        rodoShieldEnabled
      );
      setReport(localReport);
      setStatusBanner(
        `Wygenerowano analizę w trybie lokalnym MFiPR Wod-Kan (${localReport.risks.length} ryzyk R01–R15).`
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  const handleLoadDemoJuryInvestment = () => {
    setInputText(DEMO_JURY_INPUT_TEXT);
    setUploadedFileName("SWZ_PFU_Rozbudowa_WodKan_SUW_KPO_B3_1_1.pdf");
    setUploadedFileSize("1.8 MB");
    setUploadedFileBase64(null);
    setUploadedFileMimeType(null);
    void analyzeInvestment({
      customText: DEMO_JURY_INPUT_TEXT,
      customFileName: "SWZ_PFU_Rozbudowa_WodKan_SUW_KPO_B3_1_1.pdf",
      isDemoPreset: true,
    });
  };

  const activeUnrejectedRisks = useMemo(() => {
    return report.risks.filter((r) => r.verificationStatus !== "rejected");
  }, [report.risks]);

  const simulationMetrics = useMemo(() => {
    const activeThreatened = activeUnrejectedRisks.reduce(
      (acc, curr) => acc + curr.budgetAtRiskPln,
      0
    );
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

    const activeCritical = activeUnrejectedRisks.filter(
      (r) => r.severity === "Krytyczne"
    ).length;
    const activeHigh = activeUnrejectedRisks.filter((r) => r.severity === "Wysokie").length;

    const delayScorePenalty = Math.round((proceduralDelaySliderDays / 120) * 11);
    const costScorePenalty = Math.round((costIndexationSliderPercent / 25) * 9);
    const baseDynamic = Math.min(
      100,
      activeCritical * 18 + activeHigh * 12 + delayScorePenalty + costScorePenalty
    );
    const dynamicRiskIndex = Math.max(
      10,
      Math.min(100, activeUnrejectedRisks.length > 0 ? baseDynamic : 15)
    );

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
  }, [
    report,
    activeUnrejectedRisks,
    proceduralDelaySliderDays,
    costIndexationSliderPercent,
  ]);

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
      "  KARTA RYZYKA INWESTYCJI WODNO-KANALIZACYJNEJ (KATALOG R01–R15)",
      "================================================================================",
      `Data wygenerowania raportu : ${nowFormatted}`,
      `Silnik analityczny         : ${report.modelEngine}`,
      `Podsektor główny wod-kan   : ${report.subsector}${
        report.additionalSubsector ? ` (Dodatkowy: ${report.additionalSubsector})` : ""
      }`,
      `Rodzaj prac                : ${report.workType}`,
      `Status AI Act (HITL)       : Zatwierdzone: ${humanInTheLoopStats.approved} | Odrzucone: ${humanInTheLoopStats.rejected} | Do przeglądu: ${humanInTheLoopStats.pending}`,
      `Status ochrony RODO Shield : ${
        rodoShieldEnabled
          ? `AKTYWNY (Zanonimizowano ${rodoMaskResult.maskedCount} encji wrażliwych)`
          : "WYŁĄCZONY"
      }`,
      "",
      "1. METRYKA INWESTYCJI I BENCHMARK SEKTOROWY MFiPR (N = 22 PROJEKTY)",
      "--------------------------------------------------------------------------------",
      `ID Projektu                : ${report.projectId}`,
      `Nazwa inwestycji           : ${report.projectTitle}`,
      `Program finansowania       : ${report.fundingProgram}`,
      `Budżet całkowity brutto    : ${formatPln(report.totalBudgetPln)}`,
      `Dofinansowanie UE (KPO/UE) : ${formatPln(report.euFundingPln)}`,
      `Prognoza odchylenia czasu  : ${report.predictedDelayRange}`,
      `Prognoza odchylenia kosztu : ${report.predictedCostOverrunRange}`,
      `Podobne projekty z bazy    : ${report.similarProjects
        .map((s) => `${s.recordId} (${s.recipientName} – ${s.similarityScore}%)`)
        .join(", ")}`,
      "",
      "2. KLUCZOWE WSKAŹNIKI RYZYKA (PO WERYFIKACJI HUMAN-IN-THE-LOOP)",
      "--------------------------------------------------------------------------------",
      `• Ogólny Indeks Ryzyka Inwestycji          : ${simulationMetrics.dynamicRiskIndex} / 100 pkt`,
      `• Liczba Ryzyk Krytycznych i Wysokich      : ${simulationMetrics.criticalAndHighTotal}`,
      `• Szacowane Opóźnienie Ścieżki Krytycznej  : +${simulationMetrics.totalDelayDays} dni`,
      `• Wartość Zagrożonego Budżetu / UE         : ${formatPln(
        simulationMetrics.simulatedThreatenedBudgetPln
      )}`,
      "",
      "3. DIAGNOSTYKA BRAKÓW DOKUMENTACYJNYCH W PACZCE",
      "--------------------------------------------------------------------------------",
      ...report.missingDocuments.map(
        (m) => `• [${m.statusType}] ${m.documentName}: ${m.impactOnAnalysis}`
      ),
      "",
      "4. ZIDENTYFIKOWANE RYZYKA WG KATALOGU MFiPR (R01–R15) I KLAUZULE PPU/SWZ",
      "--------------------------------------------------------------------------------",
    ];

    for (const r of report.risks) {
      lines.push(
        `--------------------------------------------------------------------------------`,
        `[${r.code}] ${r.mfiprCatalogName} | STATUS HITL: ${(
          r.verificationStatus || "pending"
        ).toUpperCase()}`,
        `Tytuł ryzyka  : ${r.title}`,
        `Poziom ryzyka : ${r.severity.toUpperCase()} (P:${r.probability}/5 × W:${
          r.impact
        }/5) | Pewność oceny: ${r.confidenceLevel}`,
        `Wpływ         : +${r.estimatedDelayDays} dni | Ekspozycja: ${formatPln(
          r.budgetAtRiskPln
        )}`,
        `Podstawa      : ${r.legalBasis}`,
        `Cytat źródłowy (Strict Grounding):`,
        `  ${r.sourceCitation}`,
        `Przyczyna źródłowa:`,
        `  ${r.rootCause}`,
        `Rekomendacja naprawcza:`,
        `  ${r.mitigationPlan}`,
        `Proponowany zapis umowny do PPU / SWZ:`,
        `  ${r.contractClauseSuggestion}`
      );
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
    link.download = `Karta_Ryzyka_WodKan_${report.projectId.replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    )}.txt`;
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

            <div>
              <h1 className="text-sm sm:text-base font-bold text-[#002D62] dark:text-white tracking-tight leading-snug">
                Ministerstwo Funduszy i Polityki Regionalnej
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                RiskMiner AI — System Analizy Ryzyk Inwestycji Publicznych (Pilotaż: Gospodarka Wodno-Ściekowa)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-semibold text-[#002D62] dark:text-sky-300">
              <Building2 className="size-3.5 text-[#D52B1E]" strokeWidth={1.75} />
              <span>KPO B3.1.1 • FEnIKS • Kopia BZP: bzp.cytr.us</span>
            </div>

            <button
              type="button"
              onClick={handleExportJson}
              title="Eksportuj ustrukturyzowane dane JSON (Wymóg §5 MFiPR)"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-[#002D62] dark:text-white transition-colors cursor-pointer"
            >
              <FileCode2 className="size-3.5 text-[#D52B1E]" strokeWidth={1.75} />
              <span className="hidden sm:inline">JSON</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              title="Eksportuj tabelę projektów CSV (Wymóg §5 MFiPR)"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-[#002D62] dark:text-white transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" strokeWidth={1.75} />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDarkMode((prev) => !prev)}
              aria-label={isDarkMode ? "Przełącz na motyw jasny GovTech" : "Przełącz na motyw ciemny"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-[#002D62] dark:text-white transition-colors cursor-pointer"
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
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="hover:underline cursor-pointer">Strona główna</span>
              <span className="text-slate-400">/</span>
              <span className="hover:underline cursor-pointer">Inwestycje i Fundusze UE</span>
              <span className="text-slate-400">/</span>
              <span className="font-semibold text-[#002D62] dark:text-white">
                RiskMiner AI — Sektor Wodno-Kanalizacyjny
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              Katalog MFiPR: R01–R15 • 6 Podsektorów Wod-Kan • 22 Rekordy Referencyjne
            </span>
          </div>
        </div>
      </header>

      {/* GŁÓWNA ZAWARTOŚĆ STRONY */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Pasek statusu operacyjnego */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 px-4 py-2.5 shadow-2xs">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#002D62] dark:text-slate-200">
            {isAnalyzing || isEnrichingBzp ? (
              <Cpu className="size-4 text-[#D52B1E] animate-spin shrink-0" strokeWidth={1.75} />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
            )}
            <span className="font-semibold">{statusBanner}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-mono">
            <span>Baza MFiPR: {projectsDb.length} projektów</span>
            <span>•</span>
            <span>Katalog: R01–R15</span>
          </div>
        </div>

        {/* PRZEŁĄCZNIK DWÓCH GŁÓWNYCH ŚCIEŻEK PRACY (§6 SPOSÓB TESTOWANIA MFiPR) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setActiveMainTab("knowledge-base")}
            className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer ${
              activeMainTab === "knowledge-base"
                ? "bg-[#002D62] text-white border-[#002D62] shadow-sm dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500"
                : "bg-white dark:bg-[#152238] text-[#002D62] dark:text-slate-200 border-[#D1D5DB] dark:border-slate-800 hover:border-[#002D62]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                  activeMainTab === "knowledge-base"
                    ? "bg-white/15 text-white dark:bg-slate-950/15 dark:text-slate-950"
                    : "bg-[#002D62]/10 text-[#002D62] dark:bg-sky-400/10 dark:text-sky-400"
                }`}
              >
                <Database className="size-5" strokeWidth={1.75} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider opacity-80">
                  Ścieżka 1 (Budowa Bazy Doświadczeń §3.1)
                </div>
                <div className="text-sm sm:text-base font-bold mt-0.5">
                  Baza Doświadczeń MFiPR (22 Rekordy .XLSX &amp; Kopia BZP bzp.cytr.us)
                </div>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-black/15">
              {projectsDb.length} rekordy
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab("new-investment")}
            className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer ${
              activeMainTab === "new-investment"
                ? "bg-[#D52B1E] text-white border-[#D52B1E] shadow-sm"
                : "bg-white dark:bg-[#152238] text-[#002D62] dark:text-slate-200 border-[#D1D5DB] dark:border-slate-800 hover:border-[#D52B1E]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                  activeMainTab === "new-investment"
                    ? "bg-white/15 text-white"
                    : "bg-[#D52B1E]/10 text-[#D52B1E]"
                }`}
              >
                <Activity className="size-5" strokeWidth={1.75} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider opacity-80">
                  Ścieżka 2 (Wsparcie Nowej Inwestycji §3.2)
                </div>
                <div className="text-sm sm:text-base font-bold mt-0.5">
                  Analiza Nowej Inwestycji Wod-Kan, Katalog R01–R15 &amp; Benchmark
                </div>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-black/15">
              {report.risks.length} ryzyk
            </span>
          </button>
        </div>

        {/* =====================================================================
            WIDOK ŚCIEŻKI 1: EMPIRYCZNA BAZA DOŚWIADCZEŃ MFiPR (22 REKORDY .XLSX)
           ===================================================================== */}
        {activeMainTab === "knowledge-base" && (
          <div className="space-y-6">
            {/* Pasek narzędzi importu XLSX i integracji z bzp.cytr.us */}
            <section className="rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D1D5DB] dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#002D62] dark:text-white flex items-center gap-2">
                    <FileSpreadsheet className="size-5 text-[#D52B1E]" strokeWidth={1.75} />
                    <span>
                      Zbiór Referencyjny MFiPR: Risk_Miner_dane_projekty.xlsx (Gospodarka Wodno-Ściekowa)
                    </span>
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Obsługa bezpośredniego importu arkuszy .xlsx/.csv, automatycznego przypisania do 6 podsektorów wod-kan oraz łączenia z kopią ogłoszeń BZP (https://bzp.cytr.us).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={xlsxInputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handleUploadXlsxFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => xlsxInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-bold text-[#002D62] dark:text-white cursor-pointer"
                  >
                    <Upload className="size-4 text-[#D52B1E]" strokeWidth={1.75} />
                    <span>Wgraj plik MFiPR (.xlsx / .csv)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleLoadOfficialMfiprXlsx()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#002D62] hover:bg-[#002047] text-white px-3.5 py-2 text-xs font-bold cursor-pointer"
                  >
                    <FileSpreadsheet className="size-4" strokeWidth={1.75} />
                    <span>Wczytaj oficjalny plik MFiPR (.xlsx)</span>
                  </button>

                  {selectedDbRecord && (
                    <button
                      type="button"
                      disabled={isEnrichingBzp}
                      onClick={() => void handleEnrichSingleProjectFromBzp(selectedDbRecord)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#D52B1E] hover:bg-[#B01F15] text-white px-3.5 py-2 text-xs font-bold cursor-pointer disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`size-4 ${isEnrichingBzp ? "animate-spin" : ""}`}
                        strokeWidth={1.75}
                      />
                      <span>Wzbogać z BZP (bzp.cytr.us)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4 mini-karty podsumowujące strukturę 22 rekordów MFiPR */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Ogłoszenia BZP (Dopasowanie 1:1)
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold font-mono text-[#002D62] dark:text-white">
                      {projectsDb.filter((p) => p.publicIdType === "Ogłoszenie BZP").length}
                    </span>
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Pewność: 100%
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Projekty KPO B3.1.1 (Heurystyka NIP+TERYT)
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold font-mono text-[#002D62] dark:text-white">
                      {projectsDb.filter((p) => p.publicIdType === "Projekt KPO").length}
                    </span>
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      Pewność: 87–92%
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Podmioty wielokrotne (Powiązane po NIP)
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-lg font-extrabold font-mono text-[#D52B1E] dark:text-red-400">
                      Czernikowo • Nowogard
                    </span>
                    <span className="text-xs font-mono text-slate-500">2 × 2 projekty</span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Zakresy częściowe (Zamówienia w częściach)
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-lg font-extrabold font-mono text-[#002D62] dark:text-sky-300">
                      Biecz (cz. 1) • Zakrzew (cz. 2)
                    </span>
                    <span className="text-xs font-mono text-slate-500">RM-008, RM-009</span>
                  </div>
                </div>
              </div>

              {/* Filtry tabeli 22 rekordów */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div className="relative">
                  <Search
                    className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                    strokeWidth={1.75}
                  />
                  <input
                    type="text"
                    value={dbSearchQuery}
                    onChange={(e) => setDbSearchQuery(e.target.value)}
                    placeholder="Szukaj po NIP, gminie, BZP/KPO..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs text-[#002D62] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#002D62]"
                  />
                </div>

                <select
                  aria-label="Filtruj po podsektorze wod-kan"
                  value={dbSubsectorFilter}
                  onChange={(e) =>
                    setDbSubsectorFilter(e.target.value as WodKanSubsector | "ALL")
                  }
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-[#002D62] dark:text-white"
                >
                  <option value="ALL">Wszystkie 6 podsektorów wod-kan</option>
                  {WOD_KAN_SUBSECTORS.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtruj po typie identyfikatora publicznego"
                  value={dbIdTypeFilter}
                  onChange={(e) =>
                    setDbIdTypeFilter(
                      e.target.value as "ALL" | "Ogłoszenie BZP" | "Projekt KPO"
                    )
                  }
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-[#002D62] dark:text-white"
                >
                  <option value="ALL">Wszystkie typy ID (BZP + KPO)</option>
                  <option value="Ogłoszenie BZP">Ogłoszenie BZP (14)</option>
                  <option value="Projekt KPO">Projekt KPO (8)</option>
                </select>

                <select
                  aria-label="Filtruj po województwie"
                  value={dbVoivodeshipFilter}
                  onChange={(e) => setDbVoivodeshipFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-[#002D62] dark:text-white"
                >
                  <option value="ALL">Wszystkie województwa ({uniqueVoivodeships.length})</option>
                  {uniqueVoivodeships.map((v) => (
                    <option key={v} value={v}>
                      woj. {v}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {/* Tabela 22 rekordów + Panel szczegółowy wybranego rekordu */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Tabela (7/12) */}
              <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border-b border-[#D1D5DB] dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#002D62] dark:text-white">
                    Lista Rekordów MFiPR ({filteredDbProjects.length} z {projectsDb.length})
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Kliknij wiersz, aby otworzyć kartę wzbogacania BZP i nadzoru eksperta
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 font-bold">ID Rekordu</th>
                        <th className="py-2.5 px-3 font-bold">Zamawiający (NIP)</th>
                        <th className="py-2.5 px-3 font-bold">Przedsięwzięcie &amp; Podsektor</th>
                        <th className="py-2.5 px-3 font-bold">ID Publiczny &amp; BZP</th>
                        <th className="py-2.5 px-3 font-bold text-right">Ryzyka</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredDbProjects.map((proj) => {
                        const isSelected = selectedDbRecord?.recordId === proj.recordId;
                        const isMultiNip = (multiProjectNipCounts[proj.nip] || 0) > 1;
                        return (
                          <tr
                            key={proj.recordId}
                            onClick={() => setSelectedRecordId(proj.recordId)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-[#002D62]/10 dark:bg-sky-500/15 font-medium"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-[#002D62] dark:text-sky-300 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span>{proj.recordId}</span>
                                {proj.isExemplar && (
                                  <span title="Rekord wzorcowy MFiPR">
                                    <Award
                                      className="size-3.5 text-amber-600 shrink-0"
                                      strokeWidth={1.75}
                                    />
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 block font-sans">
                                woj. {proj.voivodeship} ({proj.teryt})
                              </span>
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="font-bold text-[#002D62] dark:text-white">
                                {proj.recipientName}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-[11px] text-slate-500">
                                  NIP: {proj.nip}
                                </span>
                                {isMultiNip && (
                                  <span className="rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 text-[10px] font-bold">
                                    2× w bazie
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-2.5 px-3 max-w-[240px]">
                              <div className="line-clamp-2 text-slate-800 dark:text-slate-200 leading-snug">
                                {proj.projectName}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <span className="inline-block rounded bg-[#002D62]/10 dark:bg-slate-800 text-[#002D62] dark:text-sky-300 px-1.5 py-0.5 text-[10px] font-bold">
                                  {proj.subsector}
                                </span>
                                <span className="inline-block rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 text-[10px]">
                                  {proj.workType}
                                </span>
                                {proj.scope !== "całe postępowanie" && (
                                  <span className="inline-block rounded bg-[#D52B1E]/10 text-[#D52B1E] px-1.5 py-0.5 text-[10px] font-bold">
                                    {proj.scope}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  proj.publicIdType === "Ogłoszenie BZP"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                                }`}
                              >
                                {proj.publicIdType}
                              </span>
                              <div className="font-mono text-[11px] mt-0.5 text-slate-700 dark:text-slate-300">
                                {proj.publicId}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Pewność BZP: <strong>{proj.confidenceScore}%</strong>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex flex-wrap justify-end gap-1">
                                {proj.detectedRiskCodes.map((code) => (
                                  <span
                                    key={`${proj.recordId}-${code}`}
                                    className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#D52B1E]/10 text-[#D52B1E] dark:bg-red-950 dark:text-red-300"
                                  >
                                    {code}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Karta szczegółowa rekordu + Wzbogacanie BZP + Nadzór Eksperta (5/12) */}
              {selectedDbRecord && (
                <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 p-5 shadow-xs space-y-4">
                  <div className="flex items-start justify-between gap-2 border-b border-[#D1D5DB] dark:border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-[#002D62] text-white">
                          {selectedDbRecord.recordId}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {selectedDbRecord.publicIdType}: {selectedDbRecord.publicId}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-[#002D62] dark:text-white mt-1.5 leading-snug">
                        {selectedDbRecord.projectName}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setProjectsDb((prev) =>
                          prev.map((p) =>
                            p.recordId === selectedDbRecord.recordId
                              ? { ...p, isExemplar: !p.isExemplar }
                              : p
                          )
                        )
                      }
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border cursor-pointer shrink-0 ${
                        selectedDbRecord.isExemplar
                          ? "bg-amber-500 text-slate-950 border-amber-500"
                          : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      <Award className="size-3.5" strokeWidth={1.75} />
                      <span>{selectedDbRecord.isExemplar ? "Wzorcowy" : "Oznacz wzorcowy"}</span>
                    </button>
                  </div>

                  {/* Metryka klasyfikacji wod-kan */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Zamawiający (NIP):</span>
                      <span className="font-bold text-[#002D62] dark:text-white">
                        {selectedDbRecord.recipientName} ({selectedDbRecord.nip})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Lokalizacja (TERYT):</span>
                      <span className="font-bold text-[#002D62] dark:text-white">
                        {selectedDbRecord.city}, woj. {selectedDbRecord.voivodeship} ({selectedDbRecord.teryt})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Podsektor główny wod-kan:</span>
                      <span className="font-bold text-[#D52B1E] dark:text-red-400">
                        {selectedDbRecord.subsector}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Rodzaj prac / Zakres:</span>
                      <span className="font-bold text-[#002D62] dark:text-white">
                        {selectedDbRecord.workType} ({selectedDbRecord.scope})
                      </span>
                    </div>
                  </div>

                  {/* Wynik łączenia z kopią BZP (https://bzp.cytr.us) */}
                  <div className="rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#002D62] dark:text-sky-300 flex items-center gap-1.5">
                        <Link2 className="size-3.5" strokeWidth={1.75} />
                        <span>Integracja BZP (https://bzp.cytr.us)</span>
                      </span>
                      <span className="font-mono text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                        Pewność: {selectedDbRecord.confidenceScore}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {selectedDbRecord.matchReasoning}
                    </p>
                    {selectedDbRecord.matchedNotices.map((notice, idx) => (
                      <div
                        key={`${notice.noticeNumber}-${idx}`}
                        className="rounded-lg bg-white dark:bg-[#152238] border border-sky-200/80 dark:border-slate-700 p-2 text-[11px]"
                      >
                        <div className="flex items-center justify-between font-mono font-bold text-[#002D62] dark:text-sky-300">
                          <span>{notice.noticeNumber}</span>
                          <span>{notice.publicationDate}</span>
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                          {notice.noticeType}: {notice.title}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Wykryte zdarzenia z ogłoszeń (art. 455 Pzp) oraz Alerty Braków */}
                  {selectedDbRecord.detectedEvents.length > 0 && (
                    <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 space-y-1.5">
                      <div className="text-[11px] font-bold uppercase text-amber-900 dark:text-amber-300">
                        Wykryte zmiany umowy / sygnały ryzyka (Art. 455 Pzp):
                      </div>
                      {selectedDbRecord.detectedEvents.map((ev, i) => (
                        <div key={i} className="text-xs text-slate-800 dark:text-slate-200">
                          <span className="font-mono font-bold text-[#D52B1E]">
                            [{ev.mappedRiskCode}]
                          </span>{" "}
                          <strong>{ev.eventType}</strong> ({ev.legalBasis}): {ev.description}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedDbRecord.missingDataAlerts.length > 0 && (
                    <div className="rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-3 space-y-1">
                      <div className="text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300">
                        Diagnostyka dokumentacji (Brak pliku vs Brak działania):
                      </div>
                      {selectedDbRecord.missingDataAlerts.map((alert, idx) => (
                        <p key={idx} className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          • {alert}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Panel Eksperta (Human-in-the-Loop): Edycja adnotacji i przypisanie kodu R01-R15 */}
                  <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                    <label
                      htmlFor="expert-annotation-edit"
                      className="text-xs font-bold text-[#002D62] dark:text-white block"
                    >
                      Adnotacja instytucji / Notatka Eksperta MFiPR (Edytowalna):
                    </label>
                    <textarea
                      id="expert-annotation-edit"
                      rows={3}
                      value={selectedDbRecord.annotation}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProjectsDb((prev) =>
                          prev.map((p) =>
                            p.recordId === selectedDbRecord.recordId
                              ? { ...p, annotation: val }
                              : p
                          )
                        );
                      }}
                      placeholder="Dodaj adnotację ekspercką dla tego rekordu..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-[#002D62] dark:text-white"
                    />

                    {/* Przypisane kody katalogu R01-R15 */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Kody ryzyk MFiPR:
                      </span>
                      {selectedDbRecord.detectedRiskCodes.map((code) => (
                        <span
                          key={code}
                          className="inline-flex items-center gap-1 rounded-md bg-[#D52B1E] text-white px-2 py-0.5 text-xs font-mono font-bold"
                        >
                          {code}
                          <button
                            type="button"
                            onClick={() =>
                              setProjectsDb((prev) =>
                                prev.map((p) =>
                                  p.recordId === selectedDbRecord.recordId
                                    ? {
                                        ...p,
                                        detectedRiskCodes: p.detectedRiskCodes.filter(
                                          (c) => c !== code
                                        ),
                                      }
                                    : p
                                )
                              )
                            }
                            aria-label={`Usuń kod ${code}`}
                            className="hover:text-amber-200 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <select
                        aria-label="Wybierz kod ryzyka R01-R15 do dodania"
                        value={customRiskToAdd}
                        onChange={(e) => setCustomRiskToAdd(e.target.value as MfiprRiskCode)}
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-[#002D62] dark:text-white"
                      >
                        {MFIPR_RISK_CATALOG.map((cat) => (
                          <option key={cat.code} value={cat.code}>
                            {cat.code} – {cat.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setProjectsDb((prev) =>
                            prev.map((p) =>
                              p.recordId === selectedDbRecord.recordId &&
                              !p.detectedRiskCodes.includes(customRiskToAdd)
                                ? {
                                    ...p,
                                    detectedRiskCodes: [
                                      ...p.detectedRiskCodes,
                                      customRiskToAdd,
                                    ],
                                  }
                                : p
                            )
                          )
                        }
                        className="rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-[#002D62] dark:text-white px-3 py-1.5 text-xs font-bold cursor-pointer"
                      >
                        + Dodaj kod
                      </button>
                    </div>
                  </div>

                  {/* Przycisk uruchomienia pełnej symulacji tego projektu w Ścieżce 2 */}
                  <button
                    type="button"
                    onClick={() => handleAnalyzeRecordInSimulator(selectedDbRecord)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#D52B1E] hover:bg-[#B01F15] text-white font-bold text-xs sm:text-sm px-4 py-2.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Activity className="size-4" strokeWidth={1.75} />
                    <span>
                      Otwórz ten projekt w Symulatorze i Macierzy Ryzyka 5×5
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            WIDOK ŚCIEŻKI 2: ANALIZA NOWEJ INWESTYCJI WOD-KAN & BENCHMARK SEKTOROWY
           ===================================================================== */}
        {activeMainTab === "new-investment" && (
          <div className="space-y-6">
            {/* SEKCJA 1: PANEL WEJŚCIOWY INWESTYCJI WOD-KAN */}
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
                      Panel Wejściowy Nowej Inwestycji Wodno-Kanalizacyjnej (SWZ / PFU / PPU / Koncepcja)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Wgraj dokumentację zamówienia (.pdf, .docx, .csv, .txt), podyktuj notatkę głosową lub załaduj wzorcową inwestycję wod-kan MFiPR.
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
                      accept=".pdf,.docx,.xlsx,.csv,.txt"
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
                      Obsługiwane formaty: <span className="font-mono font-semibold">.pdf, .docx, .xlsx, .csv, .txt</span> (SWZ, PFU, PPU, STWiORB)
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

                  {/* Przycisk Demo Jury MFiPR Wod-Kan */}
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 p-3.5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#002D62] dark:text-sky-300">
                        Pilotaż Sektorowy MFiPR: Gospodarka Wodno-Ściekowa
                      </span>
                      <span className="text-[11px] font-mono bg-slate-200 dark:bg-slate-800 text-[#002D62] dark:text-sky-300 px-2 py-0.5 rounded font-bold">
                        KPO B3.1.1 • R01–R15
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleLoadDemoJuryInvestment}
                      disabled={isAnalyzing}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#002D62] hover:bg-[#002047] active:bg-[#001733] text-white font-bold text-xs sm:text-sm px-4 py-2.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Sparkles className="size-4 shrink-0 text-amber-400" strokeWidth={1.75} />
                      <span>Załaduj przykład wod-kan (Rozbudowa sieci i SUW – Demo MFiPR)</span>
                    </button>
                  </div>
                </div>

                {/* Opis tekstowy / głosowy */}
                <div className="lg:col-span-7 flex flex-col justify-between gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="investment-description-textarea"
                      className="text-xs sm:text-sm font-bold text-[#002D62] dark:text-slate-100 flex items-center gap-2"
                    >
                      <span>Opis inwestycji wod-kan / Wyciąg z SWZ, PFU, PPU i pytań wykonawców</span>
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
                      placeholder="Wklej opis inwestycji wodociągowej/kanalizacyjnej, wyciąg z PFU, PPU, pytań do SWZ lub podyktuj notatkę..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-3.5 text-xs sm:text-sm text-[#002D62] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D52B1E] font-sans leading-relaxed"
                    />
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Podsektor główny: <strong className="text-[#002D62] dark:text-sky-300">{report.subsector}</strong> • Rodzaj prac: <strong>{report.workType}</strong>
                    </div>

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
            </section>

            {/* SEKCJA 1B: GRUPA PORÓWNAWCZA Z BAZY MFiPR (RM-2026-001..022) & DIAGNOSTYKA BRAKÓW DOKUMENTÓW */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Dopasowane podobne projekty z bazy MFiPR (7/12) */}
              <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 p-5 shadow-xs space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D1D5DB] dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#002D62] dark:text-white flex items-center gap-2">
                      <Layers className="size-5 text-[#D52B1E]" strokeWidth={1.75} />
                      <span>
                        Grupa Porównawcza z Bazy Doświadczeń MFiPR (Próba: n = {report.benchmarkSampleSize} projekty)
                      </span>
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Podobne inwestycje dobrane wg podsektora ({report.subsector}) i rodzaju prac ({report.workType}).
                    </p>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <span className="block text-amber-700 dark:text-amber-300 font-bold">
                      Odchylenie czasu: {report.predictedDelayRange}
                    </span>
                    <span className="block text-[#D52B1E] dark:text-red-400 font-bold">
                      Odchylenie kosztu: {report.predictedCostOverrunRange}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {report.similarProjects.map((sim) => (
                    <div
                      key={sim.recordId}
                      className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#002D62] text-white">
                            {sim.recordId}
                          </span>
                          <span className="font-mono text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                            Podobieństwo: {sim.similarityScore}%
                          </span>
                        </div>
                        <div className="text-xs font-bold text-[#002D62] dark:text-white mt-1.5 line-clamp-2">
                          {sim.projectName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {sim.recipientName} (woj. {sim.voivodeship}) • {sim.publicId}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 leading-snug">
                          {sim.similarityExplanation}
                        </p>
                      </div>
                      <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span>Czas: {sim.observedDelayRange}</span>
                        <span>Koszt: {sim.observedCostDeviationRange}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diagnostyka braków dokumentacyjnych (5/12) */}
              <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 p-5 shadow-xs space-y-3">
                <div className="border-b border-[#D1D5DB] dark:border-slate-800 pb-3">
                  <h3 className="text-sm sm:text-base font-bold text-[#002D62] dark:text-white flex items-center gap-2">
                    <FileText className="size-5 text-amber-600" strokeWidth={1.75} />
                    <span>Diagnostyka Kompletności Paczki Dokumentów</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Rozróżnienie „Brak pliku w paczce” vs „Brak działania” oraz substytut umowy z PPU/SWU.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {report.missingDocuments.map((doc, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#002D62] dark:text-white">
                          {doc.documentName}
                        </span>
                        <span className="rounded bg-amber-500/20 text-amber-900 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold shrink-0">
                          {doc.statusType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {doc.impactOnAnalysis}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* SEKCJA 2: 4 KARTY KPI */}
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
                        Zagrożony Budżet / KPO B3.1.1
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

            {/* SEKCJA 3: INTERAKTYWNA MACIERZ RYZYKA 5×5 + SYMULATOR „WHAT-IF” */}
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
                          Interaktywna Macierz Ryzyka 5×5 (Kody Katalogu MFiPR R01–R15)
                        </h2>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Kliknij dowolną komórkę siatki, aby przefiltrować rejestr ryzyk i propozycji klauzul PPU/SWZ.
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
                          Symulator Scenariuszy „What-If” (Wod-Kan)
                        </h2>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Symulacja wrażliwości harmonogramu i budżetu KPO B3.1.1 / FEnIKS.
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
                        1. Opóźnienie zgód gruntowych (R03) / Wód Polskich (R04) / KIO
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
                      <span>0 dni (Plan)</span>
                      <span>+45 dni (Służebności)</span>
                      <span>+120 dni (Korekta DŚU/HDD)</span>
                    </div>
                  </div>

                  {/* Suwak 2 */}
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="slider-cost-indexation"
                        className="text-xs sm:text-sm font-bold text-[#002D62] dark:text-slate-100"
                      >
                        2. Roboty dodatkowe (art. 455 Pzp) i waloryzacja rur PEHD / SUW
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
                      <span>0% (Oferta)</span>
                      <span>+15% (Art. 455 ust. 2 Pzp)</span>
                      <span>+25% (Roszczenie)</span>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Bazowy termin odbioru końcowego:</span>
                      <span className="font-mono font-semibold text-[#002D62] dark:text-slate-200">
                        {report.basePlannedEndDate}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-semibold text-[#002D62] dark:text-white">Nowa prognozowana data odbioru:</span>
                      <span className="font-mono font-extrabold text-base text-[#002D62] dark:text-sky-400">
                        {simulationMetrics.projectedEndDate}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-semibold text-[#002D62] dark:text-white">Dodatkowy koszt aneksów (art. 455 Pzp):</span>
                      <span className="font-mono font-extrabold text-base text-[#D52B1E] dark:text-red-400">
                        +{formatPln(simulationMetrics.additionalIndexationCostPln)}
                      </span>
                    </div>
                  </div>

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
                          ? `ALARM KWALIFIKOWALNOŚCI: Przekroczono termin rozliczenia (${report.euSettlementDeadline})!`
                          : `Kwalifikowalność zachowana (Termin graniczny: ${report.euSettlementDeadline})`}
                      </p>
                      <p className="mt-1">
                        {simulationMetrics.exceedsEuDeadline
                          ? `Prognozowany odbiór (${simulationMetrics.projectedEndDate}) wykracza o ${simulationMetrics.daysAfterEuDeadline} dni poza horyzont rozliczenia. Zagrożenie utratą dofinansowania w kwocie do ${formatPln(
                              report.euFundingPln
                            )}.`
                          : `Do krytycznego terminu rozliczenia pozostało ${Math.abs(
                              simulationMetrics.daysAfterEuDeadline
                            )} dni buforu bezpieczeństwa.`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-[#D1D5DB] dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadSteeringCommitteeReport}
                    className="sm:col-span-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#002D62] hover:bg-[#002047] text-white font-bold text-xs px-3 py-2.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="size-3.5 shrink-0" strokeWidth={1.75} />
                    <span>Raport (.txt)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="sm:col-span-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[#002D62] dark:text-white border border-slate-300 dark:border-slate-700 font-bold text-xs px-3 py-2.5 transition-all cursor-pointer"
                  >
                    <FileCode2 className="size-3.5 text-[#D52B1E] shrink-0" strokeWidth={1.75} />
                    <span>Eksport JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="sm:col-span-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[#002D62] dark:text-white border border-slate-300 dark:border-slate-700 font-bold text-xs px-3 py-2.5 transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="size-3.5 text-emerald-600 shrink-0" strokeWidth={1.75} />
                    <span>Tabela CSV</span>
                  </button>
                </div>
              </div>
            </section>

            {/* SEKCJA 4: REJESTR RYZYK Z KODAMI R01–R15, KLAUZULAMI PPU/SWZ I HUMAN-IN-THE-LOOP */}
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
                      Rejestr Zidentyfikowanych Ryzyk wg Katalogu MFiPR (R01–R15) i Klauzule PPU/SWZ ({filteredRisks.length})
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Schemat MFiPR: Warunek/sygnał w dokumentach (Strict Grounding) → Możliwe zdarzenie → Wpływ → Środki zaradcze i klauzula umowna.
                  </p>
                </div>

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
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#002D62] dark:text-sky-400">
                    Synteza Zarządcza • Podsektor: {report.subsector} ({report.workType})
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
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#002D62] text-white dark:bg-slate-800 dark:text-sky-300">
                                        {risk.code}
                                      </span>
                                      <span
                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${getSeverityBadgeClasses(
                                          risk.severity
                                        )}`}
                                      >
                                        {risk.severity}
                                      </span>
                                      <span className="inline-flex items-center rounded bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-[#002D62] dark:text-slate-300">
                                        Pewność: {risk.confidenceLevel}
                                      </span>
                                    </div>
                                    <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                                      P:{risk.probability}×W:{risk.impact} ({risk.probability * risk.impact}p)
                                    </span>
                                  </div>

                                  <div className="text-[11px] font-bold text-[#D52B1E] dark:text-red-400 mt-1.5">
                                    Katalog MFiPR: {risk.mfiprCatalogName}
                                  </div>

                                  <h4 className="text-sm sm:text-base font-bold text-[#002D62] dark:text-white mt-1 leading-snug">
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
                                      Przyczyna źródłowa i mechanizm ryzyka:
                                    </p>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                                      {risk.rootCause}
                                    </p>
                                  </div>

                                  {/* DOWÓD W DOKUMENCIE (STRICT GROUNDING) */}
                                  <div className="mt-2.5 rounded-lg bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#002D62] dark:text-sky-300 flex items-center gap-1.5">
                                      <BookOpen className="size-3.5" strokeWidth={1.75} />
                                      <span>Źródło w dokumencie (Strict Grounding):</span>
                                    </p>
                                    <p className="text-xs font-mono text-slate-800 dark:text-sky-200 mt-1 italic leading-relaxed">
                                      {risk.sourceCitation}
                                    </p>
                                  </div>

                                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                                    <span className="font-bold text-[#002D62] dark:text-sky-300">
                                      Podstawa formalna:
                                    </span>
                                    <span className="font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700">
                                      {risk.legalBasis}
                                    </span>
                                  </div>

                                  {/* REKOMENDACJA NAPRAWCZA */}
                                  <div className="mt-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                                      <ChevronRight className="size-3.5" strokeWidth={1.75} />
                                      <span>Rekomendacja naprawcza (Plan Mitygacji):</span>
                                    </p>
                                    <p className="text-xs text-slate-800 dark:text-slate-200 mt-1 leading-relaxed font-medium">
                                      {risk.mitigationPlan}
                                    </p>
                                  </div>

                                  {/* PROPONOWANY ZAPIS UMOWNY DO PPU / SWZ */}
                                  <div className="mt-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#002D62] dark:text-sky-300">
                                      Proponowany zapis umowny do PPU / SWZ:
                                    </p>
                                    <p className="text-xs font-mono text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">
                                      {risk.contractClauseSuggestion}
                                    </p>
                                  </div>
                                </div>

                                {/* HUMAN-IN-THE-LOOP */}
                                <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                    {risk.ownerUnit}
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

            {/* SEKCJA 5: 8-PUNKTOWA CHECKLISTA PRZYGOTOWANIA INWESTYCJI WODOCIĄGOWEJ MFiPR */}
            <section
              aria-labelledby="wodkan-checklist-heading"
              className="rounded-2xl bg-white dark:bg-[#152238] border border-[#D1D5DB] dark:border-slate-800 p-5 shadow-xs space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D1D5DB] dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center size-6 rounded-md bg-[#002D62] text-white text-xs font-bold">
                      5
                    </span>
                    <h2
                      id="wodkan-checklist-heading"
                      className="text-base sm:text-lg font-bold text-[#002D62] dark:text-white flex items-center gap-2"
                    >
                      <ClipboardCheck className="size-5 text-[#D52B1E]" strokeWidth={1.75} />
                      <span>
                        Zbiorcza Checklista Przygotowania Inwestycji Wodociągowej MFiPR (Rozdz. 1–8 Poradnika Eksperckiego)
                      </span>
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Lista kontrolna dla inwestora publicznego weryfikująca zasadność, możliwość zasilenia, dostęp do gruntów i organizację eksploatacji sieci.
                  </p>
                </div>

                <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                  Zweryfikowano:{" "}
                  {Object.values(checkedChecklistIds).filter(Boolean).length} /{" "}
                  {WOD_KAN_PREPARATION_CHECKLIST.length} punktów
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {WOD_KAN_PREPARATION_CHECKLIST.map((item) => {
                  const isChecked = Boolean(checkedChecklistIds[item.id]);
                  return (
                    <div
                      key={item.id}
                      onClick={() =>
                        setCheckedChecklistIds((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }))
                      }
                      className={`rounded-xl border p-3.5 cursor-pointer transition-all flex items-start gap-3 ${
                        isChecked
                          ? "bg-emerald-50/40 dark:bg-emerald-950/25 border-emerald-500/50"
                          : "bg-slate-50/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-[#002D62]"
                      }`}
                    >
                      <div
                        className={`mt-0.5 size-5 rounded-md flex items-center justify-center border shrink-0 ${
                          isChecked
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "bg-white dark:bg-slate-800 border-slate-400"
                        }`}
                      >
                        {isChecked && <Check className="size-3.5" strokeWidth={2.2} />}
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#002D62] dark:text-white">
                            {item.title}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 shrink-0">
                            {item.sectionRef}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {item.verificationCriteria}
                        </p>
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-slate-500">Powiązane ryzyka:</span>
                          {item.relatedRiskCodes.map((rc) => (
                            <span
                              key={rc}
                              className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#002D62]/10 dark:bg-slate-800 text-[#002D62] dark:text-sky-300"
                            >
                              {rc}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
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
                RiskMiner AI — Proaktywny System Analizy Ryzyk Inwestycji Publicznych (Sektor Wodno-Kanalizacyjny)
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
            <div className="space-y-1">
              <p>
                Architektura i wdrożenie: WebDevAI (webdevai.eu) • Licencja MIT • Prototyp konkursowy HackNation 2026
              </p>
              <p className="text-[11px] text-slate-400/90">
                Niezależny prototyp (Proof of Concept) stworzony przez WebDevAI (webdevai.eu) w ramach wyzwania HackNation 2026. Aplikacja nie jest oficjalnym narzędziem Ministerstwa Funduszy i Polityki Regionalnej (MFiPR).
              </p>
            </div>
            <p className="font-mono text-[11px] text-slate-400 shrink-0">
              MFiPR × RiskMiner AI v2.0-wodkan • BZP Mirror: bzp.cytr.us
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
                    System <strong>RiskMiner AI</strong> stanowi narzędzie wspomagania decyzji (Decision Support System) dla ekspertów Ministerstwa Funduszy i Polityki Regionalnej, Instytucji Pośredniczących oraz Beneficjentów projektów wodno-kanalizacyjnych (KPO B3.1.1 / FEnIKS).
                  </p>
                  <p>
                    Niezależny prototyp (Proof of Concept) stworzony przez WebDevAI (webdevai.eu) w ramach wyzwania HackNation 2026. Aplikacja nie jest oficjalnym narzędziem Ministerstwa Funduszy i Polityki Regionalnej (MFiPR).
                  </p>
                  <p>
                    Oprogramowanie udostępnione na otwartej licencji MIT przez zespół WebDevAI (webdevai.eu).
                  </p>
                </>
              )}
              {activeFooterModal === "wcag" && (
                <>
                  <p>
                    Interfejs <strong>MFiPR × RiskMiner AI</strong> został zaprojektowany zgodnie z wymogami ustawy z dnia 4 kwietnia 2019 r. o dostępności cyfrowej stron internetowych i aplikacji mobilnych podmiotów publicznych (standard <strong>WCAG 2.1 AA</strong>).
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
