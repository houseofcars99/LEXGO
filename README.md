# LEXGO

Pierwszy etap systemu dla kancelarii: oddzielne przestrzenie kancelarii, sprawy, zadania i terminy do zatwierdzenia.

## Uruchomienie

1. Utwórz osobny projekt Supabase i uruchom `supabase/schema.sql` w SQL Editor.
2. Skopiuj `.env.example` do `.env` i wpisz adres projektu oraz klucz publikowalny (`anon`/publishable). Nigdy nie umieszczaj klucza `service_role` w aplikacji lub repozytorium.
3. `npm install`, następnie `npm run dev`.
4. Załóż konto przez formularz, potwierdź e-mail, jeśli projekt tego wymaga, i utwórz kancelarię.

Na Vercel ustaw `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY`. Migrację bazy uruchom przed pierwszym logowaniem.

## Terminy

Termin jest zapisany razem z datą doręczenia, podstawą, fragmentem źródła, autorem i statusem weryfikacji. Obecny etap **nie ustala terminu automatycznie na podstawie AI ani przepisów**. Dopóki ten moduł nie zostanie zbudowany i sprawdzony, prawnik wprowadza datę ręcznie. Zatwierdzenie i korekta są odnotowywane. Terminy procesowe pozostają oddzielne od wewnętrznych dat wykonania zadań.

## Bezpieczeństwo

Każda tabela danych kancelarii ma RLS. Dostęp wymaga członkostwa w kancelarii, a dostęp do spraw i zadań zależy od przydziału lub roli administratora. To podstawa prototypu, wymagająca audytu bezpieczeństwa przed użyciem rzeczywistych akt klientów. Nie umieszczaj prawdziwych danych w tym etapie.
