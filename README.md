# RiskMiner AI – System Wczesnego Ostrzegania o Ryzykach Inwestycji Publicznych

Projekt opracowany dla **Ministerstwa Funduszy i Polityki Regionalnej (MFiPR)** w ramach zadania **RISK MINER** na maratonie programistycznym **HackNation 2026**.

Aplikacja jest nowoczesnym, bezpiecznym systemem klasy GovTech Decision Support System (DSS), zaprojektowanym z myślą o kadrze zarządzającej MFiPR, komitetach sterujących, Inżynierach Kontraktu oraz Instytucjach Pośredniczących (np. CUPT). Umożliwia proaktywne wykrywanie, kwantyfikację i mitygację ryzyk formalno-prawnych, finansowych, harmonogramowych i technicznych w projektach współfinansowanych z programów **FEnIKS** oraz **KPO**.

---

## Główne Funkcjonalności Systemu

1. **Oficjalny Design System Gov.pl (MFiPR):**
   - Interfejs w 100% dostosowany do standardu wizualnego portalu `gov.pl/web/fundusze-regiony`.
   - Oficjalny znak gov.pl, ministerialna paleta barw (rządowa czerwień `#D52B1E`, granat instytucjonalny `#002D62`, tło `#F4F5F7`), pasek okruszków (breadcrumbs) oraz pełny tryb Dark Mode.
   - Wyłącznie minimalistyczne, jednolite ikony wektorowe SVG (`lucide-react`, grubość `strokeWidth=1.75`) – zero emotikonów i elementów nieoficjalnych.

2. **Multimodalna Analiza Dokumentacji (Gemini 2.5 Flash):**
   - Bezpośrednia ingestia dokumentacji w formatach PDF (multimodalny odczyt binarnego PDF), CSV (dane tabelaryczne) oraz TXT (protokoły, SWZ, Harmonogramy Rzeczowo-Finansowe).
   - Wbudowany moduł podyktowania notatki z rady budowy za pomocą `Web Speech API` (język polski `pl-PL`, ciągły nasłuch z auto-stopem po ciszy).

3. **Zasada Strict Grounding (Eliminacja Halucynacji AI):**
   - Każde zidentyfikowane ryzyko posiada obowiązkowy, dosłowny cytat z dokumentu źródłowego (`sourceCitation`).
   - Przypisana konkretna podstawa prawna (`legalBasis`) z ustawy Prawo zamówień publicznych (Pzp), warunków FIDIC, specustawy drogowej (ZRID) lub wytycznych kwalifikowalności funduszy unijnych 2021–2027.

4. **Weryfikacja Human-in-the-Loop (Zgodność z AI Act):**
   - Statusy weryfikacji eksperckiej: `pending`, `approved`, `rejected`.
   - Możliwość natychmiastowego zatwierdzenia ryzyka do oficjalnego rejestru lub odrzucenia jako False Positive.
   - Odrzucenie ryzyka automatycznie wyklucza je w czasie rzeczywistym z wyliczeń 4 Kart KPI oraz Symulatora Scenariuszy „What-If”.

5. **RODO Shield (Edge Privacy-by-Design):**
   - Lokalny filtr działający w pamięci przeglądarki użytkownika przed przesłaniem danych do modelu AI.
   - Automatyczna anonimizacja numerów PESEL, NIP oraz danych osobowych kierowników kontraktów i nazw wykonawców.

6. **Interaktywna Macierz Ryzyka 5×5 i Symulator Scenariuszy „What-If”:**
   - Siatka Prawdopodobieństwo × Wpływ filtrująca rejestr ryzyk jednym kliknięciem.
   - Dwa dynamiczne suwaki: badanie opóźnień procedur KIO/ZRID (0–120 dni) oraz presji waloryzacji cen robót (0–25%) z ostrzeżeniem o przekroczeniu granicznego terminu rozliczenia perspektywy unijnej (31.12.2029).

7. **Eksport Karty Ryzyka dla Komitetu Sterującego (.txt):**
   - Generowanie sformatowanego raportu zawierającego metrykę projektu, wskaźniki KPI, dowody źródłowe oraz rekomendacje naprawcze.

---

## Architektura i Stack Technologiczny

- **Framework:** Next.js (App Router), React 19, TypeScript (`strict: true`)
- **Styling:** Tailwind CSS, tokeny semantyczne MFiPR gov.pl
- **Silnik AI:** Google Gemini 2.5 Flash / Interactions API (REST + SDK fallback)
- **Dostępność i Prywatność:** WCAG 2.1 Poziom AA, RODO Local Shield
- **PWA:** Gotowość do instalacji pulpitowej i pracy offline (`app/manifest.ts`)

---

## Wykorzystane zasoby i boilerplate (Deklaracja wg pkt 11 FAQ HackNation)

Zgodnie z wymogami pkt 11 FAQ regulaminu HackNation 2026, zespół oświadcza, że w projekcie wykorzystano:
1. Autorski, publicznie dostępny szablon startowy Next.js / Headless PWA agencji WebDevAI (`webdevai-core-stack`),
2. Standardowe komponenty interfejsu użytkownika oparte o shadcn/ui oraz Base UI primitives,
3. Oficjalne biblioteki ekosystemu Google AI (`@google/generative-ai`),
4. Wszystkie specyficzne ministerialne reguły biznesowe, system prompt MFiPR, algorytm Strict Grounding, moduł Human-in-the-Loop, kalkulator ścieżki krytycznej FEnIKS oraz moduł RODO Shield zostały zaimplementowane w trakcie trwania maratonu HackNation 2026.

---

## Licencja

Projekt udostępniony na licencji **MIT**. Szczegóły w pliku [LICENSE](LICENSE).  
Autor: **Marcin Włoszek / WebDevAI (webdevai.eu)** © 2026.
