# LEXGO – audyt uprawnień i migracja CRM – 22.11.2026

## Zakres
Projekt Supabase: `owuniutwaqevwbzjcqls` (region eu-west-2). Prace wykonano z kontem połączonym jako Kancelariamp.
Migracje wdrożono do istniejącego projektu; nie usuwano danych kancelarii.

## Punkt odtworzenia
Schemat `lexgo_backup_20261122_pre_crm` zawiera kopie siedmiu tabel, definicje funkcji, polityk RLS i uprawnień.
Stan pierwotny: 1 organizacja, 1 członkostwo, 3 sprawy, 1 zadanie.
To kopia w tej samej bazie, NIE zastępuje niezależnego backupu, PITR ani testu odtworzenia.

## Wykonane migracje
1. `20261122214543_lexgo_pre_crm_local_snapshot_20261122`: wewnętrzny punkt odtworzenia.
2. `20261122214609_lexgo_harden_data_api_roles_and_membership_20261122`: REVOKE uprawnień roli anon do tabel i RPC, kontrola tożsamości w funkcjach.
3. `20261122214618_lexgo_clients_crm_table_and_case_links_20261122`: tabela clients z RLS i powiązanie klienta ze sprawą za pomocą złożonego FK.
4. `20261122214722_lexgo_restrict_clients_trigger_function_20261122`: odebranie wywołania funkcji triggera poza jej mechanizmem.
5. `20261122214900_lexgo_case_access_use_fresh_snapshot_for_insert_returning_20261122`: przejściowa modyfikacja oznaczenia funkcji (następnie cofnięta).
6. `20261122214933_lexgo_case_insert_returning_admin_rls_policy_20261122`: poprawka polityki odczytu spraw, żeby tworzenie spraw działało z INSERT ... RETURNING.

## Wyniki testów PostgreSQL
- Wszystkie 8 tabel public ma aktywne RLS; anon nie ma SELECT do żadnej.
- Brak EXECUTE do RPC uprzywilejowanych dla anon, sprawdzono na publicznym schemacie.
- Administrator: dodanie/edycja/odczyt klienta, utworzenie powiązanej sprawy, zadania i terminu – PASS.
- Osoba niebędąca członkiem: brak odczytu i zapisu klientów oraz spraw – PASS.
- Zwykły członek kancelarii: widzi jedną przydzieloną sprawę, bez pełnej kartoteki; brak edycji kartoteki – PASS.
- Złożony FK blokuje klienta z innej organizacji – PASS.
- Triggery zadania i historia zmian terminu – PASS.
- Testowe rekordy wykonywano w transakcjach zakończonych ROLLBACK. Po testach: 1 organizacja, 3 sprawy, 1 zadanie, 0 klientów.

Uwaga: są to testy SQL z rolą authenticated i symulowanym claim JWT, nie testy przeglądarkowe ani pełny pentest.

## Pozostałe ostrzeżenia z Supabase Security Advisor
- `pg_graphql_authenticated_table_exposed` – 8 tabel ma uprawnienia SELECT dla authenticated, konieczne dla Data API; RLS ogranicza wiersze. Należy przeanalizować potrzebę GraphQL lub wyłączyć rozszerzenie/usługę, jeżeli niewykorzystywana.
- `authenticated_security_definer_function_executable` – 4 funkcje SECURITY DEFINER dostępne authenticated i używane przez RLS lub RPC create_organization. Ich ryzyko wymaga dalszej oceny; nie należy bezrefleksyjnie odbierać uprawnień, bo złamie to aplikację.
- `auth_leaked_password_protection` – funkcja ochrony przed wyciekłymi hasłami jest wyłączona i wymaga konfiguracji w Auth.

## Kolejne kroki – kryteria odbioru
1. Dwie prawdziwe sesje Supabase Auth – osobni użytkownicy, osobne kancelarie, test 403/0 rekordów dla cudzego UUID i update.
2. W aplikacji: klient → edycja → nowa sprawa powiązana z klientem → odświeżenie → dane pozostają.
3. Osobny SMTP do potwierdzeń e-mail oraz poprawny Site URL / Redirect URLs; nie wyłączać wymogu potwierdzania.
4. Niezależna kopia i odtwarzanie, MFA, audyt RLS, procedura eksportu i usuwania danych przed produkcją.
5. Nigdy nie umieszczać prawdziwych danych klientów ani sekretów w publicznym repozytorium.
