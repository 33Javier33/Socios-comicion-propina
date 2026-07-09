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

#### 2026-07-07 — Notas: adjuntar foto (visible también en propi.solicitada)
- En la sección **Notas** ahora se puede **adjuntar una foto** opcional a la nota (📷 Cámara / 🖼️ Foto). Se muestra en la nota, ampliable al tocarla.
- Las notas van a `notas_recaudacion` (el mismo tablero que el socio ve en **Soporte** de propi.solicitada), así que la **foto también le llega al socio**.
- La imagen se sube al bucket público `avatares` (carpeta `notas/`) y su URL se guarda en `notas_recaudacion.foto_url` (nueva columna).
- Archivos: `js/notas.js` (foto + render), `js/supabase-config.js` (addNote/getNotes con `foto_url`), `index.html` (botones de foto en Notas).

#### 2026-07-07 — Materiales: foto opcional del gasto, "comprado por" y montos con separador de miles
- **Foto opcional en el gasto:** al registrar un Gasto se puede adjuntar una foto (📷 Cámara / 🖼️ Galería) de la compra. Se sube al bucket público `avatares` (carpeta `materiales/`) y se muestra como miniatura en la lista, **ampliable al tocarla** (lightbox). Es opcional.
- **Comprado por:** campo opcional en el gasto para indicar quién realizó la compra cuando no fue el responsable. Se muestra en la lista.
- **Montos con separador de miles:** el campo Monto ahora formatea con puntos de mil mientras se escribe (`formatearInputMonto`).
- Migración: columnas `foto_url` y `comprador` en `materiales`; lectura/escritura actualizadas (`registrarMaterial`, `getAllMaterialesDesdeSheets`).
- Archivos: `index.html` (modal), `js/materiales.js` (foto + comprador + formato + render), `js/supabase-config.js` (handler + select).

#### 2026-07-07 — Informe "Montos Diarios" incluye Remanente por área
- El **informe de Montos Diarios** (sección Montos Recaudados) ahora agrega al final una tabla **"REMANENTE POR ÁREA"** (en vivo, proyectado si se cierra hoy), con el mismo criterio del banner: Part-Time aparte, GastosComisión excluida, Mesas+Cambistas unidas, y su total.
- Se refactorizó el cálculo a una función reutilizable `calcularRemanenteVivo()` (usada por el banner y el informe).
- Archivos: `js/anticipos.js` (`calcularRemanenteVivo`), `js/reports.js` (sección en `informeMontosDiarios`).

#### 2026-07-07 — Remanente en vivo: incluye Part-Time, excluye GastosComisión, une Mesas+Cambistas
- **Part-Time incluido:** el remanente en vivo ahora lee los días PT directo de `dias_pt` (evita que faltaran si `globalDiasPT` no había cargado). Sus remanentes suman al total y a su área.
- **GastosComisión excluida:** ese dinero se retira completo (no tiene remanente), así que sus socios ya no cuentan en el total ni aparecen como área.
- **Mesas + Mesas‑Cambistas unidas:** se muestran como una sola área "Mesas" (misma bolsa de remanente). También se fusionan variantes por mayúsculas/minúsculas.
- Nuevo helper `_remAreaNorm` (normaliza/excluye áreas).
- Archivos: `js/anticipos.js`.

#### 2026-07-07 — Remanente en vivo desglosado por área
- Bajo el remanente en vivo se muestran **chips por área** (Mesas, Máquinas, Bóveda…) con el remanente proyectado en vivo de cada una, ordenadas de mayor a menor. Se fusionan variantes por mayúsculas/minúsculas.
- Archivos: `index.html` (contenedor `gestionRemVivoAreas`), `js/anticipos.js` (acumulación por área en `gestion_cargarRemanenteVivo`).

