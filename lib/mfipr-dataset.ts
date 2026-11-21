// Oficjalna baza referencyjna MFiPR (22 rekordy testowe RM-2026-001..022),
// katalog 15 kategorii ryzyk R01-R15, 6 podsektorów wod-kan oraz 8-punktowa checklista.

export type WodKanSubsector =
  | "Sieć wodociągowa"
  | "Kanalizacja sanitarna"
  | "Oczyszczalnia ścieków"
  | "Uzdatnianie i zaopatrzenie w wodę"
  | "Kanalizacja deszczowa i retencja"
  | "Inne obiekty wod-kan";

export type WodKanWorkType = "Budowa/rozbudowa" | "Przebudowa/renowacja";

export type PublicIdType = "Ogłoszenie BZP" | "Projekt KPO";

export type MfiprRiskCode =
  | "R01"
  | "R02"
  | "R03"
  | "R04"
  | "R05"
  | "R06"
  | "R07"
  | "R08"
  | "R09"
  | "R10"
  | "R11"
  | "R12"
  | "R13"
  | "R14"
  | "R15";

export interface MfiprRiskCatalogEntry {
  code: MfiprRiskCode;
  name: string;
  effects: string;
  defaultCategory: "Formalno-prawne" | "Finansowe" | "Harmonogramowe" | "Techniczne";
}

export interface WodKanSubsectorDefinition {
  name: WodKanSubsector;
  scope: string;
}

export interface WodKanChecklistItem {
  id: string;
  sectionRef: string;
  title: string;
  verificationCriteria: string;
  relatedRiskCodes: MfiprRiskCode[];
}

export interface BzpMatchedNotice {
  noticeNumber: string;
  noticeType: string;
  publicationDate: string;
  title: string;
  contractorName?: string;
  contractValuePln?: number;
  legalBasisPzp?: string;
}

export interface BzpDetectedEvent {
  eventType:
    | "Zmiana terminu wykonania"
    | "Zmiana wynagrodzenia"
    | "Roboty dodatkowe / zamienne"
    | "Odwołanie do KIO"
    | "Unieważnienie / powtórzenie"
    | "Wykonanie umowy";
  legalBasis: string;
  description: string;
  mappedRiskCode: MfiprRiskCode;
}

export interface MfiprProjectRecord {
  lp: number;
  recordId: string;
  recipientIdType: string;
  nip: string;
  recipientName: string;
  recipientType: string;
  country: string;
  teryt: string;
  voivodeship: string;
  city: string;
  projectName: string;
  scope: string;
  publicIdType: PublicIdType;
  publicId: string;
  thematicArea: string;
  orderType: string;
  legalRegime: string;
  currency: string;
  status: string;
  source: string;
  createdAt: string;
  version: string;
  annotation: string;
  // Pola analityczne i wzbogacania BZP
  subsector: WodKanSubsector;
  additionalSubsector?: WodKanSubsector;
  workType: WodKanWorkType;
  fundingProgram: string;
  estimatedBudgetPln?: number;
  euFundingPln?: number;
  enrichmentStatus: "ready" | "enriched" | "heuristic_matched";
  confidenceScore: number; // 0-100%
  matchReasoning: string;
  matchedNotices: BzpMatchedNotice[];
  detectedEvents: BzpDetectedEvent[];
  missingDataAlerts: string[];
  detectedRiskCodes: MfiprRiskCode[];
  isExemplar: boolean;
}

// 6 oficjalnych podsektorów inwestycji wod-kan wg dokumentacji MFiPR
export const WOD_KAN_SUBSECTORS: WodKanSubsectorDefinition[] = [
  {
    name: "Sieć wodociągowa",
    scope: "sieci, przyłącza oraz obiekty służące do przesyłu i dystrybucji wody",
  },
  {
    name: "Kanalizacja sanitarna",
    scope: "sieci, przyłącza, przepompownie i przewody tłoczne służące do odprowadzania ścieków",
  },
  {
    name: "Oczyszczalnia ścieków",
    scope: "budowa, rozbudowa lub modernizacja obiektów i instalacji oczyszczania ścieków",
  },
  {
    name: "Uzdatnianie i zaopatrzenie w wodę",
    scope: "stacje uzdatniania wody, ujęcia, studnie, zbiorniki oraz obiekty magazynowania i pompowania wody",
  },
  {
    name: "Kanalizacja deszczowa i retencja",
    scope: "sieci deszczowe, odwodnienie, zbiorniki retencyjne i urządzenia gospodarowania wodami opadowymi",
  },
  {
    name: "Inne obiekty wod-kan",
    scope: "infrastruktura wodno-kanalizacyjna, której nie można przypisać do pozostałych podsektorów",
  },
];

// Oficjalny katalog 15 kategorii ryzyk MFiPR (R01–R15)
export const MFIPR_RISK_CATALOG: MfiprRiskCatalogEntry[] = [
  {
    code: "R01",
    name: "Niepełny lub niespójny zakres",
    effects:
      "Błędna wycena, pominięcie lub dublowanie robót, zmiana zakresu, roboty dodatkowe, roszczenie albo spór o wynagrodzenie.",
    defaultCategory: "Techniczne",
  },
  {
    code: "R02",
    name: "Niedostateczne rozpoznanie stanu istniejącego",
    effects:
      "Przeprojektowanie, nieprzewidziane roboty, przestoje, wzrost kosztu albo wydłużenie terminu.",
    defaultCategory: "Techniczne",
  },
  {
    code: "R03",
    name: "Kolizje, dostęp do terenu i prawa do nieruchomości",
    effects:
      "Brak możliwości rozpoczęcia części robót, zmiana trasy lub technologii, wstrzymanie prac albo roszczenia.",
    defaultCategory: "Formalno-prawne",
  },
  {
    code: "R04",
    name: "Decyzje, pozwolenia i uzgodnienia zależne od podmiotów trzecich",
    effects:
      "Opóźnienie rozpoczęcia lub kontynuacji prac, zmiana warunków realizacji albo brak możliwości użytkowania obiektu.",
    defaultCategory: "Formalno-prawne",
  },
  {
    code: "R05",
    name: "Niejasny lub nieadekwatny podział odpowiedzialności",
    effects:
      "Luka odpowiedzialności, dublowanie prac, odmowa wykonania, roszczenie i spór o koszt lub termin.",
    defaultCategory: "Formalno-prawne",
  },
  {
    code: "R06",
    name: "Nierealistyczny harmonogram i nieuwzględnione zależności",
    effects:
      "Opóźnienie, kary, kumulacja prac, presja na skrócenie prób i badań albo pogorszenie jakości.",
    defaultCategory: "Harmonogramowe",
  },
  {
    code: "R07",
    name: "Nieprzewidziane zmiany i roboty dodatkowe",
    effects:
      "Wstrzymanie robót, negocjacje, aneks, roszczenie, przekroczenie budżetu albo spór o odpowiedzialność.",
    defaultCategory: "Finansowe",
  },
  {
    code: "R08",
    name: "Model wynagrodzenia niedopasowany do niepewności zakresu",
    effects:
      "Zawyżona rezerwa w cenie albo niedoszacowanie, problemy płynnościowe i spory o zakres objęty wynagrodzeniem.",
    defaultCategory: "Finansowe",
  },
  {
    code: "R09",
    name: "Niejednoznaczne lub niemierzalne wymagania techniczne",
    effects:
      "Niewłaściwy dobór rozwiązania, przeprojektowanie, trudność w potwierdzeniu zgodności, problem z odbiorem.",
    defaultCategory: "Techniczne",
  },
  {
    code: "R10",
    name: "Niedookreślone próby, rozruch i odbiór",
    effects:
      "Wykonane roboty nie mogą zostać odebrane; opóźnia się użytkowanie i rozliczenie; powstaje spór o osiągnięcie parametrów.",
    defaultCategory: "Harmonogramowe",
  },
  {
    code: "R11",
    name: "Postępowanie podatne na odwołanie lub ograniczenie konkurencji",
    effects:
      "Przedłużenie albo unieważnienie postępowania, słabsza konkurencja, wyższa cena lub wybór rozwiązania nieadekwatnego do potrzeb.",
    defaultCategory: "Formalno-prawne",
  },
  {
    code: "R12",
    name: "Niewystarczająca zdolność wykonawcy lub łańcucha dostaw",
    effects:
      "Opóźnienie, zamiana materiałów lub urządzeń, problemy jakościowe i finansowe albo przerwanie realizacji.",
    defaultCategory: "Harmonogramowe",
  },
  {
    code: "R13",
    name: "Ryzyko finansowania, budżetu i płatności",
    effects:
      "Ograniczenie zakresu, opóźnione płatności, utrata dofinansowania, brak środków na niezbędne zmiany albo problemy płynnościowe.",
    defaultCategory: "Finansowe",
  },
  {
    code: "R14",
    name: "Nadmierne koszty eksploatacji i utrzymania",
    effects:
      "Obiekt spełnia wymagania inwestycyjne, ale jest drogi, trudny lub niestabilny w eksploatacji.",
    defaultCategory: "Finansowe",
  },
  {
    code: "R15",
    name: "Nieosiągnięcie efektu technologicznego, użytkowego lub środowiskowego",
    effects:
      "Brak wymaganej jakości lub wydajności, ograniczenie użytkowania, konieczność dodatkowych prac, ryzyko sankcji albo utraty efektu projektu.",
    defaultCategory: "Techniczne",
  },
];

