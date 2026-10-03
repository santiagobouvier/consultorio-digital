# Funciones retiradas

Borrar una función del repo **no** la quita de producción. En Lovable Cloud,
sincronizar `main` y hacer Publish solo actualiza el frontend: no despliega ni
borra edge functions (comprobado el 22/9 con `send-resend-email`, que hubo que
desplegar por separado). Cada retiro necesita su propio paso sobre el backend
y su verificación.

`supabase/functions/_tests/retired_functions_test.ts` impide que una función
retirada vuelva al repo o que algo dependa de ella.

---

## `setup-demo-user` (CD-002)

| | |
|---|---|
| Repo | Retirada (carpeta y entrada `[functions.setup-demo-user]` de `supabase/config.toml`). |
| Producción | **Pendiente.** El endpoint publicado sigue existiendo hasta borrarlo y verificarlo (abajo). |
| Credenciales/datos | **Sin tocar.** Ni la cuenta demo, ni el secreto, ni ningún consultorio. |

### Qué hacía

Publicada con `verify_jwt = false` y sin ningún control propio: cualquiera
podía invocarla. En cada llamada:

1. Buscaba **el único** consultorio con `businesses.is_demo = true`
   (`.single()`). Con 0 o con 2 o más, respondía 400 **sin cambiar nada**.
2. Creaba la cuenta `demo@consultorio.app` o, si ya existía, le **reseteaba la
   contraseña** al valor del secreto `DEMO_USER_PASSWORD`.
3. Le daba rol `owner` en ese consultorio (`user_roles`) y **sobrescribía
   `businesses.owner_user_id`** con esa cuenta.
4. Respondía con el email y la **contraseña** en texto plano.

### Por qué se retira

- No la usa nada: ninguna pantalla, otra función, cron, script ni migración
  (la prueba de regresión lo comprueba).
- El producto se muestra con el consultorio ficticio operativo Mental Care; la
  demo pública visual (`/demo/*`, `/portal-paciente/demo`) arma sus datos en
  el frontend y no inicia sesión con ninguna cuenta.
- Riesgo latente: hoy `is_demo` también significa **"Sin cobro"** en el panel
  de administración. Si exactamente un consultorio tiene ese flag (por ejemplo
  uno real en cortesía, o Mental Care si estuviera marcado así), una llamada
  anónima le cambia el dueño a `demo@consultorio.app` y entrega la contraseña.

### Identidad de la cuenta demo vieja (no modificar)

- Email: `demo@consultorio.app` · nombre: "Usuario Demo" (`user_metadata` y
  `public.profiles`).
- Contraseña: la del secreto `DEMO_USER_PASSWORD` del proyecto (no se
  documenta el valor).
- Dependencias que la función le creaba: fila en `auth.users`, fila en
  `public.profiles`, rol `owner` en `public.user_roles` del consultorio
  `is_demo` de ese momento y, posiblemente, `businesses.owner_user_id` de ese
  consultorio.
- Solo existe si la función se ejecutó alguna vez; desde el repo no se puede
  saber.

Consultas **de solo lectura** para el editor SQL de Lovable Cloud:

```sql
-- 1) ¿Existe la cuenta? ¿Alguien inició sesión con ella?
select id, email, created_at, last_sign_in_at, raw_user_meta_data->>'name' as nombre
from auth.users
where lower(email) = 'demo@consultorio.app';

-- 2) ¿De qué consultorios es miembro o dueña?
select ur.role, b.id, b.name, b.public_slug, b.is_demo,
       (b.owner_user_id = ur.user_id) as figura_como_owner_user_id
from public.user_roles ur
join public.businesses b on b.id = ur.business_id
where ur.user_id = (select id from auth.users where lower(email) = 'demo@consultorio.app');

-- 3) Consultorios con is_demo = true (la función tomaba "el único")
select id, name, public_slug, owner_user_id, no_billing_until
from public.businesses
where is_demo;

-- 4) Perfil
select id, email, name from public.profiles where lower(email) = 'demo@consultorio.app';
```

