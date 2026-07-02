# Sistema Integral Fondo Solidario — Comisión de Propinas

Sistema web completo para la gestión de la comisión de propinas de un casino. Permite administrar socios, anticipos, ausencias, recaudación diaria, arqueo de caja y auditoría, todo desde una sola aplicación sin frameworks, conectada a Google Sheets como base de datos.

---

## Tecnologías utilizadas

- **Frontend**: HTML5, CSS3, JavaScript ES6+ (Vanilla JS, sin frameworks)
- **Backend**: Google Apps Script (GAS) conectado a Google Sheets
- **Almacenamiento local**: `localStorage` para caché y sesión
- **Íconos**: Font Awesome 6.4.0
- **Tipografía**: Google Fonts (DM Sans, DM Mono)

---

## Estructura de archivos

```
/
├── index.html              # SPA principal con todas las vistas y modales
├── styles.css              # Estilos globales, dark mode, animaciones
├── backend.gs              # Google Apps Script (lógica del servidor)
└── js/
    ├── constants.js        # URLs API, denominaciones, valores por defecto
    ├── config.js           # Configuración de PINs, claves y responsables
    ├── auth.js             # Login, sesión, inactividad automática
    ├── api.js              # Capa de abstracción para llamadas a la API
    ├── cache.js            # Sistema de caché con localStorage y TTL
    ├── app-init.js         # Inicialización, precarga y navegación de pestañas
    ├── socios.js           # Gestión de socios, puntos y escalamientos
    ├── anticipos.js        # Anticipos, ausencias y cierre de mes
    ├── recaudacion.js      # Carga y procesado de recaudaciones
    ├── arqueo.js           # Arqueo de caja con sincronización automática
    ├── canje.js            # Canje de denominaciones con recibo foliado
    ├── puntos.js           # Calendario de días trabajados Part-Time
    ├── auditoria.js        # Historial de auditoría con filtros
    ├── notas.js            # Notas administrativas del sistema
    ├── reports.js          # Generación de informes e impresión a PDF
    ├── help.js             # Centro de ayuda con base de conocimiento
    ├── carpetas.js         # Archivero de períodos, exportar e importar
    ├── batch-dias-pt.js    # Carga masiva de días para empleados Part-Time
    └── utils.js            # Funciones utilitarias compartidas
```

---

## Módulos y funcionalidades

### Autenticación y seguridad (`auth.js`, `config.js`)

- Login con PIN de 4 dígitos por responsable (validado contra la nube o localmente)
- PIN global de respaldo y clave de recuperación maestra
- Cierre de sesión automático por **15 minutos de inactividad**
- Recuperación de PIN olvidado con clave maestra
- Dark mode toggle
- Sesión almacenada en `sessionStorage`

### Gestión de socios (`socios.js`, `api.js`)

- Listado de socios agrupados por área:
  - Mesas Planta, Mesas Part-Time, Cambistas, Máquinas, Técnicos, Bóveda, Gastos Comisión
- Cálculo automático de **antigüedad** en años desde fecha de ingreso
- Cálculo de **puntos** según fórmula: `4 + (años × 2)` con topes por área:

| Área | Tope de puntos |
|------|---------------|
| Mesas | 20 |
| Máquinas | 12 |
| Técnicos | 12 |
| Bóveda | 10 |
| Cambistas | 8 |
| Gastos Comisión | 1 |

- Detección de **escalamientos**: socios que suben puntos este mes o el próximo
- Socios **pendientes**: aquellos cuya fecha de inicio de puntos aún no llega
- Vista de **estado financiero** con historial de movimientos por socio
- Alta, edición y eliminación de socios con auditoría

### Anticipos y ausencias (`anticipos.js`)

- Registro de **anticipos** (adelantos de propina) por socio
- Registro de **ausencias** (faltas) con descuento asociado
- Búsqueda y filtros de socios
- **Cierre de mes**: actualiza saldos y reinicia contadores
- Captura de geolocalización y Device ID (canvas fingerprint) en cada registro
- Cargas masivas de días Part-Time

### Recaudación (`recaudacion.js`)

- Carga de recaudación desde Google Sheets
- Agrupación por fecha, tipo de sala y divisor
- Cálculo de **puntos por noche**: `totalDia / divisor`
- Tipos de sala soportados: Sala de Juegos, Máquinas, y otros
- Filtros por tipo y divisor
- Mapa global de puntos diarios usado por el módulo de Part-Time