// 8-punktowa Zbiorcza Checklista Przygotowania Inwestycji Wodociągowej MFiPR
export const WOD_KAN_PREPARATION_CHECKLIST: WodKanChecklistItem[] = [
  {
    id: "chk-1",
    sectionRef: "Rozdz. 1 (1.1–1.4)",
    title: "1. Potrzeba inwestycji, problem zaopatrzenia w wodę i obszar obsługi",
    verificationCriteria:
      "Określenie konkretnego problemu (brak sieci, spadki ciśnienia, jakość wody) oraz granic obszaru obsługi z jednoznaczną jednostką odbiorców (mieszkańcy, budynki, gospodarstwa domowe) i wyodrębnieniem odbiorców dominujących.",
    relatedRiskCodes: ["R01", "R15"],
  },
  {
    id: "chk-2",
    sectionRef: "Rozdz. 2 (2.1–2.3)",
    title: "2. Realne wykorzystanie sieci i deklaracje przyłączenia odbiorców",
    verificationCriteria:
      "Odróżnienie dostępu technicznego od rzeczywistego zamiaru podłączenia (deklaracje właścicieli), analiza małego lub sezonowego poboru wody na odcinkach końcowych (ryzyko stagnacji wody) oraz potencjału rozwojowego.",
    relatedRiskCodes: ["R14", "R15"],
  },
  {
    id: "chk-3",
    sectionRef: "Rozdz. 3 (3.1–3.4)",
    title: "3. Wstępny zakres przedsięwzięcia, funkcja odcinka i granice przyłączy",
    verificationCriteria:
      "Wskazanie początku i końca sieci, przybliżonej długości oraz jasne rozgraniczenie, czy zadanie obejmuje wyłącznie przewód sieciowy, czy również sięgacze/przyłącza do granic działek prywatnych.",
    relatedRiskCodes: ["R01", "R05", "R08"],
  },
  {
    id: "chk-4",
    sectionRef: "Rozdz. 4 (4.1–4.4)",
    title: "4. Możliwość zasilenia planowanej sieci i stanowisko operatora (SUW)",
    verificationCriteria:
      "Potwierdzenie rejonu włączenia, aktualnego stanowiska eksploatatora o wydajności dostępnej (a nie tylko nominalnej) ujęcia/SUW, warunków ciśnienia oraz wymogów przeciwpożarowych.",
    relatedRiskCodes: ["R02", "R09", "R15"],
  },
  {
    id: "chk-5",
    sectionRef: "Rozdz. 5 (5.1–5.4)",
    title: "5. Trasa sieci, struktura własności gruntów i prawo do dysponowania terenem",
    verificationCriteria:
      "Weryfikacja przebiegu w pasie drogowym vs po działkach prywatnych (np. tereny zielone i drogi wewnętrzne), identyfikacja wąskich gardeł i konieczności uzyskania służebności przesyłu lub zgód właścicieli.",
    relatedRiskCodes: ["R03", "R06"],
  },
  {
    id: "chk-6",
    sectionRef: "Rozdz. 5.4 & 6 (6.1–6.2)",
    title: "6. Główne przeszkody lokalizacyjne, przewierty HDD i zależności od innych zadań",
    verificationCriteria:
      "Identyfikacja przekroczeń dróg wojewódzkich/krajowych, torów kolejowych, cieków wodnych, kolizji z uzbrojeniem podziemnym oraz zależności od równoległej przebudowy drogi lub oczyszczalni.",
    relatedRiskCodes: ["R02", "R03", "R06", "R07"],
  },
  {
    id: "chk-7",
    sectionRef: "Rozdz. 6 (6.3–6.5)",
    title: "7. Wymogi decyzji środowiskowej (DŚU), pozwoleń wodnoprawnych i ochrony przyrody",
    verificationCriteria:
      "Rozpoznanie obowiązku uzyskania decyzji o środowiskowych uwarunkowaniach, zgód Wód Polskich, przecięcia obszarów Natura 2000 oraz okien czasowych ochrony gatunkowej.",
    relatedRiskCodes: ["R04", "R06"],
  },
  {
    id: "chk-8",
    sectionRef: "Rozdz. 7 (7.1–7.5)",
    title: "8. Podział odpowiedzialności (Inwestor – Operator – Wykonawca) i organizacja eksploatacji",
    verificationCriteria:
      "Przypisanie ról za pozyskanie zgód gruntowych, decyzji, prób ciśnieniowych, dezynfekcji i rozruchu oraz ustalenie docelowego właściciela majątku i operatora utrzymującego sieć (także międzygminnie).",
    relatedRiskCodes: ["R05", "R10", "R14"],
  },
];

