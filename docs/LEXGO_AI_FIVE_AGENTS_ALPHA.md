# LEXGO AI — Five-agent Legal Writer Alpha

## Zakres wdrożenia (2026-11-22)
- 5 agentów: **Analityk akt → Researcher prawny → Strateg procesowy → Redaktor prawny → Kontroler jakości**.
- Każdy etap jest oddzielnym, wymagającym kliknięcia prawnika wywołaniem **OpenAI Responses API**.
- Utrwalanie wyników w `public.ai_draft_runs`, izolacja po `organization_id`, `case_id` i `created_by`; RLS selekcjonuje wyłącznie własne opracowania i dostępne sprawy.
- Wywołania modeli tylko w serwerowej Supabase Edge Function `lexgo-ai`. Nic nie wysyła się automatycznie z modułu Dokumenty. W formularzu wkleja się **wyłącznie fikcyjny** materiał testowy.
- Projekt pisma dostępny do skopiowania lub eksportu **TXT**. DOCX jest kolejnym etapem.
- Żadnego automatycznego składania pism do sądu, wysyłki mailowej, dostępu do przeglądarki czy przeszukiwania zewnętrznych baz.
- Obecny researcher jedynie wskazuje możliwe podstawy i źródła do weryfikacji. **Nie prowadzi jeszcze rzeczywistego researchu ELI, ISAP, SAOS, SN ani CBOSA**.

## Konfiguracja środowiska

Funkcja `lexgo-ai` i jej baza zostały wdrożone. **Wywołania modeli pozostają domyślnie zablokowane**. Nie przechowuj klucza API w GitHub, Vite, localStorage lub tabelach Supabase.

Aby uruchomić wywołania Premium API, administrator musi ręcznie ustawić **sekrety Edge Functions** w autoryzowanym projekcie Supabase:

- `LEXGO_OPENAI_API_KEY` — klucz API, wyłącznie w sekrecie po stronie serwera;
- `LEXGO_AI_ENABLE_EXTERNAL` — wartość `true`;
- `LEXGO_OPENAI_MODEL` — opcjonalnie `gpt-6.2-sol` (domyślnie) lub model z dostępem w koncie OpenAI.

W projekcie muszą być też obecne standardowe sekrety Supabase `SUPABASE_URL`, `SUPABASE_ANON_KEY` i `SUPABASE_SERVICE_ROLE_KEY`.
Nie wklejaj kluczy do czatu, repozytorium ani do kodu frontendu.

W konsoli LEXGO AI po włączeniu konfiguracji status powinien zmienić się z „Wymagana konfiguracja” na „Skonfigurowano”.

## Prywatność i tajemnica zawodowa
- **Wersja Alpha wyłącznie dla sztucznych kazusów**. Nie dopuszczać niezanonimizowanych pism ani rzeczywistych akt do czasu zatwierdzenia środków organizacyjnych i technicznych.
- `store:false` w Responses API ogranicza przechowywanie stanu odpowiedzi, **ale nie oznacza automatycznie Zero Data Retention**. ZDR wymaga potwierdzenia uprawnień/warunków właściwego konta API i zakresu modeli/funkcji.
- Polityka firmy musi objąć obowiązki z RODO, tajemnicę zawodową, DPIA gdy wymagana, DPA, region przetwarzania, retencję i kontrolę dostępu.
- Wpis `ai_draft_runs` przechowuje podany tekst scenariusza oraz wyniki etapów we własnej bazie Supabase. To NIE jest system bezretencyjny po stronie LEXGO. Docelowo potrzebne są eksport, usunięcie i retencja akt.
- Prawnik jest odpowiedzialny za sprawdzenie podstaw prawnych, orzeczeń, petitum i faktycznych danych oraz za zatwierdzenie pisma.
- Możliwy jest tryb Private z lokalnym modelem i bez wysyłki do OpenAI, ale **nie jest jeszcze wdrożony**.

## Testy i zabezpieczenia
- Klient nie ma SQL UPDATE/DELETE do tabeli `ai_draft_runs`. Backend po autoryzacji sesji sprawdza RLS i dopiero potem serwerowe wywołania.
- Jeden etap na raz; porównanie statusu i numeru etapu przy aktualizacji ogranicza ryzyko podwójnych kosztów.
- Na konto najwyżej 3 nowe opracowania AI na godzinę; wymaga wzmocnienia globalnym budżetem i limitem organizacji przed produkcją.
- Do API przesyłany jest tylko tekst podany w formularzu oraz wyniki wcześniejszych etapów, a nie cała zawartość sprawy czy Storage.
- Bez loggingu treści przesyłanych pism i odpowiedzi modeli z poziomu naszej funkcji.
- Test bazy pod rolą `authenticated`: autor widzi opracowanie, obcy użytkownik nie; bez możliwości modyfikowania wyników przez klienta. Testowe dane wycofano przez ROLLBACK.
- Test rzeczywistego OpenAI API i 5-etapowego procesu pozostaje wymagany po skonfigurowaniu wyżej wymienionych sekretów.
- W Supabase Free funkcja Edge ma ograniczenia czasu; wywołania są podzielone na osobne etapy.

## Kolejne etapy
1. Osobne narzędzie legal research z pobieraniem z oficjalnych serwisów i **weryfikowanymi linkami do źródeł**.
2. Bezpieczna ekstrakcja PDF/DOCX z akt w środowisku prywatnym; źródłowanie każdej tezy na karcie/stronie.
3. „Pisz jak moja kancelaria” — zatwierdzone szablony i styl pracy.
4. Generowanie strukturalnego DOCX, tabeli cytowań i załączników.
5. Sprawozdanie z audytu bezpieczeństwa, limity kosztów i retencja danych, tryb Private lokalny.

### Dokumentacja
- [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [OpenAI — data controls](https://developers.openai.com/api/docs/guides/your-data)
- [Supabase — Edge Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase — funkcje i RLS](https://supabase.com/docs/guides/functions/auth-legacy-jwt)