#### 2026-07-07 — Remanente EN VIVO + período más legible en Anticipos y Ausencias
- El banner ahora distingue **💜 Remanente guardado (último cierre)** — la suma de `saldos_socio`, que solo cambia al cerrar el mes — de **📈 Remanente en vivo (si se cierra hoy)**, que **se recalcula día a día** con las recaudaciones actuales.
- El remanente en vivo suma, socio por socio, lo que le quedaría de remanente si se cerrara hoy (mismo cálculo que el detalle: alcance por puntos/días − anticipos + saldo anterior, redondeo al mil). Se calcula en el cliente con los datos ya cacheados (`fetchAllDataCached`) + `saldos_socio`, sin llamadas por socio.
- **Fecha/período más legible:** ahora se muestra el **período actual** en una etiqueta destacada (`📅 Período actual: 15 jun – 14 jul 2026`), calculado con `aq_calcularPeriodoActual` (ciclo 15‑a‑14), en vez de derivarlo de la última fecha guardada.
- Archivos: `index.html` (banner), `js/anticipos.js` (`gestion_cargarRemanenteVivo`, `_remFmtPeriodo`), `js/app-init.js` (llamada al entrar a Gestión).

#### 2026-07-07 — Subir foto del socio: elegir Cámara o Galería
- Al agregar/cambiar la foto desde Gestión ahora hay **dos opciones**: **📷 Cámara** (abre la cámara — `capture="environment"`) y **🖼️ Galería** (elegir una imagen existente), como en propi.solicitada.
- Archivos: `js/socios.js` (`gest_renderFoto` con dos inputs).

#### 2026-07-07 — Foto del socio en todas las secciones + subir foto desde Gestión
- **Foto ampliable:** helper reutilizable `avatarHTML(fotoUrl, nombre, size)` + **lightbox** (`verFotoGrande`) — al tocar cualquier avatar con foto se ve en grande. En `js/utils.js` + overlay en `index.html`.
- **La foto del socio ahora aparece** donde aparece el socio: Gestión de Socios (ampliable), **panel de detalle de Anticipos y Ausencias**, **Certificados** (búsqueda + ficha), **Mensajes** (lista y cabecera), **PIN Diario** y **Documentación** (búsqueda y ficha por socio).
- **Subir foto desde Gestión:** en el panel de detalle (junto al RUT) el responsable puede **📷 Agregar/Cambiar foto** del socio si no tiene. Sube al bucket público `avatares` (`dbSoc.storage`) y guarda `socios.foto_url` con el nuevo handler `guardarFotoSocio` (espejo de `guardarRutSocio`, con auditoría). Se refleja en cache y en propi.solicitada.
- Archivos: `js/utils.js`, `index.html`, `js/socios.js` (avatar card + `gest_renderFoto`/`gest_subirFoto`), `js/anticipos.js` (llamada en seleccionarSocio), `js/supabase-config.js` (handler), `js/mensajes-admin.js`, `js/diario-pins.js`, `js/documentacion.js`, `js/certificados.js`.

#### 2026-07-07 — Horarios: tipo de contrato (Planta/Part-Time) + intercambio de días
- Se trae el campo `contrato` de `socios` y se muestra el badge **Planta / Part-Time** en la ventana de calendarios del grupo, en la lista de asignación, en los integrantes del grupo y en la cabecera del socio.
- **Flexibilidad Part-Time:** el editor de día ahora tiene acciones rápidas **💼 Trabajar** / **🌴 Dejar libre** y un botón **🔁 Intercambiar con otro día** (elige otro día y se cruzan los turnos: trabaja un día que no le tocaba y se libera otro). Para Part-Time se muestra un aviso de "horario flexible".
- Todos siguen su ciclo; los cambios se guardan como excepciones por día (no alteran el ciclo del grupo).
- Archivos: `index2.html`.

#### 2026-07-07 — Horarios: sistema de vacaciones (v15 hábiles / v6 corridos)
- Se implementó el sistema de **vacaciones** de Turnos Pro en `index2.html`. En la ventana de calendarios del grupo, cada socio tiene un botón **"🏖️ Vacaciones"**.
- Dos tipos: **v15 = 15 días hábiles** (cuenta solo días hábiles, **saltando fines de semana y feriados chilenos**; marca toda la franja) y **v6 = 6 días adicionales** (corridos). Calcula la **fecha de regreso** (siguiente día hábil).
- Feriados de Chile calculados por año (fijos + Viernes/Sábado Santo vía cálculo de Pascua).
- Los días de vacaciones se marcan en el calendario (ámbar v15 / morado v6, con "VAC") y el socio los ve en su app. Se pueden **listar y quitar**.
- Implementación: se guardan en `horarios_vacaciones` (registro con inicio/regreso/días) y los días se marcan como excepciones con turnos base `t_vac15`/`t_vac6` (protegidos). Migración de tablas/turnos incluida.
- Archivos: `index2.html`.