### Arqueo de caja (`arqueo.js`)

- Conteo manual de **denominaciones CLP**: 20.000, 10.000, 5.000, 2.000, 1.000, 500, 100, 50, 10
- **Sincronización automática silenciosa** cada 5 segundos contra la API
- Cálculo de diferencias entre monto esperado y conteo real
- Período activo basado en la **regla del día 15** (período va del 15 al 14 de cada mes)
- Historial de retiros y movimientos con undo/redo
- Desglose de arqueo por tipo de recaudación
- Estado persistido en `localStorage`

### Canje de denominaciones (`canje.js`)

- Modal con tabla de 11 denominaciones (de 20.000 a 1 peso)
- Cálculo automático de totales al ingresar cantidades
- **Impresión de recibo** con folio único, fecha y nombre del responsable
- Registro en auditoría con GUID único por canje

### Calendario Part-Time (`puntos.js`)

- Calendario interactivo por mes para seleccionar días trabajados
- Suma automática de puntos de los días seleccionados
- Integración con el mapa de puntos de recaudación
- Guardado de días trabajados por socio en la nube

### Auditoría (`auditoria.js`)

- Historial completo de **todas las acciones** del sistema
- Registra: usuario, acción, timestamp, IP, dispositivo, ubicación GPS
- Filtros por: usuario, tipo de acción, rango de fechas, texto libre
- Colores por tipo de acción (Eliminar: rojo, Registrar: verde, etc.)
- Snapshot del estado antes y después de cada cambio
- Reimpresión de recibos desde el historial
- Folio único por registro

### Notas administrativas (`notas.js`)

- Publicación de notas visibles para todos los responsables
- Detección y enlazado automático de URLs
- Eliminación de notas con confirmación
- HTML escapado para prevenir XSS
- Caché con TTL de 30 minutos

### Informes e impresión (`reports.js`)

- **Informe de anticipos**: listado del período actual en dos columnas
- **Informe de recaudación**: detalle por tipo de sala y fecha
- **Informe de canjes**: registro de todos los canjes del período
- Todos los informes abren una ventana emergente con impresión automática a PDF

### Centro de ayuda (`help.js`)

- Base de conocimiento con más de 30 artículos
- Categorías: Socios, Anticipos, Recaudación, Arqueo, Puntos, Impresión, Configuración, Seguridad
- Búsqueda por texto y etiquetas
- Vistas interactivas demostrativas con pasos y notas

### Archivero y backups (`carpetas.js`)

- Archivero local en `localStorage` por período
- Exportar período de recaudación
- Vaciar nube y archivar el período actual
- Visualización de carpetas archivadas por fecha y divisor

### Carga masiva Part-Time (`batch-dias-pt.js`)

- Interfaz para agregar días trabajados a múltiples empleados Part-Time a la vez
- Merge inteligente: combina días nuevos con los ya existentes (no reemplaza)
- Auditoría completa de los cambios masivos con geolocalización
- Selección múltiple de empleados y fechas

---

## Flujos principales

### Login
```
Ingresar PIN → Validar (nube → local → global)
→ Guardar sesión en sessionStorage
→ iniciarApp() → precargarTodo() → renderizado
```

### Registro de anticipo
```
Seleccionar socio → Completar formulario
→ callApiSocios('addAnticipo')
→ Capturar geolocalización + Device ID
→ Registrar en auditoría → Actualizar vista
```

### Recaudación diaria
```
cargarRecaudaciones() → Agrupar por fecha/tipo
→ Calcular puntos (total / divisor)
→ globalMapaPuntosDia → Renderizar tabla
```

### Arqueo de caja
```
Inicializar período → Arrancar sync cada 5s
→ Fetch monto esperado + anticipos
→ Ingresar conteo manual → Calcular diferencia
→ Guardar en nube + localStorage
```

---

## Configuración predeterminada

| Parámetro | Valor |
|-----------|-------|
| PIN global por defecto | `1234` |
| Clave de recuperación | `socios2026` |
| Inactividad | 15 minutos |
| TTL caché socios | 30 minutos |
| TTL caché individual | 5 minutos |
| Sync arqueo | Cada 5 segundos |
| Responsables base | N.M, P.M, C.P (Zona S.J) |