// Kompletny zestaw 22 oficjalnych rekordów MFiPR z arkusza Risk_Miner_dane_projekty.xlsx
export const MFIPR_OFFICIAL_PROJECTS: MfiprProjectRecord[] = [
  {
    lp: 1,
    recordId: "RM-2026-001",
    recipientIdType: "NIP",
    nip: "9121715754",
    recipientName: "Gmina Oława",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "02",
    voivodeship: "dolnośląskie",
    city: "Oława",
    projectName: "Budowa rurociągu tłocznego kanalizacji sanitarnej Godzikowice – Jaczkowice, gmina Oława",
    scope: "całe postępowanie",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2022/BZP 00058537/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation: "",
    subsector: "Kanalizacja sanitarna",
    workType: "Budowa/rozbudowa",
    fundingProgram: "Budżet JST / Fundusze Krajowe",
    estimatedBudgetPln: 4_120_000,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning: "Bezpośrednie dopasowanie 1:1 po identyfikatorze ogłoszenia BZP 2022/BZP 00058537/01 oraz NIP 9121715754.",
    matchedNotices: [
      {
        noticeNumber: "2022/BZP 00058537/01",
        noticeType: "Ogłoszenie o zamówieniu",
        publicationDate: "2022-02-16",
        title: "Budowa rurociągu tłocznego kanalizacji sanitarnej Godzikowice – Jaczkowice, gmina Oława",
        contractValuePln: 4_120_000,
      },
      {
        noticeNumber: "2022/BZP 00142810/01",
        noticeType: "Ogłoszenie o wyniku postępowania",
        publicationDate: "2022-04-29",
        title: "Wybór najkorzystniejszej oferty – rurociąg tłoczny Godzikowice – Jaczkowice",
        contractorName: "[WYKONAWCA-ANONIMIZOWANY-RODO]",
        contractValuePln: 3_985_000,
      },
    ],
    detectedEvents: [
      {
        eventType: "Zmiana terminu wykonania",
        legalBasis: "Art. 455 ust. 1 pkt 1 Pzp",
        description: "Wydłużenie czasu realizacji przewiertów sterowanych HDD z uwagi na wysoki poziom wód gruntowych.",
        mappedRiskCode: "R02",
      },
    ],
    missingDataAlerts: [
      "Brak podpisanego egzemplarza umowy w paczce otwartej – warunki kontraktowe odtworzone z PPU oraz ogłoszenia o wyniku postępowania.",
    ],
    detectedRiskCodes: ["R02", "R03", "R06"],
    isExemplar: true,
  },
  {
    lp: 2,
    recordId: "RM-2026-002",
    recipientIdType: "NIP",
    nip: "6941566139",
    recipientName: "Gmina Zagrodno",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "02",
    voivodeship: "dolnośląskie",
    city: "Zagrodno",
    projectName: "Budowa kanalizacji sanitarnej na terenie Gminy Zagrodno w miejscowości Modlikowice",
    scope: "całe postępowanie",
    publicIdType: "Projekt KPO",
    publicId: "KPOD.03.15-IW.13-0004/25",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation:
      "KPO, inwestycja B3.1.1. Wartość przedsięwzięcia: 5 350 782,65 zł; dofinansowanie: 4 333 677,17 zł. Opis: „Przedmiot projektu: Planuje się budowę sieci kanalizacji sanitarnej o długości 2,38 kilometra. W ramach przedsięwzięcia realizowane będą także sięgacze sieciowe do granicy działek. Planowana jest także realizacja pompowni ścieków sanitarnych. Nowo powstała sieć kanalizacyjna zostanie wpięta do realizowanej obecnie oczyszczalni ścieków zlokalizowanej na działce oznaczonej geodezyjnie numerem 106 obręb Modlikowice.”",
    subsector: "Kanalizacja sanitarna",
    additionalSubsector: "Oczyszczalnia ścieków",
    workType: "Budowa/rozbudowa",
    fundingProgram: "KPO – Inwestycja B3.1.1",
    estimatedBudgetPln: 5_350_782.65,
    euFundingPln: 4_333_677.17,
    enrichmentStatus: "heuristic_matched",
    confidenceScore: 91,
    matchReasoning:
      "Rekord KPO powiązany heurystycznie w BZP po NIP 6941566139 (Gmina Zagrodno), lokalizacji Modlikowice (dz. nr 106) oraz zakresie 2,38 km sieci z pompownią.",
    matchedNotices: [
      {
        noticeNumber: "2024/BZP 00418920/01",
        noticeType: "Ogłoszenie o zamówieniu (Powiązane z KPO)",
        publicationDate: "2024-07-18",
        title: "Budowa sieci kanalizacji sanitarnej w m. Modlikowice (2,38 km wraz z pompownią)",
        contractValuePln: 5_350_782.65,
      },
    ],
    detectedEvents: [
      {
        eventType: "Zmiana terminu wykonania",
        legalBasis: "Art. 455 ust. 1 pkt 4 Pzp",
        description: "Zależność technologiczna wpięcia sieci od równolegle realizowanej oczyszczalni ścieków na dz. 106 obręb Modlikowice.",
        mappedRiskCode: "R06",
      },
    ],
    missingDataAlerts: [
      "Wykryto zależność międzyprojektową (wpięcie do budowanej oczyszczalni na dz. 106) – wymagany harmonogram skoordynowany rozruchu.",
    ],
    detectedRiskCodes: ["R01", "R06", "R10"],
    isExemplar: true,
  },
  {
    lp: 3,
    recordId: "RM-2026-003",
    recipientIdType: "NIP",
    nip: "8792466869",
    recipientName: "Gmina Czernikowo",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "04",
    voivodeship: "kujawsko-pomorskie",
    city: "Czernikowo",
    projectName: "Budowa oczyszczalni ścieków w miejscowości Steklin w formule zaprojektuj i wybuduj",
    scope: "całe postępowanie",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2024/BZP 00349631/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation: "",
    subsector: "Oczyszczalnia ścieków",
    workType: "Budowa/rozbudowa",
    fundingProgram: "Rządowy Fundusz Polski Ład / Budżet JST",
    estimatedBudgetPln: 11_450_000,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning:
      "Dopasowanie 1:1 po numerze BZP 2024/BZP 00349631/01. Wykryto powiązanego zamawiającego wielokrotnego: Gmina Czernikowo (NIP 8792466869 – powiązany z RM-2026-004).",
    matchedNotices: [
      {
        noticeNumber: "2024/BZP 00349631/01",
        noticeType: "Ogłoszenie o zamówieniu",
        publicationDate: "2024-06-04",
        title: "Budowa oczyszczalni ścieków w miejscowości Steklin w formule zaprojektuj i wybuduj",
        contractValuePln: 11_450_000,
      },
    ],
    detectedEvents: [
      {
        eventType: "Roboty dodatkowe / zamienne",
        legalBasis: "Art. 455 ust. 1 pkt 4 Pzp",
        description: "Konieczność doprecyzowania parametrów osadu czynnego i automatyki w formule Projektuj i Buduj (PFU).",
        mappedRiskCode: "R09",
      },
    ],
    missingDataAlerts: [
      "Formuła Projektuj i Buduj: brak załączonego raportu z rozruchu technologicznego i potwierdzenia efektu ekologicznego.",
    ],
    detectedRiskCodes: ["R04", "R08", "R09", "R10", "R15"],
    isExemplar: true,
  },
  {
    lp: 4,
    recordId: "RM-2026-004",
    recipientIdType: "NIP",
    nip: "8792466869",
    recipientName: "Gmina Czernikowo",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "04",
    voivodeship: "kujawsko-pomorskie",
    city: "Czernikowo",
    projectName: "Modernizacja Stacji Uzdatniania Wody w Czernikowie",
    scope: "całe postępowanie",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2025/BZP 00569258/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation: "",
    subsector: "Uzdatnianie i zaopatrzenie w wodę",
    workType: "Przebudowa/renowacja",
    fundingProgram: "Fundusze Europejskie / Budżet JST",
    estimatedBudgetPln: 4_890_000,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning:
      "Dopasowanie 1:1 po numerze BZP 2025/BZP 00569258/01. Zamawiający wielokrotny: Gmina Czernikowo (NIP 8792466869 – drugi projekt w bazie obok RM-2026-003).",
    matchedNotices: [
      {
        noticeNumber: "2025/BZP 00569258/01",
        noticeType: "Ogłoszenie o zamówieniu",
        publicationDate: "2025-09-12",
        title: "Modernizacja Stacji Uzdatniania Wody w Czernikowie",
        contractValuePln: 4_890_000,
      },
    ],
    detectedEvents: [
      {
        eventType: "Zmiana terminu wykonania",
        legalBasis: "Art. 455 ust. 1 pkt 1 Pzp",
        description: "Etapowanie przełączeń układów filtracji i aeracji w celu utrzymania ciągłości dostaw wody dla mieszkańców.",
        mappedRiskCode: "R06",
      },
    ],
    missingDataAlerts: [
      "Brak protokołów badań fizykochemicznych wody surowej przed modernizacją filtrów odżelaziających.",
    ],
    detectedRiskCodes: ["R02", "R06", "R10", "R15"],
    isExemplar: false,
  },
  {
    lp: 5,
    recordId: "RM-2026-005",
    recipientIdType: "NIP",
    nip: "8792469951",
    recipientName: "Gmina Zławieś Wielka",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "04",
    voivodeship: "kujawsko-pomorskie",
    city: "Zławieś Wielka",
    projectName:
      "Budowa sieci kanalizacji sanitarnej w miejscowości Zławieś Wielka i Zławieś Mała wraz z modernizacją stacji uzdatniania wody w miejscowości Pędzewo",
    scope: "całe postępowanie",
    publicIdType: "Projekt KPO",
    publicId: "KPOD.03.15-IW.14-0032/25",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation:
      "KPO, inwestycja B3.1.1. Wartość przedsięwzięcia: 3 087 491,54 zł; dofinansowanie: 2 349 408,96 zł. Opis: „Projekt dotyczy budowy sieci kanalizacji sanitarnej oraz modernizacji stacji uzdatniania wody na terenie Gminy Zławieś Wielka.”",
    subsector: "Kanalizacja sanitarna",
    additionalSubsector: "Uzdatnianie i zaopatrzenie w wodę",
    workType: "Budowa/rozbudowa",
    fundingProgram: "KPO – Inwestycja B3.1.1",
    estimatedBudgetPln: 3_087_491.54,
    euFundingPln: 2_349_408.96,
    enrichmentStatus: "heuristic_matched",
    confidenceScore: 88,
    matchReasoning:
      "Dopasowanie heurystyczne dla projektu KPO po NIP 8792469951 oraz lokalizacjach Zławieś Wielka, Zławieś Mała i SUW Pędzewo.",
    matchedNotices: [
      {
        noticeNumber: "2024/BZP 00511204/01",
        noticeType: "Ogłoszenie o zamówieniu (Powiązane z KPO)",
        publicationDate: "2024-09-20",
        title: "Rozbudowa kanalizacji sanitarnej Zławieś Wielka/Mała oraz modernizacja SUW Pędzewo",
        contractValuePln: 3_087_491.54,
      },
    ],
    detectedEvents: [
      {
        eventType: "Zmiana wynagrodzenia",
        legalBasis: "Art. 455 ust. 2 Pzp",
        description: "Korekta robót instalacyjnych i armatury na SUW Pędzewo w granicach do 15% wartości zamówienia.",
        mappedRiskCode: "R07",
      },
    ],
    missingDataAlerts: [
      "Projekt dwubranżowy (kanalizacja + SUW): zalecana weryfikacja podziału kosztów kwalifikowalnych w KPO B3.1.1.",
    ],
    detectedRiskCodes: ["R01", "R07", "R13"],
    isExemplar: false,
  },
  {
    lp: 6,
    recordId: "RM-2026-006",
    recipientIdType: "NIP",
    nip: "7151863553",
    recipientName: "Gmina Gościeradów",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "06",
    voivodeship: "lubelskie",
    city: "Gościeradów Ukazowy",
    projectName: "Przebudowa (modernizacja) oczyszczalni ścieków w m. Gościeradów Folwark",
    scope: "całe postępowanie",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2024/BZP 00067908/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation: "Program Rozwoju Obszarów Wiejskich 2014–2020 (EFRROW).",
    subsector: "Oczyszczalnia ścieków",
    workType: "Przebudowa/renowacja",
    fundingProgram: "PROW 2014–2020 (EFRROW)",
    estimatedBudgetPln: 6_240_000,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning: "Dopasowanie 1:1 po numerze BZP 2024/BZP 00067908/01 oraz NIP 7151863553 (PROW EFRROW).",
    matchedNotices: [
      {
        noticeNumber: "2024/BZP 00067908/01",
        noticeType: "Ogłoszenie o zamówieniu",
        publicationDate: "2024-01-26",
        title: "Przebudowa (modernizacja) oczyszczalni ścieków w m. Gościeradów Folwark",
        contractValuePln: 6_240_000,
      },
    ],
    detectedEvents: [
      {
        eventType: "Zmiana terminu wykonania",
        legalBasis: "Art. 455 ust. 1 pkt 4 Pzp",
        description: "Dostosowanie harmonogramu rozruchu reaktorów biologicznych do rygoru rozliczenia końcowego PROW 2014–2020.",
        mappedRiskCode: "R13",
      },
    ],
    missingDataAlerts: [],
    detectedRiskCodes: ["R02", "R10", "R13"],
    isExemplar: false,
  },
  {
    lp: 7,
    recordId: "RM-2026-007",
    recipientIdType: "NIP",
    nip: "7141896261",
    recipientName: "Gmina Kamionka",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "06",
    voivodeship: "lubelskie",
    city: "Kamionka",
    projectName: "Rozbudowa sieci wodociągowej w gminie Kamionka",
    scope: "całe postępowanie",
    publicIdType: "Projekt KPO",
    publicId: "KPOD.03.15-IW.15-0081/25",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation:
      "KPO, inwestycja B3.1.1. Wartość przedsięwzięcia: 3 096 863,90 zł; dofinansowanie: 2 517 775,52 zł. Opis: „Celem projektu jest rozwój równoważonej gospodarki wodno-ściekowej na terenach wiejskich (poza aglomeracjami) poprzez rozbudowę sieci wodociągowej w gminie Kamionka.”",
    subsector: "Sieć wodociągowa",
    workType: "Budowa/rozbudowa",
    fundingProgram: "KPO – Inwestycja B3.1.1",
    estimatedBudgetPln: 3_096_863.9,
    euFundingPln: 2_517_775.52,
    enrichmentStatus: "heuristic_matched",
    confidenceScore: 89,
    matchReasoning: "Powiązano rekord KPO po NIP 7141896261 (Gmina Kamionka) i przedmiocie rozbudowy sieci wodociągowej poza aglomeracją.",
    matchedNotices: [
      {
        noticeNumber: "2025/BZP 00104822/01",
        noticeType: "Ogłoszenie o zamówieniu (Powiązane z KPO)",
        publicationDate: "2025-02-14",
        title: "Rozbudowa sieci wodociągowej na terenach wiejskich w gminie Kamionka",
        contractValuePln: 3_096_863.9,
      },
    ],
    detectedEvents: [],
    missingDataAlerts: [
      "Brak w paczce szczegółowego wykazu działek i deklaracji przyłączeniowych mieszkańców na terenach rozproszonych.",
    ],
    detectedRiskCodes: ["R03", "R13", "R15"],
    isExemplar: true,
  },
  {
    lp: 8,
    recordId: "RM-2026-008",
    recipientIdType: "NIP",
    nip: "7381973883",
    recipientName: "Gmina Biecz",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "12",
    voivodeship: "małopolskie",
    city: "Biecz",
    projectName: "Budowa sieci kanalizacji sanitarnej na terenie Gminy Biecz",
    scope: "część 1",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2026/BZP 00084760/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation:
      "KPO, inwestycja B3.1.1. Wartość przedsięwzięcia: 6 188 345,13 zł; dofinansowanie: 5 000 000,00 zł. Opis: „Budowa kanalizacji sanitarnej na terenie Gminy Biecz w Miejscowościach: Libusza „Ogniwo Jedle”, Libusza „Podwójtowie”, Strzeszyn, Biecz „Przedmieście” o łącznej długości 11,871 km W tym: Libusza „Ogniwo” 4529m, Libusza „Podwójtowie” 3794m, Strzeszyn 2907m, Biecz „Przedmieście” 641m. Przewiduje się kompleksową realizację przedmiotu inwestycji.”",
    subsector: "Kanalizacja sanitarna",
    workType: "Budowa/rozbudowa",
    fundingProgram: "KPO – Inwestycja B3.1.1",
    estimatedBudgetPln: 6_188_345.13,
    euFundingPln: 5_000_000.0,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning:
      "Dopasowanie 1:1 po numerze BZP 2026/BZP 00084760/01. Uwaga analityczna: zakres rekordu obejmuje wyłącznie CZĘŚĆ 1 zamówienia wieloczęściowego (11,871 km sieci).",
    matchedNotices: [
      {
        noticeNumber: "2026/BZP 00084760/01",
        noticeType: "Ogłoszenie o zamówieniu (Część 1)",
        publicationDate: "2026-02-05",
        title: "Budowa sieci kanalizacji sanitarnej na terenie Gminy Biecz – Część 1 (Libusza, Strzeszyn, Biecz)",
        contractValuePln: 6_188_345.13,
      },
    ],
    detectedEvents: [
      {
        eventType: "Roboty dodatkowe / zamienne",
        legalBasis: "Art. 455 ust. 1 pkt 3 Pzp",
        description: "Złożone warunki terenowe na odcinku 11,871 km w terenie podgórskim (spadki grawitacyjne i kolizje).",
        mappedRiskCode: "R03",
      },
    ],
    missingDataAlerts: [
      "Zamówienie podzielone na części (zakres: część 1) – wartość całego projektu KPO nie jest tożsama z wartością pojedynczej umowy wykonawczej.",
    ],
    detectedRiskCodes: ["R01", "R03", "R06", "R13"],
    isExemplar: true,
  },
  {
    lp: 9,
    recordId: "RM-2026-009",
    recipientIdType: "NIP",
    nip: "7962959318",
    recipientName: "Gmina Zakrzew",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "14",
    voivodeship: "mazowieckie",
    city: "Zakrzew",
    projectName: "Budowa sieci wodociągowej na terenie gminy Zakrzew",
    scope: "część 2",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2025/BZP 00307948/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation:
      "KPO, inwestycja B3.1.1. Wartość przedsięwzięcia: 2 329 043,45 zł; dofinansowanie: 1 894 503,63 zł. Opis: „Niniejszy projekt dotyczy 3 odcinków sieci wodociągowej położonych na terenie gminy Zakrzew: 1. budowa sieci wodociągowej o długości 371,5 m zlokalizowanej w miejscowości Dąbrówka Podłężna, dz. 445, 435, obręb Dąbrówka Podłężna 2. budowa sieci wodociągowej o długości 557,1 m zlokalizowanej w miejscowości Natalin dz. nr 85,100/1, obręb Natalin, dz. nr 59,61,63, obręb Zakrzew Poduchowny, miejscowość Podlesie Mleczkowskie dz. nr 98, 99/1, 97, 237/1, obręb Podlesie Mleczkowskie.”",
    subsector: "Sieć wodociągowa",
    workType: "Budowa/rozbudowa",
    fundingProgram: "KPO – Inwestycja B3.1.1",
    estimatedBudgetPln: 2_329_043.45,
    euFundingPln: 1_894_503.63,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning:
      "Dopasowanie 1:1 po numerze BZP 2025/BZP 00307948/01. Zakres obejmuje CZĘŚĆ 2 postępowania (3 odcinki rozproszone: Dąbrówka Podłężna, Natalin, Podlesie Mleczkowskie).",
    matchedNotices: [
      {
        noticeNumber: "2025/BZP 00307948/01",
        noticeType: "Ogłoszenie o zamówieniu (Część 2)",
        publicationDate: "2025-05-19",
        title: "Budowa sieci wodociągowej na terenie gminy Zakrzew – Część 2",
        contractValuePln: 2_329_043.45,
      },
    ],
    detectedEvents: [],
    missingDataAlerts: [
      "Zakres częściowy (część 2) obejmujący rozproszone działki ewidencyjne – wymagana weryfikacja spójności przedmiarów dla każdego z 3 odcinków.",
    ],
    detectedRiskCodes: ["R01", "R03", "R05"],
    isExemplar: true,
  },
  {
    lp: 10,
    recordId: "RM-2026-010",
    recipientIdType: "NIP",
    nip: "8161570014",
    recipientName: "Gmina Grodzisko Dolne",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "18",
    voivodeship: "podkarpackie",
    city: "Grodzisko Dolne",
    projectName: "Budowa kanalizacji sanitarnej w miejscowości Zmysłówka i Grodzisko Dolne, gmina Grodzisko Dolne",
    scope: "całe postępowanie",
    publicIdType: "Projekt KPO",
    publicId: "KPOD.03.15-IW.21-0025/25",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation:
      "KPO, inwestycja B3.1.1. Wartość przedsięwzięcia: 3 373 482,44 zł; dofinansowanie: 2 742 668,65 zł. Opis: „Realizacja projektu polega na budowie sieci kanalizacji sanitarnej w miejscowości Zmysłówka oraz Grodzisko Dolne, w części poza znajdującej się poza aglomeracją (zgodnie z załącznikiem graficznym).”",
    subsector: "Kanalizacja sanitarna",
    workType: "Budowa/rozbudowa",
    fundingProgram: "KPO – Inwestycja B3.1.1",
    estimatedBudgetPln: 3_373_482.44,
    euFundingPln: 2_742_668.65,
    enrichmentStatus: "heuristic_matched",
    confidenceScore: 87,
    matchReasoning:
      "Dopasowanie heurystyczne po NIP 8161570014 (Gmina Grodzisko Dolne) oraz słowach kluczowych Zmysłówka / poza aglomeracją.",
    matchedNotices: [
      {
        noticeNumber: "2025/BZP 00192411/01",
        noticeType: "Ogłoszenie o zamówieniu (Powiązane z KPO)",
        publicationDate: "2025-03-27",
        title: "Budowa sieci kanalizacji sanitarnej w m. Zmysłówka i Grodzisko Dolne",
        contractValuePln: 3_373_482.44,
      },
    ],
    detectedEvents: [],
    missingDataAlerts: [
      "Brak w paczce załącznika graficznego rozgraniczającego obszar poza aglomeracją (kryterium kwalifikowalności KPO B3.1.1).",
    ],
    detectedRiskCodes: ["R01", "R13"],
    isExemplar: false,
  },
  {
    lp: 11,
    recordId: "RM-2026-011",
    recipientIdType: "NIP",
    nip: "6871783356",
    recipientName: "Gmina Sanok",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "18",
    voivodeship: "podkarpackie",
    city: "Sanok",
    projectName: "Budowa sieci wodociągowej w miejscowości Czerteż, Zabłotce oraz w części miejscowości Sanoczek",
    scope: "całe postępowanie",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2023/BZP 00271948/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation: "",
    subsector: "Sieć wodociągowa",
    workType: "Budowa/rozbudowa",
    fundingProgram: "Budżet JST / Fundusze Krajowe",
    estimatedBudgetPln: 5_420_000,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning: "Dopasowanie 1:1 po numerze BZP 2023/BZP 00271948/01 oraz NIP 6871783356 (Gmina Sanok).",
    matchedNotices: [
      {
        noticeNumber: "2023/BZP 00271948/01",
        noticeType: "Ogłoszenie o zamówieniu",
        publicationDate: "2023-06-22",
        title: "Budowa sieci wodociągowej w m. Czerteż, Zabłotce oraz Sanoczek",
        contractValuePln: 5_420_000,
      },
    ],
    detectedEvents: [
      {
        eventType: "Zmiana terminu wykonania",
        legalBasis: "Art. 455 ust. 1 pkt 1 Pzp",
        description: "Przesunięcie terminu prób ciśnieniowych sieci z uwagi na uwarunkowania wysokościowe i strefy ciśnienia.",
        mappedRiskCode: "R10",
      },
    ],
    missingDataAlerts: [],
    detectedRiskCodes: ["R02", "R03", "R10"],
    isExemplar: true,
  },
  {
    lp: 12,
    recordId: "RM-2026-012",
    recipientIdType: "NIP",
    nip: "5890010583",
    recipientName: "Gmina Kartuzy – Urząd Miejski w Kartuzach",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "22",
    voivodeship: "pomorskie",
    city: "Kartuzy",
    projectName: "Budowa tranzytu przesyłowego sieci kanalizacji sanitarnej ze Smętowa Chmieleńskiego do Kos",
    scope: "całe postępowanie",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2025/BZP 00119683/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation: "",
    subsector: "Kanalizacja sanitarna",
    workType: "Budowa/rozbudowa",
    fundingProgram: "Fundusze Europejskie / Budżet JST",
    estimatedBudgetPln: 7_850_000,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning: "Dopasowanie 1:1 po numerze BZP 2025/BZP 00119683/01 oraz NIP 5890010583 (Gmina Kartuzy).",
    matchedNotices: [
      {
        noticeNumber: "2025/BZP 00119683/01",
        noticeType: "Ogłoszenie o zamówieniu",
        publicationDate: "2025-02-25",
        title: "Budowa tranzytu przesyłowego sieci kanalizacji sanitarnej ze Smętowa Chmieleńskiego do Kos",
        contractValuePln: 7_850_000,
      },
    ],
    detectedEvents: [
      {
        eventType: "Roboty dodatkowe / zamienne",
        legalBasis: "Art. 455 ust. 1 pkt 4 Pzp",
        description: "Wzmocnienie posadowienia rurociągu tranzytowego na odcinkach o trudnych warunkach geotechnicznych Pojezierza Kaszubskiego.",
        mappedRiskCode: "R02",
      },
    ],
    missingDataAlerts: [],
    detectedRiskCodes: ["R02", "R04", "R07"],
    isExemplar: false,
  },
  {
    lp: 13,
    recordId: "RM-2026-013",
    recipientIdType: "NIP",
    nip: "6521708710",
    recipientName: "Gmina Bestwina",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "24",
    voivodeship: "śląskie",
    city: "Bestwina",
    projectName: "Budowa sieci kanalizacji sanitarnej w Gminie Bestwina – sołectwo Kaniów",
    scope: "całe postępowanie",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2023/BZP 00206497/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation: "Program Rozwoju Obszarów Wiejskich 2014–2020 (EFRROW).",
    subsector: "Kanalizacja sanitarna",
    workType: "Budowa/rozbudowa",
    fundingProgram: "PROW 2014–2020 (EFRROW)",
    estimatedBudgetPln: 4_650_000,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning: "Dopasowanie 1:1 po numerze BZP 2023/BZP 00206497/01 oraz NIP 6521708710.",
    matchedNotices: [
      {
        noticeNumber: "2023/BZP 00206497/01",
        noticeType: "Ogłoszenie o zamówieniu",
        publicationDate: "2023-05-09",
        title: "Budowa sieci kanalizacji sanitarnej w Gminie Bestwina – sołectwo Kaniów",
        contractValuePln: 4_650_000,
      },
    ],
    detectedEvents: [],
    missingDataAlerts: [],
    detectedRiskCodes: ["R03", "R06"],
    isExemplar: false,
  },
  {
    lp: 14,
    recordId: "RM-2026-014",
    recipientIdType: "NIP",
    nip: "6252446477",
    recipientName: "Gmina Bobrowniki",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "24",
    voivodeship: "śląskie",
    city: "Bobrowniki",
    projectName: "Budowa sieci kanalizacji sanitarnej ul. Słoneczna w Siemoni",
    scope: "całe postępowanie",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2026/BZP 00130634/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation:
      "KPO, inwestycja B3.1.1. Wartość przedsięwzięcia: 1 714 989,00 zł; dofinansowanie: 1 394 300,00 zł. Opis: „Wnioskowaną inwestycją jest zbudowanie sieci kanalizacji sanitarnej na potrzeby mieszkalnictwa jednorodzinnego w Siemoni przy ul.Słonecznej w Gminie Bobrowniki. Planowana inwestycja zlokalizowana jest w zlewni drogi 913 w Siemoni, na działkach 528/4, 530, 531/1, 531/2, 532/2, 533/1, 534/2, 537/1, 564, 563, 562, 854/1, 854/2, 558/1, 557/5, 557/6, 556, 555/1, 528/2, 554/1, 558/6. Wnioskowana inwestycja budowy kanalizacji, przebiega w terenach zielonych stanowiących własność prywatną, w pasie drogi gminnej.”",
    subsector: "Kanalizacja sanitarna",
    workType: "Budowa/rozbudowa",
    fundingProgram: "KPO – Inwestycja B3.1.1",
    estimatedBudgetPln: 1_714_989.0,
    euFundingPln: 1_394_300.0,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning:
      "Dopasowanie 1:1 po numerze BZP 2026/BZP 00130634/01. W adnotacji wykryto krytyczny sygnał R03: przebieg sieci przez 21 działek stanowiących własność prywatną.",
    matchedNotices: [
      {
        noticeNumber: "2026/BZP 00130634/01",
        noticeType: "Ogłoszenie o zamówieniu",
        publicationDate: "2026-02-24",
        title: "Budowa sieci kanalizacji sanitarnej ul. Słoneczna w Siemoni",
        contractValuePln: 1_714_989.0,
      },
    ],
    detectedEvents: [
      {
        eventType: "Zmiana terminu wykonania",
        legalBasis: "Art. 455 ust. 1 pkt 4 Pzp",
        description: "Ryzyko blokady wejścia w teren na działkach stanowiących własność prywatną w zlewni DW 913.",
        mappedRiskCode: "R03",
      },
    ],
    missingDataAlerts: [
      "Krytyczny alert R03: Trasa przebiega po terenach zielonych stanowiących własność prywatną (21 działek) – wymagana weryfikacja kompletności oświadczeń o prawie do dysponowania nieruchomością na cele budowlane.",
    ],
    detectedRiskCodes: ["R03", "R04", "R06"],
    isExemplar: true,
  },
  {
    lp: 15,
    recordId: "RM-2026-015",
    recipientIdType: "NIP",
    nip: "5783105254",
    recipientName: "Gmina Elbląg",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "28",
    voivodeship: "warmińsko-mazurskie",
    city: "Elbląg",
    projectName:
      "Przebudowa sieci wodociągowej oraz kanalizacji sanitarnej i deszczowej wraz z przyłączami i modernizacją oczyszczalni ścieków w miejscowości Janów w formule zaprojektuj i wybuduj",
    scope: "całe postępowanie",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2023/BZP 00135041/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation: "",
    subsector: "Sieć wodociągowa",
    additionalSubsector: "Oczyszczalnia ścieków",
    workType: "Przebudowa/renowacja",
    fundingProgram: "Rządowy Fundusz Polski Ład / Budżet JST",
    estimatedBudgetPln: 9_650_000,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning:
      "Dopasowanie 1:1 po numerze BZP 2023/BZP 00135041/01. Projekt wielopodsektorowy (wodociąg + kanalizacja sanitarna + deszczowa + oczyszczalnia) w formule Projektuj i Buduj.",
    matchedNotices: [
      {
        noticeNumber: "2023/BZP 00135041/01",
        noticeType: "Ogłoszenie o zamówieniu",
        publicationDate: "2023-03-15",
        title: "Przebudowa sieci wod-kan i modernizacja oczyszczalni ścieków w m. Janów (PiB)",
        contractValuePln: 9_650_000,
      },
    ],
    detectedEvents: [
      {
        eventType: "Zmiana wynagrodzenia",
        legalBasis: "Art. 455 ust. 1 pkt 4 Pzp",
        description: "Kolizje międzybranżowe przy jednoczesnej przebudowie trzech sieci (wodociągowej, sanitarnej i deszczowej) w jednym korytarzu.",
        mappedRiskCode: "R01",
      },
    ],
    missingDataAlerts: [
      "Złożony projekt wielobranżowy w formule PiB – wymagane doprecyzowanie hierarchii dokumentów w PPU/SWU.",
    ],
    detectedRiskCodes: ["R01", "R02", "R05", "R08"],
    isExemplar: true,
  },
  {
    lp: 16,
    recordId: "RM-2026-016",
    recipientIdType: "NIP",
    nip: "7412025674",
    recipientName: "Gmina Miłakowo",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "28",
    voivodeship: "warmińsko-mazurskie",
    city: "Miłakowo",
    projectName:
      "Budowa sieci wodociągowej o długości 22,616 km i sieci kanalizacji sanitarnej na odcinku 18,09 km na obszarach wiejskich Gminy Miłakowo",
    scope: "całe postępowanie",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2022/BZP 00308854/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation: "",
    subsector: "Sieć wodociągowa",
    additionalSubsector: "Kanalizacja sanitarna",
    workType: "Budowa/rozbudowa",
    fundingProgram: "Rządowy Fundusz Polski Ład / Fundusze UE",
    estimatedBudgetPln: 19_400_000,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning:
      "Dopasowanie 1:1 po numerze BZP 2022/BZP 00308854/01. Bardzo duży zakres liniowy: 22,616 km sieci wodociągowej oraz 18,09 km sieci kanalizacji sanitarnej.",
    matchedNotices: [
      {
        noticeNumber: "2022/BZP 00308854/01",
        noticeType: "Ogłoszenie o zamówieniu",
        publicationDate: "2022-08-17",
        title: "Budowa sieci wodociągowej (22,616 km) i kanalizacji sanitarnej (18,09 km) w Gminie Miłakowo",
        contractValuePln: 19_400_000,
      },
    ],
    detectedEvents: [
      {
        eventType: "Zmiana wynagrodzenia",
        legalBasis: "Art. 439 Pzp (Waloryzacja)",
        description: "Waloryzacja wynagrodzenia wykonawcy na kontrakcie długoterminowym (>40 km łącznie sieci rurociągowych PEHD/PVC).",
        mappedRiskCode: "R12",
      },
    ],
    missingDataAlerts: [
      "Przy długości sieci wodociągowej 22,616 km na terenach wiejskich występuje podwyższone ryzyko małego początkowego poboru i stagnacji wody na końcówkach sieci (Rozdz. 2.3 Poradnika).",
    ],
    detectedRiskCodes: ["R03", "R06", "R12", "R14"],
    isExemplar: true,
  },
  {
    lp: 17,
    recordId: "RM-2026-017",
    recipientIdType: "NIP",
    nip: "7773157115",
    recipientName: "Gmina Kleszczewo",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "30",
    voivodeship: "wielkopolskie",
    city: "Kleszczewo",
    projectName: "Budowa sieci kanalizacji sanitarnej wraz z przyłączami w miejscowości Tanibórz, Gmina Kleszczewo",
    scope: "całe postępowanie",
    publicIdType: "Projekt KPO",
    publicId: "KPOD.03.15-IW.27-0013/25",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation:
      "KPO, inwestycja B3.1.1. Wartość przedsięwzięcia: 4 052 494,96 zł; dofinansowanie: 3 294 711,35 zł. Opis: „Przedmiotem projektu jest budowa sieci kanalizacji sanitarnej (grawitacyjnej oraz tłocznej) wraz z przyłączami oraz przepompowniami ścieków w miejscowości Tanibórz, gm. Kleszczewo.”",
    subsector: "Kanalizacja sanitarna",
    workType: "Budowa/rozbudowa",
    fundingProgram: "KPO – Inwestycja B3.1.1",
    estimatedBudgetPln: 4_052_494.96,
    euFundingPln: 3_294_711.35,
    enrichmentStatus: "heuristic_matched",
    confidenceScore: 90,
    matchReasoning: "Powiązano rekord KPO po NIP 7773157115 (Gmina Kleszczewo) i lokalizacji Tanibórz.",
    matchedNotices: [
      {
        noticeNumber: "2025/BZP 00091844/01",
        noticeType: "Ogłoszenie o zamówieniu (Powiązane z KPO)",
        publicationDate: "2025-02-07",
        title: "Budowa sieci kanalizacji sanitarnej wraz z przyłączami w m. Tanibórz",
        contractValuePln: 4_052_494.96,
      },
    ],
    detectedEvents: [],
    missingDataAlerts: [],
    detectedRiskCodes: ["R01", "R04", "R10"],
    isExemplar: false,
  },
  {
    lp: 18,
    recordId: "RM-2026-018",
    recipientIdType: "NIP",
    nip: "6211694095",
    recipientName: "Gmina Zduny",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "30",
    voivodeship: "wielkopolskie",
    city: "Zduny",
    projectName: "Budowa kanalizacji sanitarnej w miejscowości Baszków Gmina Zduny – etap II",
    scope: "całe postępowanie",
    publicIdType: "Projekt KPO",
    publicId: "KPOD.03.15-IW.27-0107/25",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation:
      "KPO, inwestycja B3.1.1. Wartość przedsięwzięcia: 3 847 757,34 zł; dofinansowanie: 3 128 258,00 zł. Opis: „Projekt dotyczy budowy kanalizacji sanitarnej w miejscowości Baszków, obejmującej kanały KS2 i KS4. Głównym celem projektu jest zapewnienie sprawnego odprowadzania ścieków sanitarnych z obszaru objętego inwestycją do istniejącego systemu kanalizacyjnego. Projekt obejmuje: Budowę kanałów głównych KS2 i KS4. Wykonanie przykanalików – odcinków od kanału głównego do przyłączy do granic posesji, zlokalizowanych wzdłuż tras kanałów, zakończonych studniami przyłączeniowymi.”",
    subsector: "Kanalizacja sanitarna",
    workType: "Budowa/rozbudowa",
    fundingProgram: "KPO – Inwestycja B3.1.1",
    estimatedBudgetPln: 3_847_757.34,
    euFundingPln: 3_128_258.0,
    enrichmentStatus: "heuristic_matched",
    confidenceScore: 92,
    matchReasoning:
      "Powiązano rekord KPO po NIP 6211694095 (Gmina Zduny), miejscowości Baszków (etap II, kanały KS2 i KS4).",
    matchedNotices: [
      {
        noticeNumber: "2025/BZP 00158302/01",
        noticeType: "Ogłoszenie o zamówieniu (Powiązane z KPO)",
        publicationDate: "2025-03-11",
        title: "Budowa kanalizacji sanitarnej w miejscowości Baszków – etap II (kanały KS2 i KS4)",
        contractValuePln: 3_847_757.34,
      },
    ],
    detectedEvents: [],
    missingDataAlerts: [],
    detectedRiskCodes: ["R01", "R05"],
    isExemplar: true,
  },
  {
    lp: 19,
    recordId: "RM-2026-019",
    recipientIdType: "NIP",
    nip: "9720914891",
    recipientName: "Wielkopolski Zarząd Dróg Wojewódzkich w Poznaniu",
    recipientType: "Samorządowa jednostka organizacyjna",
    country: "Polska",
    teryt: "30",
    voivodeship: "wielkopolskie",
    city: "Poznań",
    projectName: "Budowa kanalizacji deszczowej w ciągu drogi wojewódzkiej nr 444 w miejscowości Sulmierzyce",
    scope: "całe postępowanie",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2024/BZP 00354928/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation: "",
    subsector: "Kanalizacja deszczowa i retencja",
    workType: "Budowa/rozbudowa",
    fundingProgram: "Budżet Samorządu Województwa Wielkopolskiego",
    estimatedBudgetPln: 3_480_000,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning:
      "Dopasowanie 1:1 po numerze BZP 2024/BZP 00354928/01 oraz NIP 9720914891 (WZDW w Poznaniu). Reprezentatywny projekt podsektora Kanalizacja deszczowa i retencja.",
    matchedNotices: [
      {
        noticeNumber: "2024/BZP 00354928/01",
        noticeType: "Ogłoszenie o zamówieniu",
        publicationDate: "2024-06-06",
        title: "Budowa kanalizacji deszczowej w ciągu DW 444 w m. Sulmierzyce",
        contractValuePln: 3_480_000,
      },
    ],
    detectedEvents: [
      {
        eventType: "Roboty dodatkowe / zamienne",
        legalBasis: "Art. 455 ust. 1 pkt 4 Pzp",
        description: "Kolizje z istniejącym uzbrojeniem podziemnym w pasie drogi wojewódzkiej nr 444 oraz organizacja ruchu zastępczego.",
        mappedRiskCode: "R03",
      },
    ],
    missingDataAlerts: [],
    detectedRiskCodes: ["R02", "R03", "R04"],
    isExemplar: true,
  },
  {
    lp: 20,
    recordId: "RM-2026-020",
    recipientIdType: "NIP",
    nip: "8590012007",
    recipientName: "Gmina Nowogard",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "32",
    voivodeship: "zachodniopomorskie",
    city: "Nowogard",
    projectName: "Budowa kanalizacji sanitarnej wraz z oczyszczalnią ścieków na terenie gminy Nowogard w m. Konarzewo",
    scope: "całe postępowanie",
    publicIdType: "Projekt KPO",
    publicId: "KPOD.03.15-IW.28-0003/24",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation:
      "KPO, inwestycja B3.1.1. Wartość przedsięwzięcia: 1 749 991,33 zł; dofinansowanie: 1 414 257,17 zł. Opis: „Projekt obejmuje przebudowę i budowę oczyszczalni ścieków w m. Konarzewo, gm. Nowogard oraz budowę sieci kanalizacji sanitarnej z 17 przyłączami i rozgałęzieniami sieci wraz z niezbędną infrastrukturą techniczną.”",
    subsector: "Oczyszczalnia ścieków",
    additionalSubsector: "Kanalizacja sanitarna",
    workType: "Budowa/rozbudowa",
    fundingProgram: "KPO – Inwestycja B3.1.1",
    estimatedBudgetPln: 1_749_991.33,
    euFundingPln: 1_414_257.17,
    enrichmentStatus: "heuristic_matched",
    confidenceScore: 91,
    matchReasoning:
      "Dopasowanie heurystyczne po NIP 8590012007 (Gmina Nowogard – zamawiający wielokrotny powiązany z RM-2026-021) oraz lokalizacji Konarzewo.",
    matchedNotices: [
      {
        noticeNumber: "2024/BZP 00294115/01",
        noticeType: "Ogłoszenie o zamówieniu (Powiązane z KPO)",
        publicationDate: "2024-05-08",
        title: "Budowa kanalizacji sanitarnej z 17 przyłączami oraz oczyszczalni ścieków w m. Konarzewo",
        contractValuePln: 1_749_991.33,
      },
    ],
    detectedEvents: [],
    missingDataAlerts: [],
    detectedRiskCodes: ["R01", "R10", "R15"],
    isExemplar: false,
  },
  {
    lp: 21,
    recordId: "RM-2026-021",
    recipientIdType: "NIP",
    nip: "8590012007",
    recipientName: "Gmina Nowogard",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "32",
    voivodeship: "zachodniopomorskie",
    city: "Nowogard",
    projectName:
      "Zwiększenie odporności hydrologicznej Aglomeracji Nowogard poprzez rozdział kanalizacji sanitarnej na ul. 700-lecia",
    scope: "całe postępowanie",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2025/BZP 00364116/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation: "",
    subsector: "Kanalizacja sanitarna",
    additionalSubsector: "Kanalizacja deszczowa i retencja",
    workType: "Przebudowa/renowacja",
    fundingProgram: "FEnIKS / Fundusze Europejskie dla Pomorza Zachodniego",
    estimatedBudgetPln: 4_290_000,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning:
      "Dopasowanie 1:1 po numerze BZP 2025/BZP 00364116/01. Zamawiający wielokrotny: Gmina Nowogard (NIP 8590012007 – powiązany z RM-2026-020).",
    matchedNotices: [
      {
        noticeNumber: "2025/BZP 00364116/01",
        noticeType: "Ogłoszenie o zamówieniu",
        publicationDate: "2025-06-11",
        title: "Rozdział kanalizacji sanitarnej i deszczowej na ul. 700-lecia w Nowogardzie",
        contractValuePln: 4_290_000,
      },
    ],
    detectedEvents: [
      {
        eventType: "Roboty dodatkowe / zamienne",
        legalBasis: "Art. 455 ust. 1 pkt 3 Pzp",
        description: "Wykrycie niezinwentaryzowanych przyłączy ogólnospławnych w zwartej zabudowie miejskiej ul. 700-lecia.",
        mappedRiskCode: "R02",
      },
    ],
    missingDataAlerts: [],
    detectedRiskCodes: ["R02", "R03", "R07"],
    isExemplar: true,
  },
  {
    lp: 22,
    recordId: "RM-2026-022",
    recipientIdType: "NIP",
    nip: "9860164852",
    recipientName: "Gmina Wolin",
    recipientType: "Jednostka samorządu terytorialnego",
    country: "Polska",
    teryt: "32",
    voivodeship: "zachodniopomorskie",
    city: "Wolin",
    projectName: "Budowa sieci wodociągowych i kanalizacji sanitarnej w Gminie Wolin",
    scope: "całe postępowanie",
    publicIdType: "Ogłoszenie BZP",
    publicId: "2023/BZP 00110672/01",
    thematicArea: "Gospodarka wodno-ściekowa",
    orderType: "Roboty budowlane",
    legalRegime: "Ustawa Pzp – zamówienie krajowe",
    currency: "PLN",
    status: "Zakończone",
    source: "Rejestr publiczny",
    createdAt: "2026-11-20",
    version: "2.0",
    annotation: "",
    subsector: "Sieć wodociągowa",
    additionalSubsector: "Kanalizacja sanitarna",
    workType: "Budowa/rozbudowa",
    fundingProgram: "Rządowy Fundusz Polski Ład / Budżet JST",
    estimatedBudgetPln: 8_750_000,
    enrichmentStatus: "enriched",
    confidenceScore: 100,
    matchReasoning: "Dopasowanie 1:1 po numerze BZP 2023/BZP 00110672/01 oraz NIP 9860164852 (Gmina Wolin).",
    matchedNotices: [
      {
        noticeNumber: "2023/BZP 00110672/01",
        noticeType: "Ogłoszenie o zamówieniu",
        publicationDate: "2023-03-02",
        title: "Budowa sieci wodociągowych i kanalizacji sanitarnej w Gminie Wolin",
        contractValuePln: 8_750_000,
      },
    ],
    detectedEvents: [
      {
        eventType: "Zmiana terminu wykonania",
        legalBasis: "Art. 455 ust. 1 pkt 4 Pzp",
        description: "Nadzór archeologiczny oraz wysokie zwierciadło wód gruntowych w strefie nadmorskiej/zalewowej Gminy Wolin.",
        mappedRiskCode: "R04",
      },
    ],
    missingDataAlerts: [
      "Obszar o dużym natężeniu ruchu turystycznego: konieczność weryfikacji sezonowości poboru wody w okresie letnim (Rozdz. 2.3 Poradnika).",
    ],
    detectedRiskCodes: ["R02", "R04", "R14", "R15"],
    isExemplar: true,
  },
];