Cómo leerlas:

- Si la 3) devuelve **exactamente una fila**, el riesgo está activo mientras el
  endpoint siga publicado: priorizar el paso 2 de abajo.
- Si la 2) muestra `figura_como_owner_user_id = true` sobre un consultorio
  real o sobre Mental Care, la función ya se ejecutó contra él: avisar antes de
  tocar nada (hay que restaurar el dueño correcto, y eso es un cambio de datos
  aparte).
- Si la 1) no devuelve filas, la cuenta nunca se creó y no hay nada que
  limpiar en datos.

### Retirar el despliegue (pasos para después de la revisión)

Nada de esto está hecho.

1. **Lectura previa**: las cuatro consultas de arriba. Si la UI de Lovable
   Cloud muestra logs/invocaciones por función, revisar si `setup-demo-user`
   recibió llamadas (indicaría uso indebido).
2. **Borrar la función desplegada `setup-demo-user`** del backend
   `sfvuuzpmsgepooeamkin`.
   - **Capacidad a confirmar**: que la UI de Lovable Cloud (sección de Edge
     Functions del proyecto) permita borrar una función. No está verificada.
   - Si no la ofrece: Supabase CLI
     `supabase functions delete setup-demo-user --project-ref sfvuuzpmsgepooeamkin`,
     que requiere un access token con permisos sobre ese proyecto (en Lovable
     Cloud normalmente no se tiene: a confirmar), o soporte de Lovable.
   - Si solo existiera una vía para **desplegar** (no para borrar), se puede
     preparar una versión "tumba" de la función que responda 410 sin lógica y
     desplegarla encima; se prepara a pedido.
3. **Verificar sin efectos**: usar **solo `OPTIONS`**. Nunca un `POST`
   mientras la función pueda seguir viva: resetea la contraseña, la devuelve y
   puede cambiar el dueño de un consultorio.

   ```
   B=https://sfvuuzpmsgepooeamkin.supabase.co/functions/v1
   curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS "$B/setup-demo-user"
   curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS "$B/no-existe-control"
   ```

   - Publicada: la primera devuelve `200` (la función responde el preflight
     sin pedir credenciales) y la segunda, el código de "función no
     encontrada" (típicamente `404`).
   - Retirada: **las dos devuelven lo mismo**. Comparar contra el control en
     vez de esperar un número exacto.
4. **Merge de la PR**. Es independiente del paso 2 (no despliega ni borra
   nada); conviene hacerlo después para que `main` refleje producción.
5. **Más adelante, con autorización explícita** (cambia credenciales o
   datos; no forma parte de este retiro):
   - Borrar el secreto `DEMO_USER_PASSWORD` de los secretos del proyecto. Ya
     ningún código lo lee (lo garantiza la prueba).
   - Decidir qué hacer con `demo@consultorio.app` y sus filas en
     `user_roles`/`profiles`, y restaurar `owner_user_id` si la consulta 2)
     mostró que la cuenta tomó un consultorio.

### Qué no cambia

- Mental Care y cualquier otro consultorio, cuenta o dato.
- La demo pública visual (`/demo/*`, `/portal-paciente/demo`).
- El botón "Crear Demo" del panel de administración (crea "Demo Psicología"
  con el administrador como dueño; no usa esta función).
- El flag `is_demo` / "Sin cobro" y toda la lógica que lo lee.

---

## `setup-demo-patient`

| | |
|---|---|
| Repo | Retirada (carpeta borrada; nunca tuvo entrada en `supabase/config.toml`). |
| Producción | **Pendiente.** Figura activa en Cloud (comprobado por lectura: "View code" muestra esta fuente). El endpoint sigue existiendo hasta borrarlo y verificarlo. |
| Credenciales/datos | **Sin tocar.** |

### Qué hacía