#### 2026-07-07 — Horarios: ventana de calendarios por socio del grupo (comparar y editar)
- Al **pinchar un grupo** (o "📅 Ver calendarios") se abre una **ventana** con el **calendario de cada socio** del grupo, uno debajo del otro, para **compararlos** en el mismo mes (con navegación de mes).
- Desde ahí, **tocar un día** de cualquier socio abre el selector de turno y **cambia el turno de ese socio solo ese día** (excepción sobre el ciclo). Los días con cambio se marcan con borde ámbar.
- Reemplaza el calendario único por grupo por esta vista comparativa por socio.
- Nuevas funciones: `grupoCalendarios`, `gcalRender`, `gcalSocioCard`, `gcalDia`, `gcalPoner`, `gcalQuitar`.
- Archivos: `index2.html`.

#### 2026-07-07 — Horarios: comparar grupos con su calendario de turnos
- En la pestaña **Grupos** cada grupo se puede **desplegar** ("📅 Ver calendario") para ver un **mini calendario mensual de su rotación** (días libres en verde), además de sus socios (que ya se listaban).
- **Navegación de mes compartida** en el panel: al cambiar de mes se actualizan todos los calendarios abiertos, para **comparar** entre grupos cuándo descansa cada uno en el mismo mes.
- Nuevas funciones: `turnoDeGrupoEnFecha`, `miniCalGrupo`, `gruposMes`, `toggleGrupoCal`.
- Archivos: `index2.html`.

#### 2026-07-07 — Horarios: el botón "Instalar" se oculta si ya está instalada
- **Fix:** el botón "📲 Instalar app" ahora **arranca oculto** y solo aparece cuando el navegador confirma que se puede instalar (evento `beforeinstallprompt`) o en iPhone que aún no esté en modo app.
- Si la app ya está instalada / abierta en modo standalone (`display-mode: standalone` o `navigator.standalone`), el botón **no se muestra**. También se oculta tras instalarse (`appinstalled`).
- Archivos: `index2.html`.

#### 2026-07-07 — Horarios: PWA instalable (manifest + service worker)
- La app de Horarios (`index2.html`) ahora es **instalable** en celular y computador (PWA).
- Nuevos archivos: `manifest2.json`, `sw2.js` (Service Worker) e iconos `img/horarios-192.png` / `img/horarios-512.png` (calendario, generados a medida).
- **Aislamiento:** el Service Worker se registra con **scope `/index2`**, así **no afecta la app principal** (`index.html`, que sigue sin SW). Cachea `index2.html` para abrir rápido.
- Se agregaron metas de iOS (apple-touch-icon, standalone) y un botón **"📲 Instalar app"** en la pantalla inicial (usa el prompt nativo en Android/Chrome/Edge; en iPhone muestra las instrucciones de "Agregar a inicio").
- Archivos: `index2.html` (link manifest + metas + registro SW + botón instalar), `manifest2.json`, `sw2.js`, `img/`.

#### 2026-07-07 — Horarios: grupo solo-rotativo + días libres bien marcados
- El **editor de grupo** ahora es **solo la rotación**: nombre, color, **día en que comienza el ciclo (primer día libre)**, **días libres seguidos** y **días de trabajo**. Se quitó la selección de horarios/turnos y el editor manual del ciclo.
- En el **calendario del socio los días libres se ven bien marcados y legibles**: fondo verde, borde verde y texto **"LIBRE"** en negrita. Los días de trabajo se muestran como "Trabaja".
- Se guardan `dias_libres` y `dias_trabajo` en el grupo; el ciclo se arma con dos turnos base: **Libre** (verde) y **Trabaja** (azul), protegidos contra borrado.
- La lista de grupos muestra la rotación como chips: 🌴 N libres · 💼 M trabajo · Comienza FECHA, con sus integrantes.
- Migración: columnas `dias_libres`/`dias_trabajo` en `horarios_grupos`, turno `t_trabajo`, `t_libre` en verde.
- Archivos: `index2.html`.

