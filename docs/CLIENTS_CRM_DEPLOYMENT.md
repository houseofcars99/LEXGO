# LEXGO — moduł klientów CRM

Status: kod interfejsu i skrypt SQL przygotowane, **niepotwierdzone w istniejącej bazie Supabase**.

## Funkcje
- Administrator kancelarii może utworzyć i edytować kartotekę klienta (osoba lub firma).
- Wyszukiwanie po nazwie, adresie e-mail, telefonie i NIP / identyfikatorze.
- Sprawy mogą opcjonalnie wskazywać klienta z kartoteki, zachowując `client_name` dla zgodności ze starszymi sprawami.
- Przenoszenie starszych nazw do nowych kartotek nie odbywa się automatycznie.
- Członkowie niebędący administratorami widzą wyłącznie nazwy klientów ze spraw, do których mają dostęp.
- Brak funkcji kasowania kartoteki.

## Wdrożenie w Supabase
**Nie uruchamiaj na bazie produkcyjnej bez uprawnień, kopii i audytu.**

1. Sprawdź w swoim panelu Supabase, który projekt jest połączony z LEXGO. W konfiguracji projektu Vercel musi wskazywać właściwy `VITE_SUPABASE_URL`; nie przesyłaj żadnych sekretów.
2. Wykonaj kopię zapasową i porównaj aktualną strukturę tabel `organizations`, `memberships` oraz `cases`.
3. Zweryfikuj skrypt `supabase/sql/clients_crm.sql` pod kątem istniejących danych i ról.
4. Włącz zmianę za pomocą migracji utworzonej poleceniem `supabase migration new clients_crm` albo wykonaj sprawdzony skrypt z autoryzowanego panelu SQL Editor (najpierw środowisko testowe).
5. Sprawdź RLS: Administrator A widzi i modyfikuje klientów wyłącznie kancelarii A; Administrator B nie widzi danych A. Użytkownik bez roli administratora nie może wyświetlać pól kontaktowych poprzez Data API.
6. Sprawdź przypisanie sprawy do klienta innej kancelarii: baza musi odmówić dzięki złożonemu kluczowi obcemu.
7. Sprawdź, czy dawne sprawy nadal działają bez `client_id`, a nowo tworzone sprawy potrafią wiązać klienta z kartoteki.
8. Nie wprowadzaj rzeczywistych danych klientów przed niezależnym audytem bezpieczeństwa i ustaleniem zasad przetwarzania danych.

## Zgodność wsteczna
Przed wykonaniem skryptu moduł `Klienci` pokazuje nazwy już zapisane w sprawach i opis brakującej migracji. Nie próbuje wysyłać danych do nieistniejącej tabeli. Reszta aplikacji ma nadal działać.

## Ograniczenia
Bieżąca implementacja nie zawiera automatycznego importu danych, historii edycji klientów, eksportu, załączników ani uprawnień członka kancelarii do pełnych kartotek. To planowane kolejne etapy.
