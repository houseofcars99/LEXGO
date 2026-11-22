# LEXGO — Prywatne dokumenty spraw (Alpha)

**Status:** schema, prywatny bucket i polityki RLS zapisane w projekcie Supabase `owuniutwaqevwbzjcqls`. Testy bazy zakończone, test przeglądarkowy z rzeczywistym plikiem jeszcze wymagany.

## Funkcje i zakres
- Osoba mająca dostęp do sprawy może zapisać dla niej PDF lub DOCX do 5 MB.
- Przeglądanie listy oraz pobieranie dokumentów wymaga sesji Supabase i aktualnych uprawnień do sprawy.
- Bucket `lexgo-case-documents` ma `public=false`. Pliki nie dostają stałych publicznych adresów.
- Nazwa i dane pliku są przechowywane w tabeli `public.case_documents`. Ścieżka Storage jest generowana przez bazę jako `organization_id/case_id/document_id`.
- Po utworzeniu wpisu `pending`, przeglądarka przesyła plik przez Storage API. Następnie status zmienia się na `ready`. Pobieranie możliwe jest tylko dla statusu `ready`.
- Zablokowane są nadpisywanie, zmiana powiązania właścicielskiego oraz usuwanie plików przez użytkownika.

## Granice bezpieczeństwa
- **Wyłącznie fikcyjne pliki testowe.** Brak certyfikowanego skanowania antywirusowego, kontroli treści DOCX, szyfrowania kluczami zarządzanymi przez kancelarię, planu retencji i niezależnego backupu Storage.
- Ograniczenie MIME/rozmiaru po stronie Storage nie jest dowodem, że treść pliku jest bezpieczna. Nie otwieraj niezaufanych załączników.
- Nie wdrożono wersjonowania ani historii pobrań.
- Gdy upload lub finalizacja nie powiedzie się, w bazie może pozostać wpis `pending`. Nie usuwaj go ręcznie bez sprawdzenia rzeczywistych obiektów Storage.
- Repozytorium GitHub `houseofcars99/LEXGO` jest publiczne; kod nie może zawierać sekretów i danych klientów.

## Testy bazy wykonane
- `storage.buckets.public=false` i `file_size_limit=5242880`.
- RLS na `case_documents` i `storage.objects` aktywne, tylko polityki dla `authenticated`.
- Administrator może tworzyć i finalizować dokument; obcy użytkownik nie może odczytać ani zmienić metadanych.
- Próba zmiany organizacji lub sprawy w istniejącym dokumencie jest blokowana.
- Wszystkie testowe rekordy weryfikowano w transakcji zakończonej `ROLLBACK`; plików Storage nie tworzono.

## Odbiór w przeglądarce
1. Zaloguj się do [LEXGO](https://lexgo-ecru-nu.vercel.app/).
2. Otwórz **Dokumenty**, wybierz fikcyjną sprawę i wgraj mały **testowy** PDF, np. plik z jednym zdaniem.
3. Sprawdź, czy pojawi się pozycja na liście, a następnie pobierz ją i porównaj zawartość.
4. Odśwież stronę, przejdź do innej sprawy, wróć i sprawdź izolację list.
5. Sprawdź odrzucenie pliku `.exe`, zbyt dużego PDF i pliku z nieprawidłowym nagłówkiem `%PDF-`.
6. Z konta użytkownika bez dostępu do sprawy sprawdź, czy nie może pobrać obiektu po znanej ścieżce.
7. Z konta zwykłego członka sprawdź dostęp tylko do przydzielonych spraw.
8. Sprawdź reguły retencji, backup, historię audytową i zasady poufności przed przejściem do prawdziwych akt.

## Referencje
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase Storage Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase Storage Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