#### 2026-07-07 — Horarios: ciclo rotativo por días libres + trabajo (como Turnos Pro)
- El editor de grupo ahora arma el ciclo como se piensa realmente: **"Primer día libre" (fecha base)** + **días libres seguidos** + **días de trabajo** + **turno de trabajo** → botón **"Generar rotación"**.
- Ejemplo confirmado: primer libre 7, 2 libres y 6 trabajo → libres 7‑8, trabajo 9‑14, libres 15‑16, trabajo 17‑22… (rota en bucle).
- Internamente genera el `ciclo` = [Libre×N, Trabajo×M]; se mantiene el editor manual (avanzado) para ajustes finos.
- Etiqueta del grupo actualizada a "Ciclo de N días · primer libre: FECHA".
- Archivos: `index2.html`.

#### 2026-07-07 — Horarios: elegir los socios desde el propio grupo
- En el editor de grupo (`index2.html`) ahora se **eligen los socios del grupo** con una lista de casillas (con buscador). Todos los socios marcados comparten el mismo ciclo, turnos y **días libres**.
- Al guardar, se aplican las asignaciones: los marcados pasan a este grupo (moviéndolos de otro si estaban), y los desmarcados que estaban antes se quitan.
- La lista de grupos muestra ahora los **nombres de los integrantes**. Si un socio ya está en otro grupo, la casilla lo indica.
- Sigue disponible también la pestaña "Asignar" (por socio). Archivos: `index2.html`.

#### 2026-07-07 — Horarios: importar JSON desde la app de Horarios (Turnos Pro)
- Nuevo botón **⬇️ Importar JSON** en el supervisor (pestaña Turnos) de `index2.html`.
- Acepta el archivo JSON exportado de Turnos Pro (`{ profiles:[ { name, shifts:[{id,name,color,startTime,endTime}], assignedShifts:{"YYYY-MM-DD":shiftId} } ] }`), por archivo o pegado.
- **Importa los turnos** (dedup por nombre, con su color y horario) y permite **mapear cada perfil a un socio**, trayendo su horario **día por día** como excepciones (`horarios_excepciones`).
- El calendario del socio ahora se muestra aunque no tenga grupo, si tiene turnos asignados por día (import).
- Archivos: `index2.html`.

#### 2026-07-07 — Nueva app separada de Horarios (`index2.html`)
- **App independiente** en el mismo repo (`index2.html`), no toca ni interfiere con la app principal (`index.html`). Se accede en `…/index2.html`.
- **Para el equipo de Mesas**: toma los socios cuya área contiene "mesa" desde la tabla `socios`.
- **Login con dos accesos**: "Soy Socio" (elige su nombre y crea/ingresa su PIN de 4 dígitos) y "Soy Supervisor" (PIN de 4 dígitos propio, lo crea la primera vez).
- **Modelo: ciclo rotativo por grupos.** El supervisor crea **turnos predefinidos** (nombre, color, horario), crea **grupos** con un **ciclo** de turnos (se repite en bucle desde una fecha base) y **asigna** socios a grupos. Cada socio ve su **calendario mensual** con sus turnos calculados desde el ciclo de su grupo.
- El supervisor también puede poner **excepciones por día** (cambiar el turno de un socio solo esa fecha) y **reiniciar el PIN** de un socio que lo olvidó.
- **Backend Supabase** (proyecto socios, RLS anon): tablas `horarios_turnos`, `horarios_grupos` (con `ciclo` jsonb + `fecha_base`), `horarios_socio_grupo`, `horarios_pins`, `horarios_excepciones`. Se sembraron 4 turnos de ejemplo (Mañana/Tarde/Noche/Libre).
- Un solo archivo autocontenido (HTML+CSS+JS inline, Tailwind CDN + supabase-js). Sin Service Worker.

