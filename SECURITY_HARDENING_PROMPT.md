# PROMPT PARA CLAUDE — ENDURECIMIENTO DE SEGURIDAD DEL SISTEMA FONDO SOLIDARIO

> Pega esto completo en Claude (Claude Code o la conversación que tenga acceso al repo y a Supabase).
> Está escrito para que lo ejecute de forma autónoma. Léelo completo antes de tocar nada.

---

## 0. CONTEXTO GENERAL

Eres el encargado de endurecer la seguridad de un sistema real de gestión de dinero. El propietario autorizó
expresamente este trabajo y te dio acceso al repositorio y a los proyectos de Supabase.

**Qué es:** Sistema Integral del Fondo Solidario de Propina del Casino de Puerto Varas. Gestión de socios,
anticipos, ausencias, recaudaciones diarias, arqueo de caja, certificados, auditoría. Maneja dinero real.

**Repositorio:** https://github.com/33Javier33/Socios-comicion-propina — rama `main`.
**App desplegada:** https://socios-comicion-propina.vercel.app/ (PWA, despliegue automático desde `main`).

**Tecnología:**
- Frontend: HTML/CSS/JavaScript puro (sin frameworks, sin build). Archivos JS en `js/`.
- Base de datos: **Supabase** con claves `anon` públicas hardcodeadas en `js/supabase-config.js`.
- Backend secundario: Google Apps Script (`backend.gs`, desplegado como URL en `URL_SOCIOS`/`URL_RECAUDACIONES`).
- Realtime: canales `rec-data-sync` y `rec-presencia` (compartidos con 2 apps hermanas).

**Proyectos Supabase (claves anon en `js/supabase-config.js:7-11`):**
- **SOC** `teemahksasdougehrcly` — socios, anticipos, extras, saldos, arqueo, auditoría, config, credenciales.
- **REC** `lpulmjzboogixbdxxayo` — recaudaciones diarias, divisores, presencia (`rec_presencia`), realtime.

**⚠️ Los proyectos REC son COMPARTIDOS con otras 2 apps** (`diario-propi.vercel.app` y `propi-solicitada.vercel.app`,
que pueden estar en otros repos). Cualquier cambio de RLS en REC no debe romper su flujo de recaudación ni el realtime.

---

## 1. HALLAZGOS DE LA AUDITORÍA (ya verificados, no repetir el análisis)

Hay 4 problemas de seguridad críticos. Todos están verificados en el código:

### 1.1 RLS de Supabase abierta o deshabilitada (CRÍTICO)
- `migration/create_tables.sql:130-157` — se habilita RLS pero se crean políticas
  `anon ... FOR ALL USING (true) WITH CHECK (true)` para **todas** las tablas. RLS activado pero **sin efecto**:
  cualquier persona con la anon key (pública) puede SELECT/INSERT/UPDATE/DELETE todo.
- `sql/create_arqueo_tables.sql:39-41` — `DISABLE ROW LEVEL SECURITY` en `retiros_anticipos`,
  `arqueo_estado`, `arqueo_cierres`.
- Las claves anon viven en el frontend (`js/supabase-config.js:7-11`) y también duplicadas en
  `backend.gs:11-16`, `index2.html:200-202` e `index_original.html`. La anon key es pública por diseño;
  la protección real **tiene que** venir de RLS/funciones, no de esconder la clave.

### 1.2 Autenticación 100% del lado del cliente (CRÍTICO)
- `js/auth.js:42` — el PIN se compara en el navegador.
- `js/constants.js:29` — `PIN_DEFAULT = '1234'` hardcodeado.
- `js/auth.js:45` — entrar = `sessionStorage.setItem('fs_sesion', 'ok')`. Se puede falsificar con DevTools.
- `js/config.js:5-7` — clave de recuperación también en `localStorage` con fallback hardcodeado (`CLAVE_RECUP`).
- Ninguna operación se valida en el servidor. El "login" es solo cosmético.

### 1.3 Datos sensibles en texto plano
- Tabla `credenciales` (y `responsable_creds`) guarda PINs personales; con RLS abierta son legibles por cualquiera.
- También se guardan RUT en `socios.rut` y datos de conexiones (`historial_conexiones` con IP/lat/lng).

