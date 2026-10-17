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
| `planes_manuales_test.sql` | `20261003120000_planes_gestion_manual.sql` (CD-005): el cliente no puede cambiar plan, estado, vencimiento ni "Sin cobro"; el superadmin asigna acceso con cobro externo o cortesía; los eventos viejos de Mercado Pago no revierten la gestión manual; los pagos por la plataforma siguen funcionando. |
| `token_mercadopago_test.sql` | `20261014120000_ocultar_token_mercadopago.sql`: el token de Mercado Pago del consultorio no se puede leer desde el navegador (ni miembros, ni pacientes, ni anónimos; tampoco con `select *`); `mp_connected` sigue el token; los miembros siguen leyendo y guardando su política de cobro; las funciones con service_role sí leen el token. |