#### 2026-07-07 — Ayuda: Cierre de Mes / "Estado de Cobros del Período" explicado a fondo
- Nueva categoría **🔒 Cierre de Mes** en el Centro de Ayuda con **6 entradas** que explican todo el panel de "Estado de Cobros del Período":
  - Qué es el panel y sus estados (⏳ Pendiente / 📩 En Sobre / 💵 Cobrado) y la etiqueta "X/Y · 💵N 📩M".
  - Qué hace **🔒 Cerrar** un socio (cálculo Alcance + Saldo anterior − Anticipos, redondeo a mil, remanente que pasa al próximo mes, recibo, cobra ahora / en sobre).
  - Significado de Pendiente/En Sobre/Cobrado y el botón 💵/📩.
  - Qué hace **"Archivar anticipos y empezar nuevo mes"** (mueve a pestaña de respaldo y limpia; irreversible).
  - Qué hace **"Reiniciar seguimiento"** (solo el marcado local, no datos).
  - Qué muestran los totales **ANTICIPOS (Nube)** y **REMANENTES** del banner.
- Archivos: `js/help.js` (entradas + ícono `cierre`), `index.html` (botón de categoría).

#### 2026-07-07 — Centro de Ayuda completo: todas las secciones documentadas
- Se amplió la base de conocimiento del **Centro de Ayuda** (`js/help.js`, `BASE_CONOCIMIENTO`) para que **no quede nada sin explicar**. Nuevas entradas:
  - **Egresos** (3): qué es un egreso pendiente, cómo procesarlo, cómo rechazarlo con motivo.
  - **Mensajes** (2): enviar mensaje privado a un socio, ver respuestas/no leídos.
  - **Documentación** (3): qué es, subir documento general, ver documentos por socio.
  - **Certificados** (1), **Dineros Sobrantes** (1), **PIN Diario** (1), **Carpetas** (1), **Notas de Administración** (1).
  - **Socios** (2): agregar/editar RUT (y para qué sirve), origen de la foto del socio.
- Nuevas **categorías/filtros** en el modal de ayuda: 💸 Egresos, 💬 Mensajes, 📁 Documentación, 📜 Certificados, 💵 Dineros, 🔑 PIN Diario, 🗂️ Carpetas, 📝 Notas. Íconos añadidos al mapa `catIcon`.
- Todo el contenido es buscable (título, tags, respuesta y pasos).
- Archivos: `js/help.js` (entradas + íconos), `index.html` (botones de categoría).

#### 2026-07-07 — Egresos: procesar o rechazar (con notificación al socio)
- En el aviso **"💸 Egresos pendientes"** cada solicitud ahora tiene dos botones: **✅ Procesar** y **✖️ Rechazar**.
- **Procesar**: abre el socio con el monto pre-cargado (igual que antes) y, al registrar el anticipo, marca la solicitud `PROCESADO` y le envía al socio un mensaje **"✅ Egreso procesado"**.
- **Rechazar**: pide el **motivo** (nota), marca la solicitud `RECHAZADO` guardando `motivo_rechazo`, y le envía al socio una **notificación privada** (apartado "Admin" de su app): **"❌ Egreso rechazado"** + el motivo. La tarjeta de "pendiente" desaparece de su app.
- Nueva columna `solicitudes_egreso.motivo_rechazo`. Reutiliza la tabla `mensajes_admin` para notificar.
- Archivos: `js/egresos.js` (botones + `egresos_rechazar` + notificación al procesar).

#### 2026-07-07 — Nueva sección "💬 Mensajes" (privado con cada socio)
- **Nueva pestaña** para que el responsable envíe **mensajes privados** a un socio. Se elige el socio de una lista con búsqueda, se abre la conversación y se escribe.
- El socio los recibe en la app propi.solicitada (Mensajes → **"Admin"**) y puede **responder**; las respuestas llegan aquí en **tiempo real**.
- La lista marca con **💬** a los socios con conversación y con **NUEVO** (y punto rojo en el nav) cuando hay respuestas sin leer.
- Fuente: nueva tabla `mensajes_admin` (proyecto socios `teemahksasdougehrcly`, `dbSoc`, RLS anon, realtime).
- Archivos: `js/mensajes-admin.js` (nuevo), `index.html` (pestaña + nav + script), `js/app-init.js` (branch en switchTab + init de aviso).