Recibía `{ patient_id, email, password }` y, sin verificar quién llamaba ni su
rol, con el cliente administrador:

1. Si existía una cuenta con ese email, le **cambiaba la contraseña** y la
   marcaba como confirmada. Si no existía, la creaba.
2. Sobrescribía el perfil (`public.profiles`) con el nombre **"Paciente Demo"**.
3. Vinculaba esa cuenta al paciente `patient_id` (y le ponía ese email).
4. Le agregaba el rol `patient`.

Sin entrada en `config.toml` queda con `verify_jwt` por defecto, que la clave
anon pública satisface: cualquiera podía tomar cualquier cuenta (profesional,
paciente o superadmin) sabiendo su email. Ninguna pantalla, función, cron,
script ni migración la usa.

### Flujos legítimos que siguen igual

- **Invitación:** el profesional invita (`create-patient-invite`, exige su
  sesión) → mail → `/portal-paciente/invitacion` → `activate-patient-account`
  define la contraseña **solo con un token válido** (existe, no usado, no
  vencido).
- **Acceso:** `/acceso/paciente` → `/portal/:slug` → inicio de sesión con email
  y contraseña.
- `supabase/functions/_tests/patient_access_test.ts` falla si aparece otra
  función que cambie contraseñas sin estar en la lista de activaciones por
  token, o si se desconecta alguno de estos flujos.

### ¿Se usó? Consultas de solo lectura (editor SQL de Lovable Cloud)

```sql
-- 1) Perfiles que la función marcó como "Paciente Demo"
--    (ningún flujo legítimo escribe ese nombre)
select p.id, p.email, p.name, u.created_at, u.updated_at, u.last_sign_in_at,
       u.raw_user_meta_data->>'name' as nombre_en_auth
from public.profiles p
join auth.users u on u.id = p.id
where p.name = 'Paciente Demo' or u.raw_user_meta_data->>'name' = 'Paciente Demo'
order by u.updated_at desc;

-- 2) Roles de esas cuentas (¿alguna es profesional, dueña o superadmin?)
select ur.user_id, ur.role, ur.business_id
from public.user_roles ur
where ur.user_id in (select id from public.profiles where name = 'Paciente Demo');
```

Cómo leerlas:

- **Sin filas:** no hay rastros de uso. Retirar y listo.
- **Filas de cuentas de prueba conocidas:** uso propio viejo. Retirar y listo;
  la limpieza de esas cuentas es una decisión aparte.
- **Una cuenta real** (profesional, dueña, superadmin o paciente real): **es
  posible que alguien le haya cambiado la contraseña.** No tocar nada y avisar:
  cerrar sesiones, resetear la contraseña y revisar ese consultorio es una
  decisión aparte.
- Si la UI de Cloud muestra logs o invocaciones de la función, revisar si hubo
  llamadas que no fueron propias.

### Retirar el despliegue (pasos para después de la revisión)

Nada de esto está hecho.

1. **Lectura previa:** las dos consultas de arriba y, si existen, los logs de la
   función.
2. **Borrar la función desplegada `setup-demo-patient`** en Cloud, con el mismo
   procedimiento que se usó para `setup-demo-user`.
3. **Verificar sin efectos, solo con `OPTIONS`.** Nunca un `POST` mientras
   pueda seguir viva: cambia la contraseña de la cuenta que se le pase.

   ```
   B=https://sfvuuzpmsgepooeamkin.supabase.co/functions/v1
   curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS "$B/setup-demo-patient"
   curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS "$B/no-existe-control"
   ```

   Retirada = **las dos devuelven lo mismo** (típicamente `404`). Mientras
   sigue publicada, la primera puede dar `200` o `401` (esta función usa la
   verificación de JWT por defecto): cualquier código distinto del control
   significa que todavía existe.
4. **Merge de la PR.** No despliega ni borra nada en producción; no hace falta
   Publish (no hay cambios de frontend).
