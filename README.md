# RiskMiner AI – System Wczesnego Ostrzegania o Ryzykach Inwestycji Publicznych

Projekt przygotowany w ramach wyzwania **RISK MINER** dla **Ministerstwa Funduszy i Polityki Regionalnej (MFiPR)** podczas **HackNation 2026**.

Platforma GovTech wspiera komitety sterujące, inżynierów kontraktu oraz instytucje pośredniczące (np. CUPT) w proaktywnym wykrywaniu, kwantyfikacji i mitygacji ryzyk formalno-prawnych, finansowych, harmonogramowych i technicznych w inwestycjach współfinansowanych z programów FEnIKS oraz KPO.

---

## 🚀 Główne Funkcje Systemu

1. **Multimodalna Analiza Dokumentacji Przetargowej i Budowlanej (Gemini 2.5 Flash):**
   - Bezpośrednia ingestia dokumentów PDF (SWZ, Harmonogramy Rzeczowo-Finansowe, opinie środowiskowe) w formacie binarnym/multimodalnym.
   - Parsowanie danych tabelarycznych CSV oraz opisów tekstowych i notatek z rad budowy.
   - Wbudowana notatka głosowa przez `Web Speech API` (język polski, automatyczne zatrzymanie po ciszy).

2. **RODO Shield (Edge Privacy-by-Design):**
   - Lokalny filtr działający w pamięci przeglądarki przed wysłaniem danych do modelu AI.
   - Anonimizacja numerów PESEL, NIP oraz danych osobowych kierowników kontraktów i wykonawców.

3. **Interaktywna Macierz Ryzyka 5×5 (Prawdopodobieństwo × Wpływ):**
   - Wizualna siatka kategoryzacji ryzyk (Niskie, Średnie, Wysokie, Krytyczne).
   - Dynamiczne filtrowanie listy szczegółowych kart ryzyk i planów naprawczych.

4. **Symulator Scenariuszy „What-If” (Real-time Sensitivity Analysis):**
   - Suwaki badania wrażliwości: opóźnienia procedur odwoławczych KIO / ZRID (0–120 dni) oraz presji waloryzacyjnej i cen materiałów (0–25%).
   - Natychmiastowe przeliczanie nowej daty zakończenia inwestycji oraz prognozy przekroczenia ostatecznego terminu kwalifikowalności wydatków unijnych.

5. **Karta Ryzyka dla Komitetu Sterującego (.txt):**
   - Generowanie i eksport gotowych do podpisu zestawień ryzyk i rekomendacji zarządczych.

---

## 🛠️ Architektura i Stack Technologiczny

- **Framework:** Next.js (App Router), React 19, TypeScript (`strict: true`)
- **Styling & UI:** Tailwind CSS, Lucide Icons, GovTech design system z pełnym Dark Mode
- **Silnik AI:** Google Gemini 2.5 Flash (obsługa standardowych kluczy AI Studio oraz Vertex AI Express)
- **Standard Dostępności:** Zgodność z wytycznymi WCAG 2.1 AA
- **PWA:** Gotowość do pracy w trybie offline i instalacji jako aplikacja pulpitowa/mobilna

---

## 📋 Wykorzystane zasoby i boilerplate (Deklaracja wg pkt 11 FAQ HackNation)

Zgodnie z regulaminem HackNation 2026 (pkt 11 FAQ), zespół deklaruje wykorzystanie:
- Autorskiego, publicznie dostępnego szablonu startowego Next.js / PWA agencji WebDevAI (`webdevai-core-stack`),
- Standardowych komponentów interfejsu użytkownika (shadcn/ui / Base UI primitives),
- Oficjalnych bibliotek ekosystemu Google AI (`@google/generative-ai`),
- Wszystkie reguły biznesowe, system prompt MFiPR, silnik analityczny macierzy 5×5, moduł RODO Shield oraz symulator scenariuszy What-If zostały zaimplementowane w trakcie trwania maratonu.

---

## 📄 Licencja

Projekt udostępniony na licencji **MIT**. Szczegóły w pliku [LICENSE](LICENSE).  
Autor: **Marcin Włoszek / WebDevAI (webdevai.eu)** © 2026.