#### 2026-07-07 — Egresos pendientes: solicitudes de anticipo desde propi.solicitada
- **Nueva funcionalidad:** en **Anticipos y Ausencias** aparece un aviso **"💸 Egresos pendientes"** con las solicitudes que los socios envían desde la app propi.solicitada (botón "Solicitar Egreso").
- Al **tocar un aviso**, se selecciona automáticamente al socio y se **pre-carga el monto** solicitado en el formulario de anticipo, con una nota destacada. Al **registrar el anticipo**, la solicitud pasa a `PROCESADO`.
- La lista de socios muestra un badge **💸 EGRESO** en quienes tienen una solicitud pendiente. Actualización en **tiempo real** (postgres_changes sobre `solicitudes_egreso`).
- Fuente: nueva tabla `solicitudes_egreso` (proyecto socios `teemahksasdougehrcly`, cliente `dbSoc`, RLS anon).
- Archivos: `js/egresos.js` (nuevo), `index.html` (aviso + nota + script), `js/app-init.js` (carga en tab gestion), `js/anticipos.js` (marcar procesado tras registrar), `js/socios.js` (badge).

#### 2026-07-06 — Foto del socio visible en Gestión de Socios
- Las tarjetas de Gestión de Socios ahora muestran la **foto de perfil** del socio (si la subió en propi.solicitada) como avatar; si no tiene, muestra su inicial.
- Se lee de `socios.foto_url` (bucket público `avatares`). Nuevo mapeo `FotoUrl` en getSocios y `fotoUrl` en el objeto socio.
- Archivos: `js/supabase-config.js` (select+map), `js/api.js` (fotoUrl en socio), `js/socios.js` (avatar en tarjeta).

#### 2026-07-06 — Nueva sección "Documentación" (documentos generales + por socio)
- Nueva pestaña **📁 Documentación** con dos vistas:
  - **Generales**: subir/ver/eliminar documentos compartidos (ej. reglamento de la propina) en PDF/imagen, listos para descargar y enviar.
  - **Por socio**: buscar un socio y ver/descargar los documentos que él subió desde propi.solicitada (ej. su contrato).
- Almacenamiento en **Supabase Storage** (bucket privado `documentos`) + tabla de metadatos `documentos`. Ver usa URL firmada (1h). Cada subida/eliminación queda en auditoría.
- Archivos: nuevo `js/documentacion.js`; `index.html` (nav, tab, script), `js/app-init.js` (switchTab).

#### 2026-07-06 — RUT visible en las tarjetas de Gestión de Socios + editable en el modal Editar
- Cada tarjeta de socio ahora muestra el **RUT** ("🪪 RUT: …" o "🪪 RUT: — pendiente").
- El modal **Editar Socio** tiene un campo **RUT**: se pre-llena con el actual y al guardar se persiste en `socios.rut` (vía `guardarRutSocio`), sin pisar el resto de la edición (que va por el flujo normal).
- Complementa la edición inline del RUT en el detalle de Anticipos y Ausencias.
- Archivos: `js/socios.js` (RUT en tarjeta + pre-llenar edición), `index.html` (campo RUT en modal), `js/app-init.js` (guardar RUT al editar).

#### 2026-07-06 — RUT editable por el responsable en Gestión de Socios
- En el detalle del socio, el RUT ahora es **editable**: si no tiene, aparece "➕ Agregar RUT"; si tiene, un ✏️ para editarlo. Valida RUT chileno y lo formatea.
- Se guarda en `socios.rut` (acción `guardarRutSocio`, con auditoría "Registrar RUT"). Como es la misma columna que llena propi.solicitada, **al socio que ya tenga RUT (cargado por él o por el responsable) no le vuelve a aparecer el modal** en la app.
- Archivos: `js/socios.js` (helpers + editar/guardar RUT), `js/anticipos.js` (usar gest_renderRut), `js/supabase-config.js` (handler `guardarRutSocio`).

#### 2026-07-06 — RUT del socio: capturado en propi.solicitada, usado en Gestión y Certificados
- Nueva columna `socios.rut`. propi.solicitada pide el RUT al abrir (modal) y lo guarda ahí; se refleja automáticamente en socios-comicion.
- Gestión de Socios: el detalle del socio ahora muestra el **RUT** (o "— (pendiente)" si aún no lo cargó).
- Certificados: el certificado impreso ahora incluye el **RUT** del socio en el cuerpo ("…el(la) Sr./Sra. NOMBRE, RUT XX.XXX.XXX-X, ha percibido…"), tanto al generar como al reimprimir (busca el RUT actual del socio).
- Archivos modificados: `js/supabase-config.js` (select+map rut), `js/api.js` (rut en objeto socio), `index.html` (detRut), `js/anticipos.js` (mostrar rut), `js/certificados.js` (rut en certificado).

