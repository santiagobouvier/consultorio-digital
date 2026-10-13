#!/usr/bin/env bash
# Pruebas de base de datos sobre un Postgres DESECHABLE (local o de CI), nunca
# producción. Usa PGHOST / PGPORT / PGUSER (con permiso para crear bases y roles).
#
# Por cada tests/db/*_test.sql: crea una base temporal, aplica
# stub_supabase.sql, el esquema extra <nombre>_pre.sql si existe, las
# migraciones que el test declara en su línea "-- migraciones: …" (DOS veces,
# para probar idempotencia), corre el test y borra la base.
set -euo pipefail

case "${PGHOST:-}" in
  *supabase.co*|*supabase.com*|*lovable*)
    echo "Negado: PGHOST apunta a un servidor real (${PGHOST}). Usá un Postgres desechable." >&2
    exit 1;;
esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB=""
trap '[ -n "$DB" ] && dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT

for TEST in "$ROOT"/tests/db/*_test.sql; do
  NAME="$(basename "$TEST" _test.sql)"
  DB="cd_tests_${NAME}_$$"
  MIGRATIONS="$(sed -n 's/^-- migraciones: //p' "$TEST" | head -1)"
  if [ -z "$MIGRATIONS" ]; then
    echo "FALLA: $TEST no declara '-- migraciones: …'" >&2
    exit 1
  fi
  echo "── $NAME"
  createdb "$DB"
  PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")
  "${PSQL[@]}" -f "$ROOT/tests/db/stub_supabase.sql"
  if [ -f "$ROOT/tests/db/${NAME}_pre.sql" ]; then
    "${PSQL[@]}" -f "$ROOT/tests/db/${NAME}_pre.sql"
  fi
  for _ in 1 2; do
    for M in $MIGRATIONS; do
      "${PSQL[@]}" -f "$ROOT/supabase/migrations/$M"
    done
  done
  "${PSQL[@]}" -f "$TEST"
  dropdb --if-exists "$DB" >/dev/null 2>&1 || true
  DB=""
done
