# LEXGO

Pierwszy etap systemu dla kancelarii: oddzielne przestrzenie kancelarii, sprawy, zadania i terminy do zatwierdzenia.

## Uruchomienie

1. W osobnym projekcie Supabase LEXGO (`owuniutwaqevwbzjcqls`) uruchom `supabase/schema.sql` w SQL Editor. Wykonaj to tylko raz w pustym projekcie.
2. Skopiuj `.env.example` do `.env` i wpisz klucz publikowalny (`anon`/publishable). Adres projektu jest już uzupełniony. Nigdy nie umieszczaj klucza `service_role` w aplikacji lub repozytorium.
3. `npm install`, następnie `npm run dev`.
4. Załóż konto przez formularz, potwierdź e-mail, jeśli projekt tego wymaga, i utwórz kancelarię.

Migrację bazy uruchom przed pierwszym logowaniem.
Przy standardowym buildzie produkcyjnym Vite odczytuje też `.env.production`, które zawiera tylko adres projektu i klucz **publikowalny**. Są to wartości widoczne w aplikacji przeglądarkowej. Kluczy `secret` i `service_role` nie wolno tam umieszczać.

## Terminy

Termin jest zapisany razem z datą doręczenia, podstawą, fragmentem źródła, autorem i statusem weryfikacji. Obecny etap **nie ustala terminu automatycznie na podstawie AI ani przepisów**. Dopóki ten moduł nie zostanie zbudowany i sprawdzony, prawnik wprowadza datę ręcznie. Zatwierdzenie i korekta są odnotowywane. Terminy procesowe pozostają oddzielne od wewnętrznych dat wykonania zadań.

## Bezpieczeństwo

Każda tabela danych kancelarii ma RLS. Dostęp wymaga członkostwa w kancelarii, a dostęp do spraw i zadań zależy od przydziału lub roli administratora. To podstawa prototypu, wymagająca audytu bezpieczeństwa przed użyciem rzeczywistych akt klientów. Nie umieszczaj prawdziwych danych w tym etapie.
