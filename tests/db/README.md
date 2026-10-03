# Pruebas de base de datos

Prueban migraciones contra un Postgres **desechable** que imita lo relevante
de Supabase (roles `authenticated` y `service_role`, `auth.uid()`, RLS,
triggers). Nunca se corren contra producción: `run.sh` se niega si `PGHOST`
apunta a Supabase o Lovable.

```
PGHOST=... PGPORT=... PGUSER=... npm run test:db
```

El usuario de `PGUSER` tiene que poder crear bases y roles. El script crea una
base temporal, carga `stub_supabase.sql`, aplica la migración dos veces (para
probar que es idempotente), corre las pruebas y borra la base.

| Archivo | Qué prueba |
|---|---|
| `planes_manuales_test.sql` | `20261003120000_planes_gestion_manual.sql` (CD-005): el cliente no puede cambiar plan, estado, vencimiento ni "Sin cobro"; el superadmin asigna acceso con cobro externo o cortesía; los eventos viejos de Mercado Pago no revierten la gestión manual; los pagos por la plataforma siguen funcionando. |
