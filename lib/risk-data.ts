// Definicje typów domenowych dla systemu MFiPR × RiskMiner AI (Pilotaż: Gospodarka Wodno-Ściekowa)

import {
  type WodKanSubsector,
  type WodKanWorkType,
  type MfiprRiskCode,
  MFIPR_RISK_CATALOG,
  findSimilarMfiprProjects,
} from "@/lib/mfipr-dataset";

export type RiskCategory =
  | "Formalno-prawne"
  | "Finansowe"
  | "Harmonogramowe"
  | "Techniczne";

export type RiskSeverity = "Niskie" | "Średnie" | "Wysokie" | "Krytyczne";

export type MatrixScore = 1 | 2 | 3 | 4 | 5;

export type VerificationStatus = "pending" | "approved" | "rejected";

export type RiskConfidenceLevel =
  | "Wysoka"
  | "Średnia"
  | "Wymaga uzupełnienia dokumentów";

export interface InvestmentRiskItem {
  id: string;
  code: string; // Kod oficjalny MFiPR R01..R15
  mfiprCatalogName: string; // Oficjalna nazwa kategorii z katalogu MFiPR
  title: string;
  category: RiskCategory;
  severity: RiskSeverity;
  probability: MatrixScore; // 1–5
  impact: MatrixScore; // 1–5
  estimatedDelayDays: number;
  budgetAtRiskPln: number;
  rootCause: string;
  sourceCitation: string; // Dosłowny cytat z dokumentu źródłowego (Strict Grounding)
  legalBasis: string; // Podstawa prawna / artykuł PZP / wytyczne UE / Prawo wodne
  mitigationPlan: string;
  contractClauseSuggestion: string; // Proponowany zapis umowny do PPU / SWZ
  confidenceLevel: RiskConfidenceLevel;
  legalBasisOrClause: string;
  ownerUnit: string;
  verificationStatus?: VerificationStatus;
}

export interface SimilarBenchmarkProject {
  recordId: string;
  projectName: string;
  recipientName: string;
  voivodeship: string;
  subsector: WodKanSubsector;
  workType: WodKanWorkType;
  publicId: string;
  similarityScore: number;
  similarityExplanation: string;
  observedDelayRange: string;
  observedCostDeviationRange: string;
}

export interface MissingDocumentDiagnostic {
  documentName: string;
  statusType:
    | "Brak w przekazanej paczce"
    | "Dokument nie wspomina"
    | "Warunki kontraktowe odtworzone z PPU/SWU";
  impactOnAnalysis: string;
}

export interface InvestmentAnalysisReport {
  projectId: string;
  projectTitle: string;
  subsector: WodKanSubsector;
  additionalSubsector?: WodKanSubsector;
  workType: WodKanWorkType;
  fundingProgram: string;
  beneficiaryName: string;
  stageDescription: string;
  totalBudgetPln: number;
  euFundingPln: number;
  basePlannedEndDate: string; // YYYY-MM-DD
  euSettlementDeadline: string; // YYYY-MM-DD
  overallRiskScore: number; // 0–100 pkt
  criticalPathDelayDays: number;
  threatenedBudgetPln: number;
  executiveSummary: string;
  sourceInputSample: string;
  risks: InvestmentRiskItem[];
  similarProjects: SimilarBenchmarkProject[];
  benchmarkSampleSize: number;
  predictedDelayRange: string;
  predictedCostOverrunRange: string;
  missingDocuments: MissingDocumentDiagnostic[];
  generatedAt: string;
  modelEngine: string;
}

// Funkcja wyznaczająca poziom ryzyka na podstawie iloczynu Prawdopodobieństwo × Wpływ
export function calculateMatrixSeverity(
  probability: MatrixScore,
  impact: MatrixScore
): RiskSeverity {
  const score = probability * impact;
  if (score >= 16) return "Krytyczne";
  if (score >= 10) return "Wysokie";
  if (score >= 5) return "Średnie";
  return "Niskie";
}

// Pomocnicze pobranie nazwy katalogowej R01–R15
export function getMfiprCatalogName(code: string): string {
  const found = MFIPR_RISK_CATALOG.find((item) => item.code === code);
  return found ? `${found.code} – ${found.name}` : `${code} – Ryzyko specyficzne inwestycji`;
}