---

## Caché y rendimiento

El sistema usa una capa de caché en `localStorage` con timestamps para evitar llamadas innecesarias a la API:

| Recurso | TTL |
|---------|-----|
| Socios (global) | 30 minutos |
| Socios (individual) | 5 minutos |
| Recaudación | 30 minutos |
| Notas | 30 minutos |
| Arqueo esperado | 10 minutos |
| AllData (anticipos + extras) | 5 minutos |

---

## Historial de Cambios

#### 2026-07-02 — Certificados: previsualización antes de imprimir
- El certificado ya no se envía directo a la impresora. Ahora se abre una ventana de **vista previa** que muestra el documento tal como quedará (formato A4).
- La ventana tiene una barra superior (que no se imprime) con botones **🖨 Imprimir** y **✖ Cerrar**, para revisar el documento antes de imprimirlo.
- Aplica tanto al generar un certificado nuevo (tras confirmar nombre+PIN) como al ver uno del historial ("🖨 Ver").
- Archivos modificados: `js/certificados.js`.

#### 2026-06-28 — Recaudaciones: suma de billetes verificados al Arqueo persiste correctamente
- Al verificar una recaudación en Montos Recaudados, los billetes se suman al conteo de Arqueo con rastro positivo "+N" por denominación (ej: 10 billetes de 10.000 → `+10`). El comportamiento de la suma ya existía.
- Fix de persistencia: la función guardaba directamente a GAS y a localStorage **sin** activar el flag de cambios pendientes. Como el Arqueo ahora lee desde Supabase, al reabrir/recargar `aq_recuperarDeNube` podía sobrescribir y perder las sumas (mismo problema que se corrigió para anticipos).
- Solución: se centralizó la lógica en `aq_aplicarBilletesRecaudacion` (espejo de `aq_aplicarBilletesAnticipo`, sumando con "+") que usa `aq_saveState()` → persiste en localStorage, marca dirty y sincroniza con Supabase de forma robusta. `_rec_volcarBilletesAArqueo` ahora solo delega en ella.
- Archivos modificados: `js/arqueo.js`, `js/recaudacion.js`.

#### 2026-06-28 — Certificados: períodos ordenados de la fecha más reciente primero
- La lista de períodos generados y el certificado impreso ahora muestran las fechas de la más reciente a la más antigua.
- Se invierte `_certPeriodosGen` tras generarlo (afecta lista, selección por año/últimos N e impresión) y se ordena defensivamente en `cert_imprimir` para que también aplique a certificados antiguos ya guardados al reimprimirlos.
- Archivos modificados: `js/certificados.js`.

#### 2026-06-27 — Anticipos: descuento de billetes en Arqueo persiste ante recargas
- Al confirmar el desglose de billetes de un anticipo, los billetes ya se descuentan del conteo de Arqueo de Caja (cada denominación con su rastro negativo, ej: `10.000` → `-10`). Esto ya funcionaba en el flujo normal.
- Fix de carrera: el guardado a la nube del arqueo es diferido (3.5s) y el flag `_aqDirtyFlag` era solo de sesión. Si el encargado recargaba la página o abría Arqueo antes de que ese guardado se completara, `aq_recuperarDeNube` traía datos viejos de la nube y se perdía el descuento.
- Solución: el flag de cambios pendientes ahora se persiste en localStorage (`AQ_SK_DIRTY`). `aq_recuperarDeNube` lo respeta y, en lugar de descartar los cambios locales, los empuja a la nube. Se limpia al guardar y al archivar/resetear.
- Archivos modificados: `js/arqueo.js`, `js/constants.js`.

#### 2026-06-27 — "Total Punto Actual" en la tarjeta de detalle del socio
- Se agregó un mini-stat verde "Total Punto Actual" en el detalle del socio (Anticipos y Ausencias), junto a Saldo Mes Ant., Alcance Teórico y Total Pedido.
- Planta: muestra el valor total del punto del período. Part-Time: suma solo los días trabajados por ese socio.
- Archivos modificados: `index.html`, `js/anticipos.js`, `js/socios.js`.

