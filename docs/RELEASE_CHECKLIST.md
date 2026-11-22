# LEXGO — uruchomienie i odbiór wersji testowej

## Co jest jeszcze niepotwierdzone
Build READY na Vercel NIE dowodzi poprawności logowania, RLS ani migracji. Nie używaj danych klientów, dopóki wszystkie testy nie przejdą.

## 1. Supabase
W panelu Supabase wybierz właściwy, **dedykowany projekt LEXGO**. Przed zmianami sprawdź, czy istnieją już tabele i migracje. Wykonaj kopię zapasową i nie uruchamiaj ponownie pliku bazowego `supabase/schema.sql` na istniejącym schemacie (używa CREATE TABLE bez IF NOT EXISTS).

Jeśli baza jest nowa: uruchom jednorazowo `supabase/schema.sql`.
Potem wykonaj kolejno:
1. `supabase/migrations/20261025_fee_registry.sql`
2. `supabase/migrations/20261025_payment_integrity.sql`
3. `supabase/migrations/20261025_billing_drafts.sql`

Jeśli baza jest już używana, porównaj istniejący schemat z migracjami przed uruchomieniem; nie wykonuj ich w ciemno.
Na koniec uruchom `supabase/verification.sql`. Sprawdź komplet tabel, RLS, polityki i triggery. Nie traktuj obecności tabel jako pełnego audytu.

## 2. Vercel
W projekcie LEXGO ustaw Vite, komendę `npm run build`, output `dist`. Sprawdź wartości **publicznego** URL i publishable/anon key w Supabase Project Settings > API, następnie konfigurację `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY` dla Preview i Production w Vercel > Settings > Environment Variables. Nigdy nie używaj service_role/secret key po stronie przeglądarki. Po zmianie zmiennych zbuduj aplikację ponownie. Ustaw w Supabase Auth > URL Configuration właściwy Site URL oraz dozwolone adresy przekierowań dla domeny aplikacji.

## 3. Testy kontami testowymi — nie używać prawdziwych danych
1. Zarejestruj dwóch niezależnych użytkowników, potwierdź e-mail i zaloguj się.
2. Użytkownik A tworzy kancelarię A oraz sprawę, zadanie i termin; weryfikuje korektę terminu.
3. Użytkownik B tworzy kancelarię B. Nie może odczytać danych kancelarii A przez API, także znając UUID jej rekordu.
4. Użytkownik A zapisuje wynagrodzenie 1000 zł, wpłatę 400 zł; panel ma wskazywać saldo 600 zł.
5. Spróbuj zapisać wpłatę 601 zł, również równolegle z inną wpłatą. Baza ma odmówić nadpłaty.
6. Administrator zapisuje szkic dokumentu; zwykły członek nie może go odczytać ani dodać przez API.
7. Wyloguj/zaloguj, odśwież podstrony, sprawdź stronę pod mobilną szerokością, błędy 404 i komunikaty sieciowe.
8. Sprawdź błędy konsoli, logi produkcyjne, retencję kopii zapasowych i test odtworzenia.

## 4. Kryteria go-live
- Wszystkie testy przechodzą.
- Audyt RLS (także RPC security-definer, bez możliwości wywołania poza uprawnieniami).
- Procedury usuwania/eksportu danych, uprawnienia zespołów, polityka prywatności i backup.
- Pełny cykl fakturowania/KSeF zgodny z aktualnymi wymogami, zanim dodamy przycisk „Wystaw fakturę”.
- Promocja na production dopiero po zatwierdzeniu wyniku testów.

## Status
To jest runbook i checklista, a nie potwierdzenie wykonania migracji czy testów produkcyjnych.
