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

## Seguridad implementada

- PIN por responsable sincronizado con Google Sheets
- Clave de recuperación maestra para emergencias
- Cierre automático de sesión por inactividad
- Captura de geolocalización en cada operación crítica
- Device ID único por navegador (canvas fingerprinting)
- Auditoría de todas las acciones con snapshot antes/después
- Sanitización de HTML en notas para prevenir XSS
- Folio único (GUID) en canjes y auditoría para trazabilidad
