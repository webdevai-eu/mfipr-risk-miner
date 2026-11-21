# RiskMiner AI – System Wczesnego Ostrzegania o Ryzykach Inwestycji Publicznych (Pilotaż: Gospodarka Wodno-Ściekowa)

Projekt opracowany dla **Ministerstwa Funduszy i Polityki Regionalnej (MFiPR)** w ramach zadania **RISK MINER** podczas maratonu programistycznego **HackNation 2026**.

Aplikacja stanowi zaawansowane narzędzie analityczne klasy Decision Support System (DSS) dla ekspertów MFiPR, Instytucji Pośredniczących oraz Jednostek Samorządu Terytorialnego realizujących inwestycje współfinansowane ze środków europejskich (**KPO Inwestycja B3.1.1**, **FEnIKS**, **PROW**). Zgodnie ze specyfikacją zadania pilotażowego system został wyspecjalizowany w obszarze **gospodarki wodno-ściekowej (wod-kan)** przy zachowaniu architektury gotowej do rozszerzenia na kolejne sektory infrastrukturalne.

---

## Dwie Główne Ścieżki Pracy (§3 i §6 Specyfikacji MFiPR)

### Ścieżka 1: Budowa Empirycznej Bazy Doświadczeń MFiPR (`Risk_Miner_dane_projekty.xlsx` + `bzp.cytr.us`)
1. **Obsługa oficjalnego zbioru 22 projektów referencyjnych (`RM-2026-001` do `RM-2026-022`):**
   - Bezpośredni import plików `.xlsx` oraz `.csv` w przeglądarce (biblioteka `xlsx`) lub jednoklikowe wczytanie oficjalnego arkusza `/data/Risk_Miner_dane_projekty.xlsx`.
   - Automatyczna klasyfikacja każdego projektu do jednego z **6 oficjalnych podsektorów wod-kan**:
     - `Sieć wodociągowa`
     - `Kanalizacja sanitarna`
     - `Oczyszczalnia ścieków`
     - `Uzdatnianie i zaopatrzenie w wodę`
     - `Kanalizacja deszczowa i retencja`
     - `Inne obiekty wod-kan`
   - Odrębne oznaczenie cechy **rodzaju prac**: `Budowa/rozbudowa` vs `Przebudowa/renowacja`.
2. **Integracja z otwartym lustrem ogłoszeń BZP (`https://bzp.cytr.us`):**
   - Endpoint `POST /api/enrich-project` odpytuje kopię BZP udostępnioną przez organizatora (bez limitu 30 zapytań/min platformy e-Zamówienia).
   - **Łączenie po identyfikatorach:**
     - Dokładne dopasowanie 1:1 po numerze ogłoszenia BZP (`14 rekordów`, pewność `100%`),
     - Dopasowanie heurystyczne po numerze NIP + kodzie TERYT + lokalizacji i słowach kluczowych przedmiotu zamówienia dla rekordów posiadających wyłącznie identyfikator KPO (`8 rekordów`, pewność `87–92%` z jawnym uzasadnieniem podstawy dopasowania).
   - **Wykrywanie powiązanych postępowań i zakresów częściowych:**
     - Identyfikacja zamawiających z wieloma projektami w bazie (**Gmina Czernikowo NIP `8792466869`** – `RM-2026-003` i `RM-2026-004`; **Gmina Nowogard NIP `8590012007`** – `RM-2026-020` i `RM-2026-021`).
     - Rozpoznawanie zamówień podzielonych na części (**Gmina Biecz `RM-2026-008` – `część 1`**; **Gmina Zakrzew `RM-2026-009` – `część 2`**) z ostrzeżeniem, że wartość projektu KPO nie jest tożsama z wartością pojedynczej umowy wykonawczej.
   - **Ekstrakcja zdarzeń z ogłoszeń o zmianie i wykonaniu umowy:** identyfikacja zmian terminu, zmian wynagrodzenia (`art. 455 ust. 1 pkt 1–4` oraz `art. 455 ust. 2 Pzp`, waloryzacja `art. 439 Pzp`) i mapowanie ich na katalog ryzyk `R01–R15`.

