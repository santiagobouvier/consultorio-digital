#!/usr/bin/env bash
# Pruebas de base de datos de planes manuales (CD-005).
#
# Requiere un Postgres DESECHABLE (local o de CI), nunca producción.
# Usa las variables estándar PGHOST / PGPORT / PGUSER (con permiso para crear
# bases y roles). Crea una base temporal, aplica el esquema mínimo, aplica la
# migración DOS veces (idempotencia), corre las pruebas y borra la base.
set -euo pipefail

case "${PGHOST:-}" in
  *supabase.co*|*supabase.com*|*lovable*)
    echo "Negado: PGHOST apunta a un servidor real (${PGHOST}). Usá un Postgres desechable." >&2
    exit 1;;
esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="cd_tests_planes_$$"
MIGRATION="$ROOT/supabase/migrations/20261003120000_planes_gestion_manual.sql"

createdb "$DB"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")
"${PSQL[@]}" -f "$ROOT/tests/db/stub_supabase.sql"
"${PSQL[@]}" -f "$MIGRATION"
"${PSQL[@]}" -f "$MIGRATION"
"${PSQL[@]}" -f "$ROOT/tests/db/planes_manuales_test.sql"
