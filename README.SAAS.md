# LEXGO SaaS — Alpha (nowy interfejs)

To repozytorium zawiera poprzednią implementację i nową wersję interfejsu SaaS na gałęzi `feat/lexgo-saas-rebuild`.

## Co jest implementowane
- Logowanie i rejestracja Supabase Auth (tylko przy poprawnej konfiguracji);
- Wybór kancelarii oraz kontrola uprawnień za pomocą już istniejącej bazy i RLS;
- Pulpit, rejestr spraw i klientów wynikających ze spraw;
- Zadania: dodawanie i oznaczanie jako wykonane;
- Terminy: wprowadzenie i zatwierdzanie przez prawnika;
- Strony informacyjne dla dokumentów, AI, rozliczeń, KSeF i Portalu Informacyjnego.

## Czego nie ma
- Integracji produkcyjnej z KSeF, Portalem Informacyjnym i zewnętrznym modelem AI;
- Przechowywania i wyszukiwania akt; realnego rejestru klientów niezależnego od spraw;
- Oceny bezpieczeństwa produkcyjnego, niezależnego audytu RLS i testów end-to-end.

**NIE WPROWADZAĆ RZECZYWISTYCH DANYCH KLIENTÓW.**

## Wymagania i uruchomienie
Node.js 20+, `npm ci`, `npm run dev` lub `npm run build`.
Konfiguracja (wartości publiczne, nigdy service_role):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Dotychczasowe pliki schematu SQL pozostają w `supabase/`.
Nie należy ponownie wykonywać `supabase/schema.sql` na istniejącej bazie.
Konieczne są osobne instancje produkcyjne i testowe, kopie zapasowe oraz audyt izolacji tenantów.

## Bezpieczne przejście
1. Zachować branch `feat/calendar-notifications` jako wersję poprzednią.
2. Uruchomić build w CI na gałęzi nowej wersji.
3. Sprawdzić na dwóch fikcyjnych kancelariach brak dostępu między tenantami.
4. Dopiero po przeglądzie wyniku zintegrować zmianę z `main`.

Nowy interfejs uruchamia `/src/saasEntry.jsx`. Stary kod `/src/main.jsx` pozostawiono na czas migracji i porównania.
