# LEXGO — plan powiadomień

## Aktualny stan
Kalendarz oraz podgląd przypomnień działają po stronie aplikacji po odczycie uprawnionych spraw z Supabase. Nie są to jeszcze trwałe powiadomienia ani automatyczne wysyłki w tle.

## Kolejny etap — backend
1. Migracja Supabase: notification_preferences, notifications, push_subscriptions i reminder_deliveries. Wszystkie rekordy z organization_id; polityki RLS i testy izolacji kancelarii. Preferencje per użytkownik/kanał i progi 14/7/3/1/0 dni.
2. Harmonogram serwerowy (Supabase scheduled function / cron) w strefie Europe/Warsaw. Generowanie zdarzeń tylko dla uprawnionych adresatów. Unikalny klucz (recipient, entity type, entity id, due date, offset, channel) oraz statusy queued/sent/failed.
3. Zmiana daty lub zamknięcie zadania unieważnia stare przypomnienia. Terminy procesowe bez potwierdzenia powinny być oznaczone jako wymagające weryfikacji.
4. E-mail przez dostawcę transakcyjnego z kluczem przechowywanym tylko po stronie serwera. Bez nazw klientów, sygnatur i treści spraw w temacie i powiadomieniu na ekranie blokady.
5. Web Push: service worker, VAPID, jawna zgoda, rejestracja/wycofanie subskrypcji, obsługa nieaktywnych tokenów. Zależne od systemu, przeglądarki i uprawnień.
6. Dziennik prób, retry z ograniczeniem, monitoring błędów i testy doręczeń. Powiadomienia nie są gwarancją dochowania terminów.

## Przed publikacją
- Zweryfikować migracje w środowisku testowym i przetestować RLS dla dwóch kancelarii.
- Skonfigurować dostawcę e-mail, domenę wysyłkową, VAPID i cron.
- Uruchomić testy build i e2e, a następnie osobno wdrożyć na Vercel.
- Wykonać audyt bezpieczeństwa danych kancelarii.