// Lokalny filtr RODO Shield – maskuje numery PESEL, NIP oraz dane osobowe i nazwy wykonawców w tekście
export function applyRodoShieldMasking(rawText: string, enabled: boolean): {
  processedText: string;
  maskedCount: number;
} {
  if (!enabled || !rawText) {
    return { processedText: rawText, maskedCount: 0 };
  }

  let maskedCount = 0;
  let result = rawText;

  // Maskowanie 11-cyfrowych numerów PESEL
  result = result.replace(/\b\d{11}\b/g, () => {
    maskedCount += 1;
    return "[PESEL-ZAMASKOWANY-RODO]";
  });

  // Maskowanie numerów NIP (np. 123-456-78-90 lub 10 cyfr po słowie NIP)
  result = result.replace(
    /\b(?:NIP[\s:-]*)?\d{3}[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2}\b/gi,
    () => {
      maskedCount += 1;
      return "[NIP-ZAMASKOWANY-RODO]";
    }
  );

  // Maskowanie nazw spółek wykonawczych (Sp. z o.o., S.A., Konsorcjum)
  result = result.replace(
    /\b(?:Konsorcjum\s+)?[A-ZŁŚĆŻŹ][a-ząćęłńóśźżA-ZŁŚĆŻŹ0-9-]+(?:\s+[A-ZŁŚĆŻŹ][a-ząćęłńóśźżA-ZŁŚĆŻŹ0-9-]+){0,2}\s+(?:Sp\.\s*z\s*o\.o\.|S\.A\.|Spółka\s+Akcyjna)/g,
    () => {
      maskedCount += 1;
      return "[WYKONAWCA-ANONIMIZOWANY-RODO]";
    }
  );

  // Maskowanie imion i nazwisk poprzedzonych tytułem (inż., mgr, dyr., mec.)
  result = result.replace(
    /\b(inż\.|mgr\s+inż\.|mgr|mec\.|dyr\.)\s+[A-ZŁŚĆŻŹ][a-ząćęłńóśźż]+\s+[A-ZŁŚĆŻŹ][a-ząćęłńóśźż-]+/g,
    (_match, prefix: string) => {
      maskedCount += 1;
      return `${prefix} [DANE-OSOBOWE-RODO]`;
    }
  );

  return { processedText: result, maskedCount };
}

// Przykładowy wsad tekstowy inwestycji wodociągowo-kanalizacyjnej (Pilotaż MFiPR Wod-Kan)
export const DEMO_JURY_INPUT_TEXT = `INWESTYCJA WODNO-KANALIZACYJNA (KPO B3.1.1 / FEnIKS): Rozbudowa sieci wodociągowej (14,2 km) wraz z modernizacją Stacji Uzdatniania Wody (SUW) oraz budową odcinka kanalizacji sanitarnej tłocznej (4,6 km) na terenach wiejskich poza aglomeracją.
NR PROJEKTU: KPOD.03.15-IW.14-0089/26 | Ogłoszenie powiązane: 2026/BZP 00148920/01 (Część 1 i Część 2).
BUDŻET CAŁKOWITY BRUTTO: 12 450 000 PLN | DOFINANSOWANIE UE (KPO B3.1.1): 9 850 000 PLN.
PLANOWANY TERMIN ODBIORU KOŃCOWEGO: 2026-10-15 | KRYTYCZNY TERMIN ROZLICZENIA KPO / KWALIFIKOWALNOŚCI: 2026-12-31.

WYCIĄG Z DOKUMENTACJI POSTĘPOWANIA (SWZ, PFU, PPU, PYTANIA WYKONAWCÓW I NOTATKA INŻYNIERA):
1. [R03 / Nieruchomości] Trasa projektowanej sieci wodociągowej PE160 na odcinku 3,8 km (obręb Dąbrówka i Siemonia, działki nr 528/4, 530, 531/1–537/1) przebiega przez tereny zielone oraz drogi wewnętrzne stanowiące własność prywatną (19 właścicieli). Na dzień publikacji SWZ Zamawiający nie załączył kompletu oświadczeń o prawie do dysponowania nieruchomością na cele budowlane ani ustanowionych służebności przesyłu.
2. [R01 / R08 / Zakres i Wynagrodzenie] W SWZ i PPU przyjęto wynagrodzenie ryczałtowe w formule "Zaprojektuj i Wybuduj", jednak w odpowiedzi na pytanie nr 24 Zamawiający wskazał, że „wykonanie sięgaczy i przyłączy wodociągowych do granic 112 posesji prywatnych należy ująć w cenie oferty, o ile właściciele wyrażą zgodę w trakcie robót”, podczas gdy przedmiar pomocniczy obejmuje wyłącznie przewód główny bez przykanalików i studni wodomierzowych.
3. [R02 / R04 / Geotechnika i Przewierty HDD] Na km 6+250 trasa rurociągu tłocznego przecina drogę wojewódzką nr 444 oraz ciek wodny. Dokumentacja geotechniczna z 2021 r. obejmuje tylko 3 odwierty co 800 m i nie rozpoznaje soczewek kurzawki oraz gruntów organicznych w strefie komory przewiertu sterowanego HDD. Brak uzgodnienia docelowego z WZDW oraz pozwolenia wodnoprawnego Wód Polskich.
4. [R11 / RNC] W postępowaniu najniższą ofertę złożyło Konsorcjum HydroInstal Polska Sp. z o.o. (NIP 526-104-88-19, kierownik robót sanitarnych mgr inż. Marek Kowalczyk, PESEL 78041209415) na kwotę 9,42 mln PLN brutto (o 24,3% poniżej budżetu zamawiającego). Drugi oferent – AquaTech Inżynieria S.A. – złożył wniosek o odwołanie do KIO ws. rażąco niskiej ceny zestawów hydroforowych i filtrów odżelaziających na SUW.
5. [R10 / R15 / SUW i Eksploatacja] PFU dla modernizacji Stacji Uzdatniania Wody określa wydajność nominalną pomp na 140 m3/h, ale nie zawiera aktualnych badań wody surowej (ponadnormatywny mangan i amoniak) ani procedury 72-godzinnego rozruchu technologicznego, płukania i dezynfekcji sieci przed przełączeniem odbiorców. Ponadto na końcowym odcinku sieci (2,9 km, zabudowa letniskowa) prognozowany początkowy pobór wody wynosi poniżej 15% założonego wolumenu (ryzyko stagnacji wody i wtórnego zanieczyszczenia bakteriologicznego).`;

