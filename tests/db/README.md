# Pruebas de base de datos

Prueban migraciones contra un Postgres **desechable** que imita lo relevante
de Supabase (roles `authenticated` y `service_role`, `auth.uid()`, RLS,
triggers). Nunca se corren contra producción: `run.sh` se niega si `PGHOST`
apunta a Supabase o Lovable.

```
PGHOST=... PGPORT=... PGUSER=... npm run test:db
```

El usuario de `PGUSER` tiene que poder crear bases y roles, y llamarse
`postgres` (superusuario): los triggers de CD-005 reconocen al dueño de la base
por `current_user IN ('postgres', 'service_role', 'supabase_admin')`, igual que
en Supabase; con otro nombre, los propios datos de prueba se rechazan con
`subscription_change_not_allowed`.

Por cada `*_test.sql`, el script crea una base temporal, carga
`stub_supabase.sql`, el esquema extra `<nombre>_pre.sql` si existe, aplica dos
veces (para probar que son idempotentes) las migraciones que el test declara en
su línea `-- migraciones: …`, corre las pruebas y borra la base.

| Archivo | Qué prueba |
|---|---|
| `datos_publicos_test.sql` | `20261014140000_datos_publicos_consultorio.sql`: anon ya no lee `owner_user_id` ni `plan_code` (ni con `select *`), la vista pública no los tiene, anon sigue viendo el consultorio y sus horarios públicos sin errores de permiso, las políticas de dueño pasan a `authenticated` y el dueño sigue igual. |
| `limite_reservas_test.sql` | `20261014150000_limite_reservas_publicas.sql`: límites por conexión (10 min y día), por teléfono en el consultorio, por consultorio y limpieza; solo `service_role` puede usarlo. |
| `token_tareas_test.sql` | `20261014130000_token_tareas_automaticas.sql`: token de los crons en Vault (único, idempotente), los crons existentes pasan a usarlo conservando horario, `verify_cron_jobs_token` solo para `service_role`, rotación. |
| `planes_manuales_test.sql` | `20261003120000_planes_gestion_manual.sql` (CD-005): el cliente no puede cambiar plan, estado, vencimiento ni "Sin cobro"; el superadmin asigna acceso con cobro externo o cortesía; los eventos viejos de Mercado Pago no revierten la gestión manual; los pagos por la plataforma siguen funcionando. |