### 1.4 Escritura directa y destructiva con la anon key
- ~100 llamadas `dbSoc.from(...).insert/update/delete` directas repartidas en ~30 archivos de `js/`.
- La app también escribe por REST crudo con la anon key (cola offline en `js/supabase-config.js:220-260`,
  `_origFetch` a `/rest/v1/...`).
- Operaciones destructivas que hoy cualquier desconocido puede ejecutar con la anon key:
  - "Reiniciar Anticipos" (borrado masivo de `anticipos`), "Reiniciar Ausencias" (borrado de `extras`),
    "Vaciar Nube y Archivar Todo", "Cierre de Mes" (reescribe `saldos_socio`, `cierres_mes`),
    eliminar socios, editar desgloses de billetes (`retiros_anticipos`), cambiar config global y PINs
    (`config_sistema`, `responsable_creds`), subir/borrar certificados y materiales.
- Referencias clave de operaciones peligrosas en `js/supabase-config.js`:
  `:405` auditoría, `:492/:646/:690` insert anticipos/extras, `:730-757` borrar socio + archivar,
  `:800/:833/:1190` reiniciar anticipos, `:869-908` cierres_mes, `:1077` reiniciar ausencias,
  `:1096` editar anticipo, `:1134-1214` saldo anterior / cierre masivo, `:1362` config, `:1384` responsable_creds,
  `:1531-1585` materiales / dineros, `:1598-1652` certificados, `:1914-2032` arqueo y desgloses.
- En otros archivos: `js/carpetas.js:70,338` (periodos_archivados), `js/app-init.js:390` (upsert socios).

---

## 2. OBJETIVO Y ESTRATEGIA

**Objetivo:** que un atacante con la anon key pública NO pueda leer datos sensibles ni ejecutar
escrituras destructivas, sin romper el funcionamiento actual de la app (que usa la anon key para casi todo).

**Estrategia en 2 fases. Ejecuta la Fase 1 completa primero. La Fase 2 es opcional pero recomendada.**

- **Fase 1 — Endurecimiento sin romper la app:** RLS que deja a `anon` con acceso de **solo lectura**
  en lo no sensible, y todas las operaciones críticas/destructivas se mueven a **funciones RPC
  `SECURITY DEFINER`** que validan una clave secreta del lado servidor con bloqueo por fuerza bruta.
- **Fase 2 — Migración a Supabase Auth:** convertir los PINs en usuarios reales, RLS por
  `auth.uid()`/rol, eliminar la validación client-side. Es un refactor mayor; hazlo en commits
  separados y solo después de validar la Fase 1.

---

## 3. FASE 1 — IMPLEMENTACIÓN

### 3.1 Reglas de oro (no negociables)
1. **Nunca** pongas la `service_role` ni ninguna clave secreta en el frontend, ni en `.js`, ni en `index*.html`,
   ni en el repo. Si una RPC necesita validar un secreto, ese secreto se guarda **hasheado en Supabase**
   (tabla `config_seguridad`) y lo conoce solo el admin. Si usas Google Apps Script para operaciones
   privilegiadas, guarda la `service_role` en **Script Properties** (no hardcodeada) — pero evalúa si hace falta.
2. **Antes de tocar nada en Supabase:** pide respaldo. La app tiene "⚙️ Mantenimiento → Exportar JSON".
   Alternativamente usa `pg_dump`/CLI de Supabase. Guarda el backup fuera del repo.
3. Trabaja en una rama (`security/hardening-fase1`), haz PR, y **prueba en el preview de Vercel**
   antes de mergear a `main`. Nada se mergea sin validar.
4. No borres funcionalidad: los módulos de socios, anticipos, ausencias, recaudación, arqueo,
   certificados, mensajes, notas y cierre de mes deben seguir funcionando exactamente igual.
5. Commits en español, mensajes cortos y descriptivos, coherentes con el historial del repo.
6. Ante cualquier decisión de diseño dudosa, elige la opción que mantenga la app funcionando
   y documenta la decisión en el PR.

### 3.2 SQL — RLS y funciones (proyecto SOC `teemahksasdougehrcly`)

Crea un script SQL migratorio (p. ej. `sql/hardening_rls_soc.sql`) que:

**a) Bloquee el acceso anónimo a datos sensibles:**
- `REVOKE`/políticas nuevas para `anon` sobre: `credenciales`, `responsable_creds`, `config_sistema`,
  `config_seguridad`, `historial_conexiones`. Deben quedar **sin SELECT** para `anon` (0 políticas, o
  `USING (false)`). Verifica que la app no las lea con la anon key (si la app las lee, esas lecturas deben
  pasar por RPC).