#### 2026-06-19 — "Acerca de": énfasis en el propósito del sistema para operadores del fondo
- Nuevo bloque destacado "Para qué sirve este sistema" que explica claramente la misión: control de socios, anticipos, ausencias, recaudaciones diarias y arqueo de billetes, todo guardado en Supabase para que el siguiente encargado encuentre el historial intacto sin empezar desde cero con planillas Excel.
- Archivos modificados: `index.html`.

#### 2026-06-19 — Carpetas archivadas sincronizadas con Supabase
- Las carpetas que se archivan ahora se guardan en Supabase (`periodos_archivados`) además de localStorage.
- El archivero detecta carpetas que solo están en el navegador (localStorage) y muestra un aviso con botón "Subir a Supabase" para sincronizarlas.
- Cada carpeta muestra indicador ☁️ (en Supabase) o 💾 (solo local).
- Los snapshots de carpeta incluyen desglose de billetes de recaudaciones (`billetes` JSONB) y desglose de billetes de retiros de anticipos (`retiros_anticipos`), permitiendo recuperar ese detalle desde carpetas archivadas.
- Archivos modificados: `js/carpetas.js`, `js/supabase-config.js`.

#### 2026-06-19 — Corrección: editar saldo anterior no guardaba los cambios
- El botón de editar saldo anterior en Anticipos y Ausencias fallaba silenciosamente: el upsert a Supabase no era esperado (await faltante) y la respuesta llegaba antes que la escritura, mostrando el valor antiguo.
- Fix: se añadió `await` al upsert de `saldos_socio`, se devuelve respuesta inmediatamente desde Supabase (sin esperar a GAS), y GAS se sincroniza en segundo plano.
- También se aplicó política RLS en Supabase para permitir escritura anónima en `saldos_socio` y `periodos_archivados`.
- Archivos modificados: `js/supabase-config.js`.

#### 2026-06-18 — Auditoría completa en Supabase con mucho más detalle
- Todos los movimientos del sistema ahora se registran en Supabase (`auditoria` table) con datos estructurados en `datos_extra` (JSONB).
- Nuevas acciones auditadas que antes no existían: Acceso, Cierre de Sesión, Registrar Recaudación, Actualizar Recaudación, Eliminar Recaudación, Verificar Recaudación, Actualizar Divisor, Retiro Anticipo, Cierre Arqueo, Cambiar PIN Global, Cambiar PIN Personal, Cambiar Clave Recuperación, Actualizar Configuración, Eliminar Credencial.
- Para canje e impresión de recibo: se guarda el snapshot completo en Supabase además del registro en Google Sheets (que se mantiene para historial).
- `getAuditoria` ahora devuelve registros combinados: Supabase (todos, desde hoy) + Google Sheets (solo antes del 2026-06-18 como historial).
- Canjes y recibos en Supabase guardan el snapshot completo en `datos_extra`, permitiendo reimpresión desde registros de Supabase.
- Archivos modificados: `js/supabase-config.js`, `js/auth.js`, `js/canje.js`, `js/reports.js`, `js/auditoria.js`.

#### 2026-06-18 — Traducción completa al español de la interfaz
- Reemplazados todos los términos en inglés visibles al usuario en `help.js`, `index.html` y `carpetas.js`.
- dashboard → panel, badge → indicador, login → ingreso/acceso, modal → ventana, sidebar → menú lateral, drawer → panel de menú, FABs → botones flotantes, serverless → servicio en la nube, offline → sin conexión, Backups → Respaldos, backup → copia de seguridad.

#### 2026-06-18 — Auditoría: referencia legible en lugar de UUID
- La columna "ID Afectado" ahora muestra una referencia descriptiva derivada del tipo de acción y la fecha del detalle (ej: `ANT 17/06`, `MAT 15/06`).
- Los canjes y recibos siguen mostrando su folio completo (ya era legible).
- El UUID completo queda disponible como tooltip al pasar el cursor.
- Columna renombrada a "Referencia" en tabla y en informe de impresión.
- Archivos modificados: `js/auditoria.js`, `index.html`.