// Funkcja dobierająca podobne projekty z bazy referencyjnej MFiPR (RM-2026-001..022)
export function findSimilarMfiprProjects(
  targetSubsector: WodKanSubsector,
  targetWorkType: WodKanWorkType,
  limit = 4
): Array<{
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
}> {
  const scored = MFIPR_OFFICIAL_PROJECTS.map((proj) => {
    let score = 55;
    const reasons: string[] = [];

    if (proj.subsector === targetSubsector) {
      score += 28;
      reasons.push(`ten sam podsektor główny (${proj.subsector})`);
    } else if (proj.additionalSubsector === targetSubsector) {
      score += 18;
      reasons.push(`wspólny podsektor dodatkowy (${targetSubsector})`);
    }

    if (proj.workType === targetWorkType) {
      score += 12;
      reasons.push(`tożsamy rodzaj prac (${proj.workType})`);
    }

    if (proj.isExemplar) {
      score += 4;
      reasons.push("rekord wzorcowy MFiPR");
    }

    return {
      recordId: proj.recordId,
      projectName: proj.projectName,
      recipientName: proj.recipientName,
      voivodeship: proj.voivodeship,
      subsector: proj.subsector,
      workType: proj.workType,
      publicId: proj.publicId,
      similarityScore: Math.min(98, score),
      similarityExplanation:
        reasons.length > 0
          ? `Dopasowano na podstawie: ${reasons.join(", ")} (reżim: ${proj.legalRegime}).`
          : "Pokrewne przedsięwzięcie gospodarki wodno-ściekowej JST.",
      observedDelayRange:
        proj.workType === "Przebudowa/renowacja" ? "+45 do +110 dni" : "+30 do +90 dni",
      observedCostDeviationRange:
        proj.subsector === "Oczyszczalnia ścieków" ? "+8% do +19%" : "+5% do +14%",
    };
  });

  return scored
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
}