- `socios.rut`: la tabla `socios` debe seguir siendo legible (la app la usa en mil lugares), pero decide
  si el RUT puede quedar en la tabla legible o debe moverse detrás de una RPC. Prefiere RPC de solo lectura
  para el RUT si es fácil; si no, documenta el riesgo residual.

**b) RLS para `anon`: SELECT permitido (sin datos sensibles), INSERT limitado a lo funcional, UPDATE/DELETE DENEGADO en tablas críticas.**
- Tablas que requieren DELETE/UPDATE bloqueado para `anon`: `socios`, `anticipos`, `anticipos_historial`,
  `extras`, `saldos_socio`, `saldos_cierre_mes`, `cierres_mes`, `cierres_mes_historial`,
  `dias_pt`, `retiros_anticipos`, `arqueo_estado`, `arqueo_cierres`, `certificados`, `materiales`,
  `dineros_sobrantes`, `periodos_archivados`, `canjes`.
- Para INSERT: mantén los que la app necesita en flujo normal (ej. `anticipos`, `extras`, `auditoria`,
  `retiros_anticipos` al crear un anticipo, `arqueo_estado`, `certificados`, `materiales`, `dineros_sobrantes`,
  `chat_mensajes`, `push_subscriptions`, `historial_conexiones`). Prohibe INSERT en `config_sistema`,
  `responsable_creds`, `credenciales`, `saldos_socio`/`saldos_cierre_mes`/`cierres_mes` (van por RPC).
- **OJO:** revisa cada archivo de `js/` antes de restringir para no romper flujos legítimos de INSERT.
  Donde haya duda, deja el INSERT abierto y bloquea solo UPDATE/DELETE.