#### 2026-06-18 — Configuración del sistema sincronizada con Supabase
- PIN global, clave de recuperación y lista de responsables ahora se guardan en Supabase y se cargan al iniciar la sesión en cualquier dispositivo.
- PINs personales de responsables redirigidos de Google Apps Script a Supabase (`responsable_creds`).
- Nuevas tablas en Supabase (`teemahksasdougehrcly`): `config_sistema` (clave/valor) y `responsable_creds` (ini/area/pin).
- Nuevos interceptores en `supabase-config.js`: `getConfig`, `setConfig`, `getCredenciales`, `setCredencial`, `deleteCredencial`.
- Nueva función `cfg_cargarDesdeSupabase()` en `config.js` que sincroniza al iniciar.
- Archivos modificados: `js/supabase-config.js`, `js/config.js`, `js/app-init.js`.

#### 2026-06-18 — Archivo de recaudaciones con detalle completo
- El visor de carpetas archivadas ahora muestra por cada tipo: estado arqueado (✅ En caja / ⚠️ Pendiente), quién registró la entrada (`registrado_por_nombre`), hora de verificación (`arqueado_at`) y tabla de billetes con denominación × cantidad → subtotal.
- Todos estos campos ya estaban en el snapshot guardado; solo se actualizó la visualización.
- Archivos modificados: `js/carpetas.js`.

#### 2026-06-18 — Corrección bug período 15→14 (día 15 asignado incorrectamente)
- El día 15 se asignaba al período anterior en lugar del actual por usar `d > 15` en lugar de `d >= 15`.
- Fix aplicado en tres archivos: `js/materiales.js`, `js/arqueo.js`, `js/anticipos.js`.

#### 2026-06-18 — Total remanentes entre socios en banner de Anticipos
- Nuevo dato en el banner morado: total de remanentes de todos los socios con el período (formato 15→14) y el período anterior como dato secundario.
- Datos leídos desde `saldos_socio` y `saldos_cierre_mes` en Supabase.
- Al reiniciar anticipos se guarda un snapshot en `saldos_cierre_mes` para el historial.
- Archivos modificados: `js/anticipos.js`, `js/supabase-config.js`, `index.html`.

#### 2026-06-18 — Detalle de recaudación en modal (botón 🔍)
- El desglose de billetes, estado verificado, registrado por y hora de verificación se movieron a un modal accesible con el botón 🔍 en cada tipo de recaudación.
- Antes aparecían inline en la tarjeta del día, ahora solo se muestran al solicitar el detalle.
- Archivos modificados: `js/recaudacion.js`, `index.html`.

#### 2026-06-18 — Arqueo de caja: anticipos desde Supabase + mejoras de visualización
- El arqueo ahora lee los anticipos directamente desde Supabase (misma fuente que la sección Anticipos y Ausencias) en lugar de Google Sheets.
- En la columna de movimientos solo aparece la cantidad (`-1`) sin nombre ni paréntesis.
- La tabla de desglose esperado muestra fecha y estado ✓ arqueado / ⚠️ falta agregar por tipo, actualizado en tiempo real.
- Eliminado el botón "Realizar Arqueo" que ya no funcionaba.
- Archivos modificados: `js/arqueo.js`, `js/supabase-config.js`, `index.html`.

#### 2026-06-16 — Verificación de recaudaciones en caja (arqueo individual)
- Cada recaudación registrada (por tipo y fecha) muestra un botón "⚠️ Verificar" hasta que sea confirmada físicamente en caja.
- Al presionar "Verificar", se abre un modal con contador de billetes por denominación (igual que el arqueo de caja, pero individual por recaudación).
- El total contado se compara en tiempo real con el monto registrado; si no cuadra, se pide confirmación antes de guardar.
- Al confirmar, la recaudación queda marcada como "✅ Verificado" y se guarda el desglose de billetes en Supabase (`billetes` JSONB).
- Cambios en base de datos: columnas `arqueado` (bool), `billetes` (JSONB), `arqueado_at` (timestamp) en tabla `recaudaciones` del proyecto `lpulmjzboogixbdxxayo`.
- Archivos modificados: `index.html` (modal), `recaudacion.js` (badge + funciones), `supabase-config.js` (handler action=arqueado).

---

## Seguridad implementada

- PIN por responsable sincronizado con Google Sheets
- Clave de recuperación maestra para emergencias
- Cierre automático de sesión por inactividad
- Captura de geolocalización en cada operación crítica
- Device ID único por navegador (canvas fingerprinting)
- Auditoría de todas las acciones con snapshot antes/después
- Sanitización de HTML en notas para prevenir XSS
- Folio único (GUID) en canjes y auditoría para trazabilidad