#### 2026-07-06 — Montos Recaudados: guardar y mostrar el responsable de la verificación
- Al verificar una recaudación en caja, ahora se guarda **quién** la verificó (responsable en sesión) en `recaudaciones.arqueado_por`.
- En el detalle (🔍) de un monto verificado se agregó la fila **"Verificado por ✅ [responsable]"**, junto a la hora que ya se mostraba.
- Archivos modificados: `js/recaudacion.js`, `js/supabase-config.js` (handler `arqueado` guarda `arqueado_por` + lectura `get` lo incluye).

#### 2026-07-06 — Desglose de Anticipos: fechas corregidas para coincidir con los anticipos
- Causa: 5 retiros antiguos tenían `fecha` en NULL, así que el desglose mostraba su fecha de creación (19/06) en vez de la fecha real del anticipo (18/06), no coincidiendo con Anticipos y Ausencias.
- Data fix: se rellenó la `fecha` de esos registros tomándola de la `firma` (que la lleva embebida: `SOC-…|YYYY-MM-DD|…`). Quedaron 4 en 18/06 y 1 en 19/06 (correctos).
- Red de seguridad en código: `_dsgFechaISO` ahora, si un registro no tiene `fecha`, extrae la fecha de la `firma` antes de caer a `created_at`, para que nunca vuelva a correrse un día.
- Archivo modificado: `js/desglose-anticipos.js` (+ actualización de datos en Supabase).

#### 2026-07-06 — Desglose de Anticipos: fechas/horas en zona horaria de Chile
- En el informe y las tarjetas, cuando un registro no tenía `fecha` propia se derivaba el día desde `created_at` en **UTC** (`.slice(0,10)`), corriéndose un día en registros de la noche. La hora se mostraba con la hora del dispositivo.
- Fix: helpers `_dsgFechaISO` / `_dsgFechaVis` / `_dsgHoraChile` que usan la `fecha` elegida tal cual y, en el fallback, convierten `created_at` a **America/Santiago**. Se aplicó en informe (orden y filas), tarjetas, filtro por fecha, reimpresión de boucher y modal de edición. Se corrigió `_dsgCalcPeriodoInicio` para no depender de `toISOString()`/UTC.
- Nota: los datos guardados estaban correctos (la `fecha` la elige el usuario); esto corrige la visualización/derivación por zona horaria.
- Archivo modificado: `js/desglose-anticipos.js`.

#### 2026-07-05 — Cierre por inactividad confiable en segundo plano (15 min)
- Antes el contador de inactividad restaba 1s por `setInterval`; en móvil, al dejar la app en segundo plano o fuera de la pestaña, el timer se congela y no descontaba el tiempo, así que la sesión no se cerraba tras 15 min fuera.
- Fix: el tiempo restante ahora se calcula con la **hora real** (`Date.now() - última actividad`), y se agregó verificación en `visibilitychange`/`focus`: al volver a la app, si ya pasaron 15 min desde la última actividad, cierra sesión de inmediato; si no, reanuda el contador con el tiempo real restante.
- Archivo modificado: `js/auth.js`. (Mismo patrón que ya usaba propi.solicitada; diario.propi también se corrigió.)

#### 2026-07-05 — Nueva sección "PIN Diario": gestionar los PIN de diario.propi
- Nueva pestaña **🔑 PIN Diario** para crear, cambiar, ver (recuperar) y quitar el **PIN de 4 dígitos** con que cada socio entra a la app **diario.propi**.
- Los PIN se guardan en Supabase (tabla nueva `diario_pins`, base de socios) y se comparten con diario.propi. Filtro por área (Mesas, Máquinas, Técnicos, Cambistas).
- La sección está **protegida por la clave de recuperación** (misma clave maestra del sistema). Cada cambio queda en Auditoría ("PIN Diario Actualizado/Eliminado").
- Contexto: diario.propi cambió su login a **área → socio → PIN** (se eliminó la clave fija `1234`); estos PIN se administran desde aquí.
- Archivos: nuevo `js/diario-pins.js`; modificados `index.html` (nav, tab, script) y `js/app-init.js`.