**c) Tabla `config_seguridad` (nueva):**
```sql
CREATE TABLE IF NOT EXISTS config_seguridad (
  clave TEXT PRIMARY KEY,
  valor TEXT,                -- hash SHA-256 del secreto
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
Habilita RLS y **no** des políticas de lectura para `anon` (acceso solo por función).

**d) Funciones RPC `SECURITY DEFINER`** (una por operación crítica). Patrón obligatorio:

```sql
CREATE OR REPLACE FUNCTION rpc_nombre(resto de parametros, p_secreto TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  hash_ok TEXT;
BEGIN
  SELECT valor INTO hash_ok FROM config_seguridad WHERE clave='secreto_servicio';
  IF hash_ok IS NULL OR encode(sha256(convert_to(p_secreto,'UTF8')),'hex') <> hash_ok THEN
    PERFORM rpc_registrar_intento_fallido();   -- ver 3.2.e
    RAISE EXCEPTION 'Credenciales invalidas';
  END IF;
  PERFORM rpc_registrar_intento_ok(p_secreto); -- resetea contador de fallos
  -- ... operación ...
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE ALL ON FUNCTION rpc_nombre(...) FROM public;
GRANT EXECUTE ON FUNCTION rpc_nombre(...) TO anon;
```
La clave secreta real se inserta hasheada en `config_seguridad` mediante un INSERT manual del admin
(te la debe dar el propietario). Nunca en el repo.

**Lista mínima de RPC a crear (ajusta nombres a los del código):**
1. `rpc_reiniciar_anticipos(periodo, p_secreto)` — reemplaza los borrados masivos de `anticipos`.
2. `rpc_reiniciar_ausencias(periodo, p_secreto)` — borrado masivo de `extras`.
3. `rpc_archivar_periodo(periodo, p_secreto)` — "Vaciar Nube y Archivar Todo" (`periodos_archivados` + borrado).
4. `rpc_cierre_mes(datos jsonb, p_secreto)` — upserts de `saldos_socio`, `cierres_mes`, `cierres_mes_historial`.
5. `rpc_eliminar_socio(socio_id, p_secreto)` — borrado de socio + su historial (hoy `dbSoc.from(tbl).delete()`).
6. `rpc_editar_anticipo(...)`, `rpc_editar_desglose(...)`, `rpc_actualizar_recaudacion(...)` — edits/updates sensibles.
7. `rpc_cambiar_config(clave, valor, p_secreto)` — `config_sistema` (PIN global, modo anticipos, etc.).
8. `rpc_cambiar_pin_responsable(...)`, `rpc_cambiar_credencial(...)` — `responsable_creds`/`credenciales`.
9. `rpc_eliminar_certificado(...)`, `rpc_eliminar_material(...)`, `rpc_eliminar_dinero(...)`.
10. Cualquier otro UPDATE/DELETE que la app haga con la anon key y que sea sensible.
   Audita TODOS los `dbSoc.from(...).delete()` y `.update()` de `js/` y decide uno por uno:
   RPC, INSERT abierto, o bloqueado.

**e) Protección contra fuerza bruta:** crea una tabla `rpc_intentos` (o usa `pg_stat`) que registre
intentos fallidos por IP y bloque la función después de N fallos (ej. 5) en una ventana (ej. 15 min).
El patrón `rpc_registrar_intento_fallido()`/`_ok()` de arriba debe consultar esa tabla antes de validar.

**f) Realtime:** tras cambiar RLS, verifica que los canales sigan funcionando. En SOC el realtime es
marginal, pero en REC es crítico (ver 3.3). RLS aplica a realtime: si bloqueas UPDATE de una tabla que se
suscribe, los cambios dejarán de propagarse.

### 3.3 SQL — proyecto REC `lpulmjzboogixbdxxayo` (`sql/hardening_rls_rec.sql`)
- RLS es **read-mostly + presencia** (recaudaciones, divisores, `rec_presencia`).
- Habilita RLS y da a `anon` SELECT. Para `rec_presencia` permite INSERT y DELETE (es el latido de presencia:
  `js/supabase-config.js:116-119` inserta/borra su fila, y `:127` borra filas muertas). Bloquea UPDATE si se puede.
- Verifica que `diario.propi` y `propi.solicitada` (otras apps del mismo canal) sigan escribiendo/leyendo.
- El divisor (cálculo de "Punto Día") y la recaudación la escribe la app; si hay un UPDATE diario del divisor,
  déjalo pasar por RPC o conserva el UPDATE anónimo SOLO si no hay alternativa — documenta el riesgo.

### 3.4 Cambios de código frontend

**a) Capa de llamadas RPC:** crea `js/rpc.js` con helpers que llamen `dbSoc.rpc('rpc_nombre', {...})` y
adjunten el secreto. El secreto NO vive en el código: se pide al admin una vez por sesión (prompt seguro
al activar funciones críticas) y se guarda en `sessionStorage`, o se lee de un campo oculto en
Configuración si el propietario lo prefiere. Documenta en la app (ayuda de Configuración) cómo obtenerlo.

**b) Reemplaza los call sites:** en `js/supabase-config.js` y demás archivos, cambia los
`dbSoc.from(...).delete()/.update()` de operaciones críticas por `await rpc(...)`.
Añade manejo de errores claro ("Sin autorización" / "Demasiados intentos").

**c) La cola offline** (`js/supabase-config.js:220-260`) escribe directo a `/rest/v1` con la anon key.
Si restringiste esos INSERTs, la cola se rompe en modo offline. Solución: mantener abiertos los INSERTs de
`anticipos`/`extras` (que es lo que la cola sincroniza) o migrar la cola a llamar RPC. Elige la opción menos
invasiva y pruébala con la red cortada.

**d) Lecturas de datos sensibles:** si `credenciales`/`responsable_creds`/`config_sistema` dejaron de ser
legibles y la app las lee con anon (revisa `js/api.js:cargarCredenciales`, `js/config.js:cfg_cargarDesdeSupabase`),
créales RPC de lectura `SECURITY DEFINER` que también validen el secreto (o el PIN actual del usuario,
comparándolo con un hash en el servidor). Esto mantiene el login funcionando sin exponer los PINs.

### 3.5 Archivos que vas a tocar (referencia)
- `sql/hardening_rls_soc.sql`, `sql/hardening_rls_rec.sql` (nuevos).
- `js/supabase-config.js` (call sites + cola offline), `js/rpc.js` (nuevo), `js/api.js`, `js/config.js`,
  `js/auth.js`, `js/carpetas.js`, `js/certificados.js`, `js/materiales.js`, `js/dineros.js`,
  `js/recaudacion.js`, `js/arqueo.js`, `js/anticipos.js`, `js/meses-anteriores.js` y todos los que tengan
  `dbSoc.from(...).delete()/.update()` relevantes. Haz un grep completo.
- `index.html` (ayuda de Configuración: explicar el secreto y el bloqueo).
- `SECURITY_HARDENING_PROMPT.md` (actualiza al final: qué se hizo, qué queda pendiente).

---

## 4. FASE 2 — MIGRACIÓN A SUPABASE AUTH (opcional, después de validar Fase 1)

Objetivo: eliminar la validación client-side del PIN y el "login" por sessionStorage.
1. Activa Supabase Auth. Crea un usuario por responsable (puedes sembrarlos por API con `service_role`
   usando los PINs actuales, con hash bcrypt).
2. RLS por `auth.uid()`/rol: `socios` legibles por autenticados; escrituras solo con rol admin;
   `credenciales` legibles solo por el propio usuario.
3. Sustituye `intentarLogin()` (`js/auth.js`) por `supabase.auth.signInWithPassword` (o magic link).
4. Elimina `PIN_DEFAULT`, `PIN_KEY`/`fs_pin`, `SESSION_KEY`/`fs_sesion` y `CLAVE_RECUP` de
   `js/constants.js` y `js/config.js`.
5. Los PINs de 4 dígitos como contraseña son débiles; recomienda contraseña larga o exige PIN + mínimo de
   intentos en el servidor (Auth ya bloquea por defecto tras intentos).
6. Migra la tabla `credenciales`/`responsable_creds` a `auth.users` + tabla de perfil. No dejes PINs planos.

---

## 5. VERIFICACIÓN (definición de hecho)

**Checklist que DEBE pasar antes de mergear:**
1. Con la anon key sola (curl/POSTman, sin ningún secreto), **no** se puede:
   - SELECT de `credenciales`, `responsable_creds`, `config_sistema`, `config_seguridad`, `historial_conexiones`.
   - DELETE ni UPDATE de `socios`, `anticipos`, `extras`, `saldos_*`, `cierres_mes*`, `retiros_anticipos`,
     `arqueo_*`, `certificados`, `materiales`, `dineros_sobrantes`, `periodos_archivados`.
   - INSERT en `config_sistema`, `responsable_creds`, `credenciales`, `saldos_*`, `cierres_mes*`.
2. Con la anon key + el secreto correcto, las RPC hacen su trabajo (reinicias, cierres, archivar, eliminar).
3. Con el secreto equivocado (5 veces), la función rechaza con bloqueo temporal.
4. La app funciona de punta a punta en el preview de Vercel:
   - Login con PIN personal y con PIN global.
   - Registrar anticipo y ausencia; editar/borrar movimiento.
   - Recaudación (agregar montos, divisor) y presencia en tiempo real.
   - Arqueo: conteo, retiro, canje, guardar/archivar.
   - Cierre de mes en una copia/entorno de prueba, y verificar remanente.
   - Certificados, mensajes, notas, materiales, exportar/importar JSON.
   - Prueba con red cortada: la cola offline de anticipos sigue funcionando.
5. Realtime `rec-data-sync`/`rec-presencia` operativo (pruébalo con 2 dispositivos/ventanas).
6. El login no expone ni muestra PINs en la respuesta ni en el código de red.
7. `backend.gs` (Google Apps Script) no quedó con claves hardcodeadas nuevas; si usa `service_role`,
   está en Script Properties y no se sube al repo. OJO: `backend.gs` YA tiene anon keys hardcodeadas;
   puedes dejar las anon (son públicas) pero marca en comentario que no son secretos.

**Antes de terminar:**
- Actualiza este archivo con un resumen ejecutivo de lo implementado y lo pendiente.
- Avisa al propietario qué secretos nuevos existen (la clave de servicio para las RPC) y cómo resguardarla.
- Propón próximos pasos de la Fase 2 en un issue del repo.

---

## 6. RECORDATORIOS IMPORTANTES PARA EL EJECUTOR
- No rompas las apps hermanas (diario.propi, propi.solicitada) que comparten el proyecto REC.
- No subas secretos al repo bajo ningún concepto (ni en commits, ni en historial, ni en logs).
- Si el repositorio no tiene la CLI de Supabase vinculada, ejecuta el SQL desde el dashboard
  (SQL Editor) en cada proyecto y confirma a mano los resultados de las políticas con
  `select * from pg_policies where tablename='<tabla>';`.
- Cuando modifiques RLS, hazlo por tablas con "enforcar" (force RLS) y verifica con la clave anon REAL
  (no la service_role) usando un `curl` de prueba a `/rest/v1/<tabla>`.