// Kompletny raport referencyjny dla inwestycji wodociągowo-kanalizacyjnej (Pilotaż MFiPR Wod-Kan)
export const DEMO_JURY_REPORT: InvestmentAnalysisReport = {
  projectId: "KPOD.03.15-IW.14-0089/26",
  projectTitle:
    "Rozbudowa sieci wodociągowej (14,2 km) i modernizacja SUW wraz z kanalizacją tłoczną poza aglomeracją",
  subsector: "Sieć wodociągowa",
  additionalSubsector: "Uzdatnianie i zaopatrzenie w wodę",
  workType: "Budowa/rozbudowa",
  fundingProgram: "Krajowy Plan Odbudowy – Inwestycja B3.1.1 / FEnIKS Gospodarka Wodno-Ściekowa",
  beneficiaryName: "Gmina Wiejska / Jednostka Samorządu Terytorialnego (Monitoring MFiPR)",
  stageDescription: "Faza postępowania zakupowego i weryfikacji PPU/PFU przed zawarciem umowy",
  totalBudgetPln: 12_450_000,
  euFundingPln: 9_850_000,
  basePlannedEndDate: "2026-10-15",
  euSettlementDeadline: "2026-12-31",
  overallRiskScore: 81,
  criticalPathDelayDays: 65,
  threatenedBudgetPln: 3_420_000,
  executiveSummary:
    "Analiza RiskMiner AI w oparciu o katalog MFiPR (R01–R15) oraz benchmark 22 projektów wod-kan wykazała WYSOKI indeks ryzyka (81/100 pkt). Główne zagrożenia wynikają z nieuregulowanego prawa do dysponowania 19 działkami prywatnymi na trasie wodociągu (R03), rozbieżności między ryczałtowym PFU a przedmiarem w zakresie 112 przyłączy (R01/R08), braku pozwolenia wodnoprawnego i badań pod przewiert HDD pod DW 444 (R02/R04) oraz ryzyka niedotrzymania parametrów fizykochemicznych wody na SUW (R10/R15). Przekroczenie opóźnienia o ponad 77 dni naruszy horyzont kwalifikowalności KPO B3.1.1.",
  sourceInputSample: DEMO_JURY_INPUT_TEXT,
  generatedAt: "2026-11-21T11:55:00+01:00",
  modelEngine: "Gemini 2.5 Flash / MFiPR Wod-Kan Analytic Engine",
  similarProjects: findSimilarMfiprProjects("Sieć wodociągowa", "Budowa/rozbudowa", 4),
  benchmarkSampleSize: 22,
  predictedDelayRange: "+40 do +95 dni kalendarzowych",
  predictedCostOverrunRange: "+7,5% do +16,8% wartości kontraktu (art. 455 ust. 1 pkt 3–4 Pzp)",
  missingDocuments: [
    {
      documentName: "Podpisana umowa z wykonawcą",
      statusType: "Warunki kontraktowe odtworzone z PPU/SWU",
      impactOnAnalysis:
        "Zgodnie z wytycznymi MFiPR użyto PPU wraz z modyfikacjami SWZ i informacją z otwarcia ofert jako warunkowego substytutu umowy („warunki kontraktowe odtworzone; brak podpisanego egzemplarza umowy”).",
    },
    {
      documentName: "Oświadczenia o prawie do dysponowania nieruchomością na cele budowlane (19 działek prywatnych)",
      statusType: "Brak w przekazanej paczce",
      impactOnAnalysis:
        "Brak pliku w paczce nie potwierdza jeszcze braku zgód w urzędzie gminy, jednak brak wykazu służebności w załącznikach do PFU podnosi ryzyko R03 do poziomu Krytycznego.",
    },
    {
      documentName: "Aktualne badania fizykochemiczne wody surowej na ujęciu SUW oraz pozwolenie wodnoprawne",
      statusType: "Dokument nie wspomina",
      impactOnAnalysis:
        "Ogranicza pewność doboru złoża filtracyjnego na SUW (ryzyko R09 i R15) – wymagane pilne uzupełnienie przed zatwierdzeniem projektu wykonawczego.",
    },
  ],
  risks: [
    {
      id: "risk-wk-1",
      code: "R03",
      mfiprCatalogName: getMfiprCatalogName("R03"),
      title: "Przebieg 3,8 km sieci wodociągowej przez 19 prywatnych działek bez udokumentowanych zgód właścicieli",
      category: "Formalno-prawne",
      severity: "Krytyczne",
      probability: 5,
      impact: 4,
      estimatedDelayDays: 60,
      budgetAtRiskPln: 980_000,
      rootCause:
        "Korytarz sieci PE160 zaprojektowano w terenach zielonych i drogach wewnętrznych stanowiących własność prywatną (dz. 528/4, 530, 531/1–537/1) bez uprzedniego pozyskania zgód i służebności przesyłu przed ogłoszeniem przetargu.",
      sourceCitation:
        "„Trasa projektowanej sieci wodociągowej PE160 na odcinku 3,8 km [...] przebiega przez tereny zielone oraz drogi wewnętrzne stanowiące własność prywatną (19 właścicieli). Na dzień publikacji SWZ Zamawiający nie załączył kompletu oświadczeń...”",
      legalBasis: "Art. 32 ust. 4 pkt 2 Prawa budowlanego / Art. 305(1) Kodeksu cywilnego (Służebność przesyłu)",
      mitigationPlan:
        "Weryfikacja stanu zgód przez komórkę nieruchomości Gminy przed podpisaniem umowy oraz przygotowanie wariantowej trasy obejściowej w pasie drogi gminnej dla działek spornych (zgodnie z Rozdz. 5.3 Poradnika MFiPR).",
      contractClauseSuggestion:
        "Propozycja do PPU §14 ust. 2: „Zamawiający dopuszcza zmianę terminu realizacji Etapu II lub korektę trasy przewodu na podstawie art. 455 ust. 1 pkt 1 Pzp w przypadku cofnięcia zgody właściciela nieruchomości prywatnej, przy czym ryzyko pozyskania tytułu prawnego dla działek wskazanych w wariancie bazowym PFU obciąża Zamawiającego.”",
      confidenceLevel: "Wysoka",
      legalBasisOrClause: "Art. 32 ust. 4 pkt 2 Prawa budowlanego / Art. 455 ust. 1 pkt 1 Pzp",
      ownerUnit: "Referat Gospodarki Nieruchomościami i Inwestycji JST",
      verificationStatus: "pending",
    },
    {
      id: "risk-wk-2",
      code: "R01",
      mfiprCatalogName: getMfiprCatalogName("R01"),
      title: "Rozbieżność zakresu między PFU, odpowiedziami SWZ a przedmiarem dot. 112 sięgaczy i przyłączy",
      category: "Finansowe",
      severity: "Krytyczne",
      probability: 4,
      impact: 5,
      estimatedDelayDays: 35,
      budgetAtRiskPln: 1_150_000,
      rootCause:
        "Sprzeczność pomiędzy odpowiedzią na pytanie nr 24 (nakazującą ujęcie 112 przyłączy w ryczałcie warunkowo od zgody mieszkańców) a przedmiarem i OPZ obejmującym tylko rurociąg rozdzielczy.",
      sourceCitation:
        "„W odpowiedzi na pytanie nr 24 Zamawiający wskazał, że wykonanie sięgaczy i przyłączy wodociągowych do granic 112 posesji prywatnych należy ująć w cenie oferty [...] podczas gdy przedmiar pomocniczy obejmuje wyłącznie przewód główny.”",
      legalBasis: "Art. 99 ust. 1 oraz Art. 455 ust. 1 pkt 3 ustawy Prawo zamówień publicznych (Pzp)",
      mitigationPlan:
        "Ujednoznacznienie hierarchii dokumentów w PPU oraz wydzielenie sięgaczy do granic działek jako zakresu rozliczanego obmiarowo lub objętego prawem opcji (art. 441 Pzp).",
      contractClauseSuggestion:
        "Propozycja do PPU §3 ust. 5: „Zakres podstawowy wynagrodzenia ryczałtowego obejmuje przewód główny wraz z armaturą węzłową i 85 udokumentowanymi sięgaczami do granic działek; wykonanie pozostałych do 27 sięgaczy objęte jest prawem opcji z art. 441 Pzp rozliczanym wg stawek jednostkowych z kosztorysu ofertowego.”",
      confidenceLevel: "Wysoka",
      legalBasisOrClause: "Art. 99 ust. 1 Pzp (Jednoznaczny OPZ) / Art. 441 Pzp",
      ownerUnit: "Komisja Przetargowa / Zespół Przygotowania OPZ",
      verificationStatus: "pending",
    },
    {
      id: "risk-wk-3",
      code: "R02",
      mfiprCatalogName: getMfiprCatalogName("R02"),
      title: "Niedostateczne rozpoznanie geotechniczne (kurzawka) w strefie przewiertu HDD pod DW 444 i ciekiem",
      category: "Techniczne",
      severity: "Wysokie",
      probability: 4,
      impact: 4,
      estimatedDelayDays: 45,
      budgetAtRiskPln: 640_000,
      rootCause:
        "Archiwalna dokumentacja geotechniczna z 2021 r. (odwierty co 800 m) nie rozpoznaje warunków gruntowo-wodnych w komorach startowej i odbiorczej przewiertu sterowanego HDD na km 6+250.",
      sourceCitation:
        "„Dokumentacja geotechniczna z 2021 r. obejmuje tylko 3 odwierty co 800 m i nie rozpoznaje soczewek kurzawki oraz gruntów organicznych w strefie komory przewiertu sterowanego HDD.”",
      legalBasis: "Art. 455 ust. 1 pkt 4 Pzp / Rozporządzenie ws. ustalania geotechnicznych warunków posadawiania",
      mitigationPlan:
        "Wykonanie uzupełniających wierceń badawczych w osi przewiertu HDD pod DW 444 oraz zdefiniowanie w PPU progu nieprzewidywalnych warunków gruntowych.",
      contractClauseSuggestion:
        "Propozycja do PPU §15 ust. 4: „W przypadku napotkania w strefie przewiertów HDD gruntów nienośnych lub kurzawki niewykazanych w dokumentacji archiwalnej, Strony dopuszczają zmianę technologii posadowienia komór i korektę wynagrodzenia na podstawie protokołu konieczności zgodnie z art. 455 ust. 1 pkt 4 Pzp.”",
      confidenceLevel: "Wysoka",
      legalBasisOrClause: "Art. 455 ust. 1 pkt 4 Pzp",
      ownerUnit: "Inżynier Kontraktu / Nadzór Geotechniczny",
      verificationStatus: "pending",
    },
    {
      id: "risk-wk-4",
      code: "R04",
      mfiprCatalogName: getMfiprCatalogName("R04"),
      title: "Brak pozwolenia wodnoprawnego Wód Polskich oraz uzgodnienia przejścia pod drogą wojewódzką WZDW",
      category: "Formalno-prawne",
      severity: "Wysokie",
      probability: 4,
      impact: 3,
      estimatedDelayDays: 50,
      budgetAtRiskPln: 210_000,
      rootCause:
        "Uzależnienie rozpoczęcia robót na odcinku przekroczenia cieku wodnego i DW 444 od decyzji organów zewnętrznych (PGW Wody Polskie oraz Zarząd Dróg Wojewódzkich).",
      sourceCitation:
        "„Na km 6+250 trasa rurociągu tłocznego przecina drogę wojewódzką nr 444 oraz ciek wodny [...] Brak uzgodnienia docelowego z WZDW oraz pozwolenia wodnoprawnego Wód Polskich.”",
      legalBasis: "Art. 389 ustawy Prawo wodne / Art. 39 ust. 3 ustawy o drogach publicznych",
      mitigationPlan:
        "Wystąpienie przez Inwestora o warunki techniczne WZDW jeszcze przed rozstrzygnięciem przetargu oraz wydzielenie odcinka przekroczenia cieku do odrębnego kamienia milowego.",
      contractClauseSuggestion:
        "Propozycja do PPU §6 ust. 3: „Opóźnienie organu administracji (PGW Wody Polskie lub Zarządcy Drogi) przekraczające ustawowe terminy Kpa, niezawinione przez Wykonawcę, stanowi podstawę do odpowiedniego przesunięcia Kamienia Milowego nr 2 bez naliczania kar umownych.”",
      confidenceLevel: "Wysoka",
      legalBasisOrClause: "Art. 389 ustawy Prawo wodne",
      ownerUnit: "Pełnomocnik ds. Uzgodnień i Decyzji Administracyjnych",
      verificationStatus: "pending",
    },
    {
      id: "risk-wk-5",
      code: "R11",
      mfiprCatalogName: getMfiprCatalogName("R11"),
      title: "Odwołanie do KIO ws. rażąco niskiej ceny (-24,3%) w zakresie technologii SUW",
      category: "Formalno-prawne",
      severity: "Wysokie",
      probability: 3,
      impact: 4,
      estimatedDelayDays: 40,
      budgetAtRiskPln: 290_000,
      rootCause:
        "Oferta z najniższą ceną (9,42 mln PLN) jest o 24,3% niższa od budżetu zamawiającego, co wywołało zarzut RNC ze strony konkurenta w zakresie technologii filtracji i hydroforów SUW.",
      sourceCitation:
        "„Najniższą ofertę złożyło Konsorcjum [...] na kwotę 9,42 mln PLN brutto (o 24,3% poniżej budżetu zamawiającego). Drugi oferent [...] złożył wniosek o odwołanie do KIO ws. rażąco niskiej ceny zestawów hydroforowych i filtrów odżelaziających na SUW.”",
      legalBasis: "Art. 224 ust. 1–2 oraz Art. 513 ustawy Prawo zamówień publicznych (Pzp)",
      mitigationPlan:
        "Wezwanie wykonawcy do złożenia ofert producentów urządzeń technologicznych SUW (pompy, sprężarki, złoża filtracyjne) z podaniem parametrów sprawności energetycznej.",
      contractClauseSuggestion:
        "Propozycja do SWZ Rozdz. XVIII: „W ramach wyjaśnień z art. 224 Pzp Wykonawca zobowiązany jest przedłożyć wiążące oferty handlowe dostawców technologii SUW potwierdzające spełnienie standardów materiałowych STWiORB.”",
      confidenceLevel: "Wysoka",
      legalBasisOrClause: "Art. 224 ust. 1–2 Pzp",
      ownerUnit: "Komisja Przetargowa JST",
      verificationStatus: "pending",
    },
    {
      id: "risk-wk-6",
      code: "R10",
      mfiprCatalogName: getMfiprCatalogName("R10"),
      title: "Brak procedury 72-godzinnego rozruchu SUW, prób szczelności i dezynfekcji przed odbiorem",
      category: "Harmonogramowe",
      severity: "Średnie",
      probability: 3,
      impact: 3,
      estimatedDelayDays: 25,
      budgetAtRiskPln: 150_000,
      rootCause:
        "Niedookreślenie w PFU warunków odbioru technologicznego SUW (brak aktualnych badań manganu i amoniaku w wodzie surowej) oraz wymogów bakteriologicznych Sanepidu (PPIS).",
      sourceCitation:
        "„PFU dla modernizacji Stacji Uzdatniania Wody określa wydajność nominalną pomp na 140 m3/h, ale nie zawiera aktualnych badań wody surowej [...] ani procedury 72-godzinnego rozruchu technologicznego, płukania i dezynfekcji sieci.”",
      legalBasis: "Rozporządzenie Ministra Zdrowia ws. jakości wody przeznaczonej do spożycia przez ludzi",
      mitigationPlan:
        "Uzupełnienie STWiORB i PPU o obowiązkowy protokół z 72-godzinnego ruchu próbnego SUW oraz dwukrotne pozytywne wyniki badań akredytowanego laboratorium i odbioru PPIS.",
      contractClauseSuggestion:
        "Propozycja do PPU §11 ust. 2: „Warunkiem podpisania Protokołu Odbioru Końcowego jest przeprowadzenie 72-godzinnego rozruchu technologicznego SUW pod obciążeniem oraz uzyskanie pozytywnej oceny jakości wody właściwego Państwowego Powiatowego Inspektora Sanitarnego.”",
      confidenceLevel: "Wymaga uzupełnienia dokumentów",
      legalBasisOrClause: "Rozporządzenie MZ ws. jakości wody do spożycia",
      ownerUnit: "Eksploatator Sieci (ZGK / Wodociągi Gminne) & Nadzór",
      verificationStatus: "pending",
    },
    {
      id: "risk-wk-7",
      code: "R15",
      mfiprCatalogName: getMfiprCatalogName("R15"),
      title: "Ryzyko stagnacji wody na końcowym odcinku 2,9 km (pobór początkowy <15%) i utraty wskaźnika KPO",
      category: "Techniczne",
      severity: "Wysokie",
      probability: 3,
      impact: 4,
      estimatedDelayDays: 15,
      budgetAtRiskPln: 420_000,
      rootCause:
        "Na odcinku końcowym (2,9 km do zabudowy letniskowej) niski początkowy pobór wody wydłuża czas przetrzymania wody w rurociągu PE160, grożąc wtórnym skażeniem i nieosiągnięciem wskaźnika aktywnych przyłączy KPO B3.1.1.",
      sourceCitation:
        "„Na końcowym odcinku sieci (2,9 km, zabudowa letniskowa) prognozowany początkowy pobór wody wynosi poniżej 15% założonego wolumenu (ryzyko stagnacji wody i wtórnego zanieczyszczenia bakteriologicznego).”",
      legalBasis: "Wytyczne kwalifikowalności KPO Inwestycja B3.1.1 / Rozdz. 2.3 Poradnika Eksperckiego MFiPR",
      mitigationPlan:
        "Zaprojektowanie układu pierścieniowego (spinającego) zamiast ślepej końcówki lub montaż automatycznych zaworów płuczących na końcu strefy letniskowej oraz weryfikacja deklaracji przyłączeniowych mieszkańców.",
      contractClauseSuggestion:
        "Propozycja do PFU pkt 4.6: „Na odcinkach końcowych sieci o prognozowanym przepływie początkowym Q < 0,15 Qmax Wykonawca zaprojektuje automatyczne punkty płukania sieci z opomiarowaniem przepływu.”",
      confidenceLevel: "Wysoka",
      legalBasisOrClause: "Regulamin KPO B3.1.1 (Wskaźnik podłączonych nieruchomości)",
      ownerUnit: "Operator Wodociągu Gminnego / Komórka Rozliczeń KPO",
      verificationStatus: "pending",
    },
  ],
};

// Funkcja tworząca dynamiczny raport wod-kan na podstawie wprowadzonego opisu użytkownika
export function buildLocalFallbackReport(
  inputText: string,
  uploadedFileName: string | null,
  rodoEnabled: boolean
): InvestmentAnalysisReport {
  const { processedText } = applyRodoShieldMasking(inputText, rodoEnabled);
  const lower = processedText.toLowerCase();

  // Klasyfikacja podsektora wod-kan na podstawie słów kluczowych
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

  const titlePrefix = uploadedFileName
    ? `Analiza dokumentacji wod-kan: ${uploadedFileName}`
    : processedText.split("\n")[0]?.slice(0, 105).trim() ||
      "Inwestycja gospodarki wodno-ściekowej współfinansowana z funduszy UE";

  return {
    ...DEMO_JURY_REPORT,
    projectId: "MFiPR-WODKAN-2026/01",
    projectTitle: titlePrefix,
    subsector,
    additionalSubsector,
    workType,
    similarProjects,
    sourceInputSample: processedText,
    generatedAt: new Date().toISOString(),
  };
}