### Ścieżka 2: Analiza Nowej Inwestycji Wod-Kan, Katalog `R01–R15` i Benchmark Sektorowy
1. **Oficjalny Katalog 15 Kategorii Ryzyk MFiPR (`R01–R15`):**
   - `R01` Niepełny lub niespójny zakres
   - `R02` Niedostateczne rozpoznanie stanu istniejącego
   - `R03` Kolizje, dostęp do terenu i prawa do nieruchomości
   - `R04` Decyzje, pozwolenia i uzgodnienia zależne od podmiotów trzecich
   - `R05` Niejasny lub nieadekwatny podział odpowiedzialności
   - `R06` Nierealistyczny harmonogram i nieuwzględnione zależności
   - `R07` Nieprzewidziane zmiany i roboty dodatkowe
   - `R08` Model wynagrodzenia niedopasowany do niepewności zakresu
   - `R09` Niejednoznaczne lub niemierzalne wymagania techniczne
   - `R10` Niedookreślone próby, rozruch i odbiór
   - `R11` Postępowanie podatne na odwołanie lub ograniczenie konkurencji
   - `R12` Niewystarczająca zdolność wykonawcy lub łańcucha dostaw
   - `R13` Ryzyko finansowania, budżetu i płatności
   - `R14` Nadmierne koszty eksploatacji i utrzymania
   - `R15` Nieosiągnięcie efektu technologicznego, użytkowego lub środowiskowego
2. **Dobór Grupy Porównawczej (Benchmark z 22 projektów MFiPR):**
   - Automatyczne wskazanie 4 najbardziej zbliżonych inwestycji z bazy referencyjnej wraz z wyjaśnieniem podobieństwa, wielkością próby (`n = 22`) oraz prognozowanym przedziałem odchylenia czasu i kosztu.
3. **Zasada Strict Grounding, Diagnostyka Braków i Klauzule PPU/SWZ:**
   - Każde ryzyko zawiera dosłowny cytat ze źródła (`sourceCitation`), podstawę prawną (`legalBasis`), poziom pewności (`confidenceLevel`) oraz **proponowany zapis umowny do PPU / SWZ (`contractClauseSuggestion`)**.
   - Moduł diagnostyki dokumentacji rozróżnia *„Brak pliku w przekazanej paczce”* od *„Brak działania”* oraz wykorzystuje **PPU/SWU jako warunkowy substytut podpisanej umowy** (*„warunki kontraktowe odtworzone; brak podpisanego egzemplarza umowy”*).
4. **Weryfikacja Human-in-the-Loop (AI Act) i 8-Punktowa Checklista Wodociągowa:**
   - Ekspert może zatwierdzać lub odrzucać ryzyka (`False Positive`), co w czasie rzeczywistym przelicza 4 Karty KPI oraz Symulator Scenariuszy „What-If”.
   - Wbudowana interaktywna **8-punktowa Zbiorcza Checklista Przygotowania Inwestycji Wodociągowej** oparta na poradniku eksperckim MFiPR.
5. **Wieloformatowy Eksport Danych (§5 Wymagań Technicznych):**
   - Eksport raportu zarządczego `.txt`, ustrukturyzowanych rekordów `.json` oraz tabeli `.csv`.

---

## Uruchomienie Lokalne i Konfiguracja

1. Sklonuj repozytorium i zainstaluj zależności:
   ```bash
   npm install
   ```
2. Skopiuj plik `.env.example` do `.env.local` i uzupełnij klucz `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env.local
   ```
3. Uruchom serwer deweloperski:
   ```bash
   npm run dev
   ```

---

## Wykorzystane zasoby i boilerplate (Deklaracja wg pkt 11 FAQ HackNation)

Zgodnie z wymogami regulaminu HackNation 2026 (pkt 11 FAQ), zespół deklaruje wykorzystanie:
1. Autorskiego, publicznie dostępnego szablonu startowego Next.js / Headless PWA agencji WebDevAI (`webdevai-core-stack`),
2. Standardowych komponentów UI (`shadcn/ui`, `lucide-react`, `xlsx`),
3. Oficjalnych pakietów SDK Google AI (`@google/generative-ai`),
4. Wszystkie moduły dziedzinowe MFiPR (parsowanie 22 rekordów `Risk_Miner_dane_projekty.xlsx`, integracja z kopią `https://bzp.cytr.us`, taksonomia 6 podsektorów wod-kan, katalog ryzyk `R01–R15`, 8-punktowa checklista wodociągowa, algorytm doboru grupy porównawczej oraz symulator What-If) zostały zaimplementowane w trakcie trwania HackNation 2026.

---

## Licencja

Oprogramowanie udostępnione na otwartej licencji **MIT** (zgodnie z §4 ust. 4 Regulaminu Zadania Konkursowego MFiPR). Szczegóły w pliku [LICENSE](LICENSE).  
Autor: **Marcin Włoszek / WebDevAI (webdevai.eu)** © 2026.