#### 2026-07-05 — Auditoría: columna "Referencia" con datos útiles + más contexto
- Antes la columna **Referencia** mostraba "—" en muchos eventos porque solo se armaba con folio o con una fecha dentro del detalle. Ahora `_audRef` deriva una referencia legible según el tipo de evento:
  - Acceso / Cierre de Sesión → método de ingreso + área (ej: "PIN personal · S.J").
  - Cambios de configuración/credenciales → parámetro afectado (PIN global, Clave recup., etc.).
  - Anticipos, recaudaciones, divisores, saldos, cierres → prefijo + fecha (ej: "ANT 24/06").
  - Certificados → socio afectado; folios de recibos/canjes tal cual.
- Además, los eventos genéricos ahora muestran una línea de **contexto** (🔑 método de ingreso · 📍 área) para que se entienda mejor qué se está viendo. La mejora aplica también al informe impreso de auditoría.
- Archivo modificado: `js/auditoria.js`.

#### 2026-07-05 — Renombrar "Escalamientos" → "Próximos a subir de puntaje"
- En Gestión de Socios se renombró el término técnico "Escalamiento(s)" por uno más claro: el cuadro del panel ahora dice **"Próximos a subir"** y el panel **"Socios próximos a subir de puntaje"**.
- Se actualizaron también textos de ayuda y el título de la guía. Los nombres internos de funciones/IDs (`verificarEscalamientos`, `panelEscalamientos`, etc.) se mantienen para no romper la lógica. La guía conserva el tag de búsqueda "escalamiento" para que siga siendo encontrable.
- Archivos modificados: `index.html`, `js/socios.js`, `js/help.js`.

#### 2026-07-05 — Informe de Desglose de Anticipos a dos columnas (menos hojas)
- El informe de anticipos ahora imprime en **dos columnas por hoja** (43 filas por columna → 86 por hoja), con numeración secuencial, reduciendo a la mitad las hojas a imprimir.
- Se quitó la columna vacía y el espacio horizontal desperdiciado; fuentes y celdas más compactas. Paginación en bloques de 86 con `page-break-after`.
- Archivo modificado: `js/desglose-anticipos.js` (función `dsg_informe`).

#### 2026-07-02 — Desglose de Anticipos: editar (con PIN personal), reimprimir e informe
- **Editar**: cada tarjeta de desglose tiene un botón ✏️ que abre un modal para corregir la fecha y el detalle de billetes (recalcula el total automáticamente). Para guardar se exige el **PIN personal** del responsable en sesión (validado contra `credencialesCache[ini|area]`). La clave de recuperación, la clave/PIN global y el PIN de ingreso **no** permiten editar. Si el responsable no tiene PIN personal configurado, no puede editar. Cada edición queda en auditoría (`Editar Desglose Anticipo`, con quién editó).
- **Reimprimir**: botón 🖨 en cada tarjeta que reimprime el boucher del anticipo (reutiliza `generarBoucherAnticipo`).
- **Informe**: botón 📄 en el encabezado que genera un informe imprimible de los anticipos filtrados (N°, socio, fecha, responsable, monto) con total general, al estilo del Detalle de Anticipos.
- Nuevo handler Supabase `actualizarRetiroAnticipo` (actualiza `retiros_anticipos` por `firma`).
- Archivos modificados: `js/desglose-anticipos.js`, `js/supabase-config.js`, `index.html`.

#### 2026-07-02 — Nueva sección: Dineros Sobrantes (ingresos y retiros)
- Se agregó la sección **💵 Dineros Sobrantes**, con la misma estructura que Materiales pero con tipos **Ingreso** y **Retiro**.
- Incluye: resumen anual (ingresos/retiros/balance), desglose mes a mes (períodos 15→14), navegación por año y por período, lista de movimientos y modal para agregar registros.
- Persistencia 100% en Supabase (tabla nueva `dineros_sobrantes` en la base de socios, con RLS activado y política permisiva para la clave anónima). Acciones: `registrarDinero`, `borrarDinero`, `getAllDineros`.
- Archivos: nuevo `js/dineros.js`; modificados `index.html` (nav, tab, modal, script), `js/app-init.js` (switchTab), `js/supabase-config.js` (handlers).

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
