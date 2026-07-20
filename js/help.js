// ════════════════════════════════════════════════════════════
// CENTRO DE AYUDA COMPLETA
// ════════════════════════════════════════════════════════════
const BASE_CONOCIMIENTO = [

    // ═══════════════════════════════════════════════════════
    // SOCIOS
    // ═══════════════════════════════════════════════════════
    { id:'s1', cat:'socios', titulo:'¿Qué es la sección Gestión de Socios?', tags:['socios','gestión','tarjetas','áreas','dashboard'],
      resp:'Es el <strong>panel central</strong> del sistema. Aquí ves todos los socios del Fondo Solidario organizados por área, con sus puntos, contrato y estado.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">📊 Así se ve el panel de socios</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
          <div style="background:white;border-radius:8px;padding:8px 12px;border-bottom:3px solid #3498db;text-align:center;flex:1;min-width:70px;">
            <div style="font-weight:900;font-size:1.1em;">42</div><div style="font-size:0.65em;color:#7f8c8d;">TOTAL SOCIOS</div>
          </div>
          <div style="background:white;border-radius:8px;padding:8px 12px;border-bottom:3px solid #27ae60;text-align:center;flex:1;min-width:70px;">
            <div style="font-weight:900;font-size:1.1em;">384</div><div style="font-size:0.65em;color:#7f8c8d;">TOTAL PUNTOS</div>
          </div>
          <div style="background:white;border-radius:8px;padding:8px 12px;border-bottom:3px solid #f39c12;text-align:center;flex:1;min-width:70px;">
            <div style="font-weight:900;font-size:1.1em;">28</div><div style="font-size:0.65em;color:#7f8c8d;">S. PLANTA</div>
          </div>
          <div style="background:white;border-radius:8px;padding:8px 12px;border-bottom:3px solid #9b59b6;text-align:center;flex:1;min-width:70px;">
            <div style="font-weight:900;font-size:1.1em;">14</div><div style="font-size:0.65em;color:#7f8c8d;">S. PART-TIME</div>
          </div>
        </div>
        <div style="background:white;border-radius:8px;padding:8px 12px;border:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span>▶</span>
            <strong style="font-size:0.9em;">Mesas Planta</strong>
          </div>
          <div style="display:flex;gap:6px;">
            <span class="ayuda-badge" style="background:#eee;color:#555;">18 Soc.</span>
            <span class="ayuda-badge" style="background:#dbeafe;color:#2563eb;">Pts: 180</span>
          </div>
        </div>
      </div>`,
      pasos:['Los 6 números del panel (Total Socios, Total Puntos, Pts Planta, S. Planta, S. Part-Time, Próximos a subir) se actualizan solos al cargar','Presiona el nombre de cada área para desplegar las tarjetas de sus socios','Cada tarjeta muestra nombre, contrato, puntos actuales y botones de acción','El botón 🏆 Próximos a subir te avisa quién sube puntos este mes o el próximo'],
      nota:'Los socios con fecha de inicio de puntos en el futuro aparecen en la lista pero NO suman al total de puntos.' },

    { id:'s2', cat:'socios', titulo:'¿Cómo suben de puntaje los socios (aumento de puntos)?', tags:['escalamiento','aumento','subir','puntaje','puntos','años','tope','antigüedad'],
      resp:'Cada año de antigüedad en el casino suma <strong>+2 puntos</strong> al socio. La mayoría comienza en <strong>4 puntos base</strong>; <strong>Bóveda comienza en 2</strong>. Cada área tiene un tope que no se puede superar.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">⭐ Topes por área</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <div class="ayuda-mini-card"><strong>🎰 Mesas</strong><div style="color:#2563eb;font-weight:900;">Máx 20 pts</div></div>
          <div class="ayuda-mini-card"><strong>🎮 Máquinas</strong><div style="color:#7c3aed;font-weight:900;">Máx 12 pts</div></div>
          <div class="ayuda-mini-card"><strong>🔧 Técnicos</strong><div style="color:#7f8c8d;font-weight:900;">Máx 12 pts</div></div>
          <div class="ayuda-mini-card"><strong>🏦 Bóveda</strong><div style="color:#27ae60;font-weight:900;">2 → Máx 10 pts</div></div>
          <div class="ayuda-mini-card"><strong>💱 Cambistas</strong><div style="color:#9b59b6;font-weight:900;">Máx 8 pts</div></div>
          <div class="ayuda-mini-card"><strong>📋 G. Comisión</strong><div style="color:#607d8b;font-weight:900;">Máx 1 pt</div></div>
        </div>
        <div class="ayuda-formula" style="margin-top:8px;">Puntos = base + (años × 2) → hasta el tope del área &nbsp;·&nbsp; base 4 (Bóveda: 2)</div>
      </div>`,
      pasos:['El sistema calcula los puntos automáticamente según la fecha de ingreso','Cuando un socio cumple años en el trabajo, aparece en el panel 🏆 Próximos a subir','Si ya llegó al tope de su área, el recibo muestra "TOPE MÁXIMO"','La fecha de inicio de puntos puede ser diferente a la de ingreso (ej: si tuvo un período sin puntos)'],
      nota:'El 🏆 en el panel muestra quiénes suben de puntaje este mes, el mes pasado y el próximo.' },

    { id:'s3', cat:'socios', titulo:'¿Cómo agrego o edito un socio?', tags:['agregar','nuevo','socio','registrar','editar'],
      resp:'Usa el botón <strong>➕ azul</strong> en la esquina inferior derecha para agregar. Para editar, abre la tarjeta del socio y usa el botón ✏️.',
      pasos:['Presiona el botón ➕ flotante azul en Gestión de Socios','Completa: nombre, apellido, área, tipo de contrato, fecha de ingreso','Si la fecha de inicio de puntos es diferente a la de ingreso, indícala también','Presiona Guardar — el socio aparece en su área automáticamente'],
      nota:'Los campos de fecha son importantes: determinan cuántos puntos tiene el socio y cuándo le toca subir.' },

    // ═══════════════════════════════════════════════════════
    // ANTICIPOS
    // ═══════════════════════════════════════════════════════
    { id:'a1', cat:'anticipos', titulo:'¿Cómo registro un anticipo de propina?', tags:['anticipo','registrar','adelanto','propina','monto'],
      resp:'Un anticipo es un <strong>adelanto de propina</strong> que el socio pide durante el mes. Se descuenta automáticamente de su pago al hacer el cierre.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">💰 Formulario de anticipo</div>
        <div class="ayuda-mini-card">
          <div style="font-size:0.8em;color:#7f8c8d;margin-bottom:4px;">Socio seleccionado:</div>
          <div style="font-weight:700;margin-bottom:10px;">Juan Pérez — Mesas Planta</div>
          <div style="display:grid;gap:6px;">
            <div><div style="font-size:0.7em;color:#7f8c8d;text-transform:uppercase;font-weight:700;">Monto ($)</div>
              <div style="border:1px solid #ddd;border-radius:6px;padding:6px 10px;margin-top:2px;font-weight:800;">50.000</div></div>
            <div><div style="font-size:0.7em;color:#7f8c8d;text-transform:uppercase;font-weight:700;">Fecha</div>
              <div style="border:1px solid #ddd;border-radius:6px;padding:6px 10px;margin-top:2px;">19/03/2026</div></div>
            <div><div style="font-size:0.7em;color:#7f8c8d;text-transform:uppercase;font-weight:700;">Responsable</div>
              <div style="border:1px solid #ddd;border-radius:6px;padding:6px 10px;margin-top:2px;">N.M (S.J)</div></div>
            <span class="ayuda-mini-btn" style="background:#3498db;color:white;width:100%;text-align:center;">Registrar Anticipo</span>
          </div>
        </div>
      </div>`,
      pasos:['Ve a la pestaña <strong>"Anticipos y Ausencias"</strong>','En el panel izquierdo, escribe el nombre del socio y haz clic en él','Completa el monto (sin puntos ni comas, el sistema los formatea solo)','Selecciona la fecha y el responsable del movimiento','Presiona "Registrar Anticipo" — aparece confirmación verde'],
      nota:'El monto queda en el historial del socio y se descuenta de su Saldo Real automáticamente.' },

    { id:'a2', cat:'anticipos', titulo:'¿Cómo registro una ausencia?', tags:['ausencia','falta','descuento','planta','inasistencia'],
      resp:'Las ausencias aplican <strong>solo a socios Planta</strong>. Cada ausencia descuenta el valor del punto de esa noche específica del cálculo del socio.',
      pasos:['Selecciona un socio con contrato Planta (aparece la sección "Reportar Ausencia")','Selecciona el motivo: Enfermedad, Permiso, Falta injustificada u Otro','Indica la fecha de la ausencia','Presiona "Reportar Ausencia"'],
      nota:'Los socios Part-Time NO tienen ausencias — su cálculo se basa en los días marcados en el calendario.' },

    { id:'a3', cat:'anticipos', titulo:'¿Cómo edito o elimino un anticipo?', tags:['eliminar','borrar','anticipo','error','corregir','editar','modificar'],
      resp:'En la tabla de historial del socio puedes <strong>editar</strong> (botón ✏️) o <strong>eliminar</strong> (mantén presionado 1 segundo) cualquier anticipo.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">✏️ Editar o 🗑️ Eliminar un anticipo</div>
        <div class="ayuda-mini-card">
          <div style="display:grid;grid-template-columns:auto 1fr auto auto;gap:8px;align-items:center;font-size:0.82em;">
            <div>19/03</div><div style="color:#2980b9;font-weight:700;">Anticipo</div><div style="font-size:0.75em;color:#555;">Adelanto</div>
            <div style="display:flex;gap:4px;align-items:center;">
              <span style="color:#e74c3c;font-weight:700;">-$50.000</span>
              <span style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);color:#b45309;border-radius:6px;padding:2px 6px;font-size:0.85em;font-weight:700;">✏️</span>
            </div>
          </div>
          <div style="margin-top:8px;padding:6px;background:#fff3cd;border-radius:6px;font-size:0.75em;text-align:center;">
            👆 Mantén presionado 1 seg → eliminar · ✏️ → editar fecha, monto y responsable
          </div>
        </div>
      </div>`,
      pasos:['Selecciona el socio en Anticipos y Ausencias','En la tabla inferior localiza el anticipo','Para <strong>editar</strong>: presiona el botón ✏️ — cambia fecha, monto o responsable y guarda','Para <strong>eliminar</strong>: mantén presionado 1 segundo y confirma en el diálogo'],
      nota:'⚠️ La eliminación no se puede deshacer. Los cambios se sincronizan automáticamente en Supabase.' },

    { id:'a4', cat:'anticipos', titulo:'¿Qué es el Detalle de Anticipos (informe)?', tags:['detalle','informe','anticipos','reporte','imprimir','lista'],
      resp:'El botón <strong>📋 Detalle Anticipos</strong> genera un informe A4 completo con todos los anticipos del período, listo para imprimir o guardar como PDF.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">📋 Vista del informe generado</div>
        <div class="ayuda-mini-card" style="font-size:0.8em;">
          <div style="background:#c0392b;color:white;padding:4px 8px;border-radius:4px;font-weight:700;display:flex;justify-content:space-between;margin-bottom:6px;">
            <span>TOTAL EGRESOS</span><span>$ 1.529.000</span>
          </div>
          <div style="font-size:0.75em;text-align:center;color:#555;margin-bottom:6px;">PERÍODO 15/MAR/2026 AL 14/ABR/2026</div>
          <div style="display:grid;grid-template-columns:20px 1fr 30px 30px 60px 70px;gap:4px;font-size:0.7em;background:#2c3e50;color:white;padding:3px 4px;border-radius:3px;">
            <div>N°</div><div>NOMBRE</div><div>ÁREA</div><div>RESP</div><div>FECHA</div><div style="text-align:right;">VALOR</div>
          </div>
          <div style="display:grid;grid-template-columns:20px 1fr 30px 30px 60px 70px;gap:4px;font-size:0.7em;padding:3px 4px;">
            <div>1</div><div>JOSE OYARZO</div><div>SJ</div><div>P.M</div><div>17/MAR</div><div style="text-align:right;">$5.000</div>
          </div>
        </div>
      </div>`,
      pasos:['Presiona el botón "📋 Detalle Anticipos" en el banner morado de Anticipos y Ausencias','El sistema consulta automáticamente todos los socios (puede tardar unos segundos)','Se abre el informe en pantalla — presiona Imprimir en tu dispositivo','Para guardar como PDF: en el diálogo de impresión elige "Guardar como PDF"'],
      nota:'El nombre del archivo incluye el mes y año automáticamente para no confundirlo con otros.' },

    // ═══════════════════════════════════════════════════════
    // PUNTOS Y CÁLCULOS
    // ═══════════════════════════════════════════════════════
    { id:'p1', cat:'puntos', titulo:'¿Qué es el Cierre de Punto y cómo se calcula?', tags:['cierre','punto','cálculo','propina','valor','formula'],
      resp:'El Cierre de Punto es el <strong>total en dinero que le corresponde a cada socio</strong> según sus puntos. Depende de lo recaudado cada noche.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">📐 Fórmula paso a paso</div>
        <div class="ayuda-formula">1. Punto Noche = Total Noche ÷ Divisor</div>
        <div class="ayuda-formula">2. Suma Puntos Noche = Σ de todos los Puntos Noche del mes</div>
        <div class="ayuda-formula">3. Cierre de Punto = Suma Puntos Noche × Puntos del Socio</div>
        <div class="ayuda-mini-card" style="margin-top:6px;">
          <div style="font-size:0.8em;color:#555;">Ejemplo: Suma Puntos Noche = $16.591 · Socio con 8 puntos</div>
          <div style="font-weight:900;color:#27ae60;font-size:1.1em;margin-top:4px;">Cierre de Punto = $132.728</div>
        </div>
      </div>`,
      pasos:['La Suma de Puntos Noche se ve en la sección "Montos Recaudados" → tarjeta "Total Puntos"','Si un día NO tiene divisor, no suma (evita inflación)','El Cierre de Punto aparece en el recibo impreso de cada socio'],
      nota:'El divisor de cada noche lo define la comisión directiva. Es crucial ingresarlo correctamente.' },

    { id:'p2', cat:'puntos', titulo:'¿Cómo se calcula el pago final de un socio?', tags:['saldo','cálculo','real','anticipo','remanente','pagar','cobrar'],
      resp:'El sistema calcula automáticamente todo cuando seleccionas un socio:',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">💵 Panel de saldos del socio</div>
        <div class="ayuda-mini-card">
          <div class="ayuda-mini-row"><span>Saldo Anterior</span><span>$643</span></div>
          <div class="ayuda-mini-row"><span>Alcance Teórico (Cierre de Punto)</span><span>$132.728</span></div>
          <div class="ayuda-mini-row"><span>Total Anticipos</span><span style="color:#e74c3c;">-$33.500</span></div>
          <div class="ayuda-mini-row" style="font-weight:700;"><span>Saldo Real</span><span>$99.871</span></div>
          <div style="margin-top:8px;padding:8px;background:#e8f8ee;border-radius:6px;text-align:center;">
            <div style="font-size:0.7em;color:#555;">TOTAL A COBRAR</div>
            <div style="font-size:1.4em;font-weight:900;color:#27ae60;">$ 99.000</div>
            <div style="font-size:0.75em;color:#9b59b6;">Remanente: $871 → pasa al próximo mes</div>
          </div>
        </div>
      </div>`,
      pasos:['<strong>Saldo Real</strong> = Cierre de Punto + Saldo Anterior − Total Anticipos','<strong>A Pagar</strong> = Saldo Real redondeado hacia abajo al múltiplo de $1.000 más cercano','<strong>Remanente</strong> = Saldo Real − A Pagar → este monto queda como Saldo Anterior del próximo mes','El botón "Cerrar Mes" guarda el Remanente oficialmente'],
      nota:'Siempre haz clic en "Cerrar Mes" al terminar el período para que el remanente pase correctamente al siguiente.' },

    // ═══════════════════════════════════════════════════════
    // RECAUDACIÓN
    // ═══════════════════════════════════════════════════════
    { id:'r1', cat:'recaudacion', titulo:'¿Cómo ingreso la recaudación de una noche?', tags:['recaudación','ingresar','noche','monto','nueva'],
      resp:'Usa el botón <strong>➕ Nueva Recaudación</strong> que está en la parte superior de la sección Montos Recaudados.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">➕ Formulario Nueva Recaudación</div>
        <div class="ayuda-mini-card" style="font-size:0.82em;">
          <div style="margin-bottom:6px;"><div style="color:#7f8c8d;font-size:0.75em;text-transform:uppercase;">Área / Tipo</div>
            <div style="border:1px solid #ddd;border-radius:5px;padding:5px 8px;margin-top:2px;">🎰 Sala de Juegos (Mesas)</div></div>
          <div style="margin-bottom:6px;"><div style="color:#7f8c8d;font-size:0.75em;text-transform:uppercase;">Fecha de la Noche</div>
            <div style="border:1px solid #ddd;border-radius:5px;padding:5px 8px;margin-top:2px;">29/03/2026</div></div>
          <div style="margin-bottom:6px;"><div style="color:#7f8c8d;font-size:0.75em;text-transform:uppercase;">Monto Recaudado ($)</div>
            <div style="border:2px solid #3498db;border-radius:5px;padding:5px 8px;margin-top:2px;font-weight:800;">837.000</div></div>
          <div><div style="color:#7f8c8d;font-size:0.75em;text-transform:uppercase;">Divisor <span style="font-style:italic;">(opcional)</span></div>
            <div style="border:1px solid #ddd;border-radius:5px;padding:5px 8px;margin-top:2px;color:#aaa;">Ej: 800 — dejar vacío si no se sabe</div></div>
        </div>
      </div>`,
      pasos:['Presiona "➕ Nueva Recaudación" en la barra superior','Selecciona el tipo: Sala de Juegos, Efectivo MDA, Tarjeta MDA o Bóveda','Ingresa la fecha de la noche y el monto','El divisor es opcional — si no lo sabes, déjalo vacío y lo ingresas después desde la tarjeta del día','Presiona Guardar','Una vez ingresada, presiona <strong>⚠️ Verificar</strong> en la tarjeta del tipo para confirmar que el dinero fue ingresado físicamente a caja (conteo de billetes). Queda marcada como <strong>✅ En caja</strong>','Presiona 🔍 en cualquier tipo para ver el detalle: quién registró, cuándo se verificó y el desglose de billetes'],
      nota:'Puedes ingresar varios tipos para el mismo día (ej: Mesas + Efectivo MDA + Bóveda). Cada uno se verifica por separado en caja.' },

    { id:'r2', cat:'recaudacion', titulo:'¿Qué es el divisor y por qué es crítico?', tags:['divisor','punto noche','cálculo','inflación','sin divisor'],
      resp:'El divisor define cuánto vale un punto esa noche. <strong>Sin divisor correcto, los cálculos se inflan</strong> y los socios recibirían montos incorrectos.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">⚠️ Comparación con y sin divisor</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <div class="ayuda-mini-card">
            <div style="color:#27ae60;font-weight:700;font-size:0.8em;">✅ CON divisor 800</div>
            <div class="ayuda-formula" style="margin:4px 0;">$837.000 ÷ 800</div>
            <div style="font-weight:900;color:#27ae60;">= $1.046 / pto</div>
          </div>
          <div class="ayuda-mini-card">
            <div style="color:#e74c3c;font-weight:700;font-size:0.8em;">❌ SIN divisor (usa 1)</div>
            <div class="ayuda-formula" style="margin:4px 0;">$837.000 ÷ 1</div>
            <div style="font-weight:900;color:#e74c3c;">= $837.000 / pto 💥</div>
          </div>
        </div>
        <div style="margin-top:6px;padding:6px;background:#fee2e2;border-radius:6px;font-size:0.78em;text-align:center;color:#c0392b;">
          ⚠️ Los días sin divisor muestran indicador rojo y NO suman al total
        </div>
      </div>`,
      pasos:['Si no ingresas divisor al crear, la tarjeta muestra ⚠️ indicador rojo','Ese día no suma al Cierre de Punto (protección contra inflación)','Cuando conozcas el divisor, ingrésalo en el campo de la tarjeta del día','El sistema recalcula automáticamente al guardar'],
      nota:'El divisor lo define la comisión directiva según el criterio de cada mes. Consúltalo siempre antes de cerrar.' },

    { id:'r3', cat:'recaudacion', titulo:'¿Cómo uso los filtros de Montos Recaudados?', tags:['filtro','buscar','tipo','divisor','recaudación'],
      resp:'Los filtros te permiten encontrar días específicos o ver solo un tipo de recaudación.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">🔍 Panel de filtros</div>
        <div class="ayuda-mini-card" style="font-size:0.8em;">
          <div style="border:1px solid #3498db;border-radius:6px;padding:5px 8px;margin-bottom:6px;color:#aaa;">🔍 Buscar: "Lunes" o "15/03"...</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <span style="padding:3px 8px;border-radius:12px;background:#3498db;color:white;font-size:0.75em;font-weight:700;">Todos</span>
            <span style="padding:3px 8px;border-radius:12px;border:1px solid #ddd;font-size:0.75em;">🎰 Sala de Juegos</span>
            <span style="padding:3px 8px;border-radius:12px;border:1px solid #ddd;font-size:0.75em;">💵 Efectivo MDA</span>
            <span style="padding:3px 8px;border-radius:12px;border:1px solid #e74c3c;color:#e74c3c;font-size:0.75em;">⚠️ Sin divisor</span>
            <span style="padding:3px 8px;border-radius:12px;border:1px solid #27ae60;color:#27ae60;font-size:0.75em;">✅ Con divisor</span>
          </div>
        </div>
      </div>`,
      pasos:['<strong>Busca por texto:</strong> escribe "Viernes", "15/03" o un monto para filtrar tarjetas','<strong>Filtro por tipo:</strong> toca un chip (Sala de Juegos, MDA, Bóveda) para ver solo ese tipo dentro de cada tarjeta','<strong>⚠️ Sin divisor:</strong> muestra solo los días que aún necesitan divisor — ideal para revisión','<strong>✅ Con divisor:</strong> muestra solo los días ya completos','Puedes combinar búsqueda de texto + tipo al mismo tiempo','Presiona "✕ Limpiar" para restablecer todos los filtros'],
      nota:'Cuando hay un filtro activo, un contador muestra cuántos días son visibles vs el total.' },

    // ═══════════════════════════════════════════════════════
    // ARQUEO
    // ═══════════════════════════════════════════════════════
    { id:'aq1', cat:'arqueo', titulo:'¿Qué es el Arqueo de Caja y cómo se hace?', tags:['arqueo','caja','conteo','efectivo','cuadrar','diferencia'],
      resp:'El Arqueo es el <strong>conteo físico del efectivo</strong> en caja para verificar que el dinero real coincida con lo que el sistema espera.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">💰 Resultado del arqueo</div>
        <div class="ayuda-mini-card">
          <div class="ayuda-mini-row"><span>Total Caja (contado)</span><span style="font-weight:700;">$1.250.000</span></div>
          <div class="ayuda-mini-row"><span>Total Esperado</span><span style="font-weight:700;">$1.250.000</span></div>
          <div class="ayuda-mini-row" style="font-weight:700;"><span>Diferencia</span><span>$0</span></div>
          <div style="margin-top:8px;padding:6px 10px;background:#d1fae5;border:1px solid #34d399;border-radius:6px;text-align:center;font-weight:700;color:#065f46;">
            ✅ CUADRADO
          </div>
        </div>
      </div>`,
      pasos:['Presiona "💵 Conteo" en la barra del arqueo','Ingresa cuántos billetes/monedas hay de cada denominación ($20.000, $10.000, etc.) — el total se calcula automáticamente','Revisa la tabla de Recaudación Esperada: cada tipo (TarjetaMDA, EfectivoMDA, SalaDeJuegos) muestra si está <strong>✓ arqueado</strong> o <strong>⚠️ falta agregar</strong> según lo verificado en Montos Recaudados','Si hay diferencia en el resultado: revisa retiros y anticipos ingresados antes de cerrar','Guarda con ☁️ Guardar para no perder el progreso entre dispositivos'],
      nota:'Verde = cuadrado. Amarillo = sobrante. Rojo = faltante. El estado por tipo (✓ arqueado / ⚠️ falta agregar) se actualiza automáticamente al verificar entradas en Montos Recaudados.' },

    { id:'aq2', cat:'arqueo', titulo:'¿Cómo funciona el Canje a Bóveda?', tags:['canje','bóveda','cambio','billetes','comprobante'],
      resp:'El <strong>💱 Canje</strong> se usa cuando necesitas cambiar billetes de una denominación a otra, solicitándolo a Bóveda. Genera un comprobante oficial.',
      pasos:['Presiona "💱 Canje" en la barra del arqueo','Ingresa cuántos billetes de cada denominación necesitas (sin 0 al inicio — deja el campo vacío si no aplica)','El total se calcula automáticamente','Presiona "Imprimir Canje" — elige 1 copia o 2 (con corte)','El comprobante tiene firmas: Solicitante y Bóveda'],
      nota:'El canje NO afecta los cálculos del arqueo ni la caja. Es solo informativo para Bóveda.' },

    // ═══════════════════════════════════════════════════════
    // IMPRESIÓN
    // ═══════════════════════════════════════════════════════
    { id:'i1', cat:'impresion', titulo:'¿Cómo imprimo el recibo de un socio?', tags:['imprimir','recibo','socio','térmica','comprobante','papel'],
      resp:'Con el socio seleccionado en Anticipos y Ausencias, presiona el botón <strong>🖨️ Imprimir Recibo</strong>. Genera un recibo para impresora térmica de 80mm.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">🖨️ Contenido del recibo</div>
        <div class="ayuda-mini-card" style="font-size:0.78em;font-family:monospace;">
          <div style="text-align:center;border:1px solid #000;padding:4px;margin-bottom:4px;">
            <div style="font-weight:700;">FONDO DE SOLIDARIDAD</div>
            <div>CASINO DE PTO. VARAS</div>
            <div style="font-size:0.8em;">LEY 17312 DEL 29/07/70</div>
          </div>
          <div style="font-weight:700;text-align:center;border-bottom:1px solid #000;padding-bottom:2px;margin-bottom:4px;">DATOS</div>
          <div>NOMBRE: Juan Pérez</div>
          <div>ÁREA: Mesas · PLANTA</div>
          <div>PUNTOS: 8 · SUBE: 15 DE MAR</div>
          <div style="font-weight:700;text-align:center;border-bottom:1px solid #000;padding:2px 0;margin:4px 0;">CIERRE PUNTO</div>
          <div>VALOR PUNTO: $16.591</div>
          <div style="font-weight:700;text-align:center;font-size:1.1em;border:2px solid #000;padding:4px;margin-top:4px;">TOTAL A COBRAR<br/>$ 99.000</div>
        </div>
      </div>`,
      pasos:['Ve a "Anticipos y Ausencias" y selecciona el socio','Espera que carguen todos sus datos (saldos, historial)','Presiona "🖨️ Imprimir Recibo"','Elige: <strong>OK</strong> → una copia | <strong>Cancelar</strong> → dos copias con línea de corte','Si eliges una copia, indica si es para Admin o para el Socio','Se abre el diálogo de impresión de tu dispositivo'],
      nota:'Impresora recomendada: térmica de 80mm (tickets). También puedes "Guardar como PDF" desde el diálogo de impresión.' },

    // ═══════════════════════════════════════════════════════
    // CONFIGURACIÓN — SECCIÓN COMPLETA Y DETALLADA
    // ═══════════════════════════════════════════════════════
    { id:'c1', cat:'config', titulo:'¿Para qué sirve la sección Configuración?', tags:['configuración','config','ajustes','opciones'],
      resp:'La sección <strong>⚙️ Configuración</strong> es el panel de administración del sistema. Desde aquí controlas la seguridad, los responsables autorizados y las URLs de conexión.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">⚙️ Lo que puedes configurar</div>
        <div style="display:grid;gap:5px;">
          <div class="ayuda-mini-card" style="display:flex;align-items:center;gap:8px;"><span style="font-size:1.2em;">🔐</span><div><strong style="font-size:0.85em;">Seguridad</strong><div style="font-size:0.75em;color:#7f8c8d;">PIN de acceso y clave de recuperación</div></div></div>
          <div class="ayuda-mini-card" style="display:flex;align-items:center;gap:8px;"><span style="font-size:1.2em;">👤</span><div><strong style="font-size:0.85em;">Responsables</strong><div style="font-size:0.75em;color:#7f8c8d;">Encargados autorizados para registrar anticipos</div></div></div>
          <div class="ayuda-mini-card" style="display:flex;align-items:center;gap:8px;"><span style="font-size:1.2em;">🌐</span><div><strong style="font-size:0.85em;">URLs de conexión</strong><div style="font-size:0.75em;color:#7f8c8d;">Scripts de Google que alimentan el sistema</div></div></div>
        </div>
      </div>`,
      pasos:['Presiona la pestaña "⚙️ Configuración" en la barra superior','Encuentra las tres secciones: Seguridad, Responsables y Conexión','Cada sección tiene sus propios botones de acción'],
      nota:'Solo el administrador debe acceder a esta sección. Guarda siempre los cambios.' },

    { id:'c2', cat:'config', titulo:'¿Cómo cambio el PIN y qué es la clave de recuperación?', tags:['PIN','contraseña','clave','cambiar','acceso','seguridad','recuperar','olvidé'],
      resp:'El <strong>PIN</strong> es tu contraseña de acceso al sistema. La <strong>Clave de Recuperación</strong> es un código alternativo para entrar si olvidas el PIN.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">🔐 Sección de seguridad</div>
        <div class="ayuda-mini-card" style="font-size:0.82em;">
          <div style="font-weight:700;margin-bottom:6px;">Cambiar PIN</div>
          <div style="border:1px solid #ddd;border-radius:5px;padding:5px 8px;margin-bottom:4px;color:#aaa;letter-spacing:6px;">● ● ● ●</div>
          <div style="border:1px solid #ddd;border-radius:5px;padding:5px 8px;margin-bottom:4px;color:#aaa;letter-spacing:6px;">● ● ● ●</div>
          <div style="border:1px solid #ddd;border-radius:5px;padding:5px 8px;margin-bottom:8px;color:#aaa;letter-spacing:6px;">● ● ● ●</div>
          <span class="ayuda-mini-btn" style="background:#3498db;color:white;">Actualizar PIN</span>
        </div>
      </div>`,
      pasos:['En Configuración, localiza la sección "Seguridad" o "PIN"','Ingresa tu PIN actual (para verificar que eres tú)','Escribe el nuevo PIN (mínimo 4 dígitos)','Confírmalo escribiéndolo de nuevo','Presiona "Actualizar PIN"'],
      nota:'⚠️ <strong>MUY IMPORTANTE:</strong> La Clave de Recuperación te permite entrar si olvidas el PIN. Guárdala en un papel o lugar seguro, separado del dispositivo. Sin ella, no podrás acceder si olvidas el PIN.' },

    { id:'c3', cat:'config', titulo:'¿Cómo gestiono los responsables de anticipos?', tags:['responsable','encargado','iniciales','área','autorizar','agregar','eliminar'],
      resp:'Los <strong>Responsables</strong> son las personas autorizadas para registrar anticipos. Se identifican con sus iniciales y área (ej: N.M · S.J). Esta lista aparece como selector al registrar cada anticipo.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">👤 Lista de responsables</div>
        <div class="ayuda-mini-card" style="font-size:0.82em;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #eee;">
            <span style="font-weight:700;">N.M</span><span style="color:#7f8c8d;">S.J</span>
            <span class="ayuda-mini-btn" style="background:#fee2e2;color:#e74c3c;border:1px solid #fca5a5;padding:2px 6px;font-size:0.75em;">✕</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #eee;">
            <span style="font-weight:700;">P.M</span><span style="color:#7f8c8d;">S.J</span>
            <span class="ayuda-mini-btn" style="background:#fee2e2;color:#e74c3c;border:1px solid #fca5a5;padding:2px 6px;font-size:0.75em;">✕</span>
          </div>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <div style="flex:1;border:1px solid #ddd;border-radius:5px;padding:4px 8px;color:#aaa;font-size:0.85em;">Iniciales</div>
            <div style="flex:1;border:1px solid #ddd;border-radius:5px;padding:4px 8px;color:#aaa;font-size:0.85em;">Área</div>
            <span class="ayuda-mini-btn" style="background:#27ae60;color:white;font-size:0.8em;">+ Agregar</span>
          </div>
        </div>
      </div>`,
      pasos:['En Configuración, localiza "Responsables" o presiona el ⚙️ junto al selector de Responsable al registrar un anticipo','Para <strong>agregar</strong>: escribe las iniciales (ej: C.P) y el área (ej: S.J) y presiona "+ Agregar"','Para <strong>eliminar</strong>: presiona la ✕ del responsable que ya no está activo','Los cambios se guardan en este dispositivo y persisten entre sesiones','Si cambias de dispositivo, deberás configurarlos nuevamente'],
      nota:'Las iniciales son solo informativas — aparecen en los informes de anticipos como referencia del encargado que autorizó cada movimiento.' },

    { id:'c4', cat:'config', titulo:'¿Qué son las URLs de conexión y puedo cambiarlas?', tags:['URL','script','google','conexión','sheets','configurar'],
      resp:'Las <strong>URLs de conexión</strong> son los enlaces a los scripts de Google que guardan todos los datos del sistema (socios, anticipos, recaudaciones, arqueo).',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">🌐 Conexiones del sistema</div>
        <div style="display:grid;gap:4px;font-size:0.78em;">
          <div class="ayuda-mini-card"><div style="color:#7f8c8d;font-size:0.7em;">URL SOCIOS (datos de socios y anticipos)</div><div style="font-family:monospace;color:#2563eb;word-break:break-all;">https://script.google.com/...</div></div>
          <div class="ayuda-mini-card"><div style="color:#7f8c8d;font-size:0.7em;">URL RECAUDACIONES (montos diarios)</div><div style="font-family:monospace;color:#27ae60;word-break:break-all;">https://script.google.com/...</div></div>
          <div class="ayuda-mini-card"><div style="color:#7f8c8d;font-size:0.7em;">URL ARQUEO (estado del arqueo de caja)</div><div style="font-family:monospace;color:#e67e22;word-break:break-all;">https://script.google.com/...</div></div>
        </div>
      </div>`,
      pasos:['Las URLs vienen preconfiguradas por el administrador del sistema','<strong>NO las cambies</strong> a menos que el sistema indique que hay un error de conexión','Si hay un error de "script no encontrado", contacta al administrador técnico','Las URLs están dentro del código HTML del archivo — editarlas requiere un editor de texto'],
      nota:'Si el sistema dice "Error al cargar datos" o "CORS", generalmente es un problema con los scripts de Google, no con las URLs en sí.' },

    { id:'c5', cat:'config', titulo:'¿Qué hago si olvidé el PIN de acceso?', tags:['olvidé','PIN','recuperar','clave','acceso','bloqueado'],
      resp:'En la pantalla de ingreso hay un enlace <strong>"¿Olvidaste el PIN?"</strong>. Al presionarlo, puedes ingresar la Clave de Recuperación para restablecer el acceso.',
      pasos:['En la pantalla de ingreso de PIN, presiona "¿Olvidaste el PIN?" (enlace pequeño bajo el campo)','Ingresa la Clave de Recuperación que configuraste','Si es correcta, podrás establecer un nuevo PIN','Si tampoco recuerdas la Clave de Recuperación, deberás editar el archivo HTML directamente'],
      nota:'⚠️ Si pierdes tanto el PIN como la Clave de Recuperación, contacta al administrador técnico del sistema. Por eso es vital guardar la clave en un lugar seguro.' },

    // ═══════════════════════════════════════════════════════
    // SEGURIDAD
    // ═══════════════════════════════════════════════════════
    { id:'seg1', cat:'seguridad', titulo:'¿Cómo asigno un PIN personal a cada responsable?', tags:['PIN personal','responsable','contraseña propia','seguridad','acceso','auditoría'],
      resp:'Cada responsable puede tener su <strong>propio PIN de 4 dígitos</strong> en lugar de compartir el PIN general del sistema. Esto permite identificar exactamente quién realizó cada acción.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">🔐 Sistema de PINs personales</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;">
          <div style="background:white;border-radius:8px;padding:8px 12px;border:1px solid #d5f0e0;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:700;">N.M (S.J)</span>
            <span style="background:#eafaf1;color:#1e8449;border-radius:5px;padding:2px 8px;font-size:0.78em;font-weight:700;">🔐 PIN propio</span>
          </div>
          <div style="background:white;border-radius:8px;padding:8px 12px;border:1px solid #fdebd0;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:700;">P.M (S.J)</span>
            <span style="background:#fff3cd;color:#856404;border-radius:5px;padding:2px 8px;font-size:0.78em;font-weight:700;">🔓 PIN global</span>
          </div>
        </div>
        <div class="ayuda-formula">Al seleccionar el nombre → el acceso muestra si usa PIN propio o global</div>
      </div>`,
      pasos:['Ve a <strong>⚙️ Configuración → Responsables autorizados</strong>','Cada responsable tiene un botón <strong>🔑 PIN</strong>','Presiona ese botón para desplegar el formulario de PIN personal','Escribe un PIN de 4 dígitos y confírmalo → presiona <strong>Guardar</strong>','El indicador cambia de "🔓 PIN global" a "🔐 PIN propio"','Al ingresar al sistema, el usuario verá una indicación del tipo de PIN que debe usar'],
      nota:'Los PINs personales se guardan en este dispositivo (localStorage). Si el responsable trabaja desde otro dispositivo, deberás configurar su PIN allí también.' },

    { id:'seg2', cat:'seguridad', titulo:'¿Qué es el Historial de Auditoría y para qué sirve?', tags:['auditoría','historial','logs','quién','eliminó','seguridad','registro','robo'],
      resp:'La pestaña <strong>🔍 Auditoría</strong> registra en Google Sheets <strong>quién hizo qué y cuándo</strong>: anticipos registrados, borrados, cierres de mes, cambios en socios y saldos.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">🔍 Ejemplo de registro de auditoría</div>
        <div style="background:white;border-radius:8px;overflow:hidden;border:1px solid #eee;">
          <div style="display:grid;grid-template-columns:100px 60px 100px 1fr;gap:0;font-size:0.7em;">
            <div style="background:#2c3e50;color:white;padding:4px 6px;font-weight:700;">Fecha/Hora</div>
            <div style="background:#2c3e50;color:white;padding:4px 6px;font-weight:700;">Usuario</div>
            <div style="background:#2c3e50;color:white;padding:4px 6px;font-weight:700;">Acción</div>
            <div style="background:#2c3e50;color:white;padding:4px 6px;font-weight:700;">Detalle</div>
            <div style="padding:4px 6px;border-bottom:1px solid #f0f0f0;">14/04 14:32</div>
            <div style="padding:4px 6px;border-bottom:1px solid #f0f0f0;font-weight:700;">N.M</div>
            <div style="padding:4px 6px;border-bottom:1px solid #f0f0f0;"><span style="background:#fdecea;color:#c0392b;border-radius:4px;padding:1px 5px;font-weight:700;">Eliminar</span></div>
            <div style="padding:4px 6px;border-bottom:1px solid #f0f0f0;">Socio: Juan P. | $50.000</div>
            <div style="padding:4px 6px;">14/04 09:10</div>
            <div style="padding:4px 6px;font-weight:700;">P.M</div>
            <div style="padding:4px 6px;"><span style="background:#eafaf1;color:#1e8449;border-radius:4px;padding:1px 5px;font-weight:700;">Registrar</span></div>
            <div style="padding:4px 6px;">Socio: María G. | $30.000</div>
          </div>
        </div>
      </div>`,
      pasos:['Cada acción crítica queda registrada automáticamente (no requiere intervención manual)','Ve a la pestaña <strong>🔍 Auditoría</strong> → presiona <strong>🔄 Actualizar</strong>','Usa los filtros para buscar por usuario, tipo de acción, fechas o texto libre','Presiona <strong>🖨️ Imprimir informe</strong> para generar un PDF con todos los registros filtrados','El informe incluye un resumen por usuario y por tipo de acción'],
      nota:'Las acciones registradas son: Registrar/Editar/Eliminar Anticipo, Agregar/Editar/Eliminar Socio, Actualizar/Registrar Saldo Anterior, Reiniciar Anticipos, Cierre de Mes, Agregar Días PT, Imprimir Recibo, Canje, Ingreso Material, Gasto Material, Eliminar Material. Los accesos se registran en la hoja HistorialConexiones de Google Sheets.' },

    { id:'seg3', cat:'seguridad', titulo:'¿Cómo evito que alguien borre anticipos sin dejar rastro?', tags:['borrar','eliminar','rastro','seguridad','robo','fraude','control'],
      resp:'El sistema tiene <strong>tres capas de protección</strong>: PIN personalizado por usuario, Historial de Auditoría que registra cada borrado, y el Historial en Google Sheets que no se puede borrar desde la aplicación.',
      pasos:['<strong>PIN personal:</strong> cada responsable usa su propia contraseña — si alguien borra algo, queda identificado','<strong>Auditoría:</strong> cada borrado registra quién lo hizo, qué monto, de qué socio y en qué fecha','<strong>Historial en Sheets:</strong> los datos van a la hoja AuditoriaLogs directamente — solo accesible por el administrador de la planilla','<strong>Informe periódico:</strong> imprime el informe de Auditoría una vez por semana para revisión externa al sistema'],
      nota:'⚠️ Para máxima seguridad: asegúrate de que TODOS los responsables tengan su PIN personal configurado y que nadie comparta sus credenciales.' },

    // ═══════════════════════════════════════════════════════
    // MATERIALES Y GASTOS
    // ═══════════════════════════════════════════════════════
    { id:'mat1', cat:'materiales', titulo:'¿Qué es la sección Materiales y Gastos?', tags:['materiales','gastos','ingresos','balance','período','recaudación','fondo'],
      resp:'La sección <strong>📦 Materiales</strong> registra los <strong>ingresos y gastos del fondo de materiales</strong> del casino: compras de suministros, cierre de propina asignado a materiales, etc. Muestra el balance neto por período.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">📦 Panel de Materiales</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px;">
          <div style="background:white;border-radius:8px;padding:8px;border-top:3px solid #10b981;text-align:center;">
            <div style="font-weight:900;color:#10b981;font-size:0.9em;">$120.000</div>
            <div style="font-size:0.6em;color:#7f8c8d;text-transform:uppercase;font-weight:700;">Ingresos</div>
          </div>
          <div style="background:white;border-radius:8px;padding:8px;border-top:3px solid #ef4444;text-align:center;">
            <div style="font-weight:900;color:#ef4444;font-size:0.9em;">$45.000</div>
            <div style="font-size:0.6em;color:#7f8c8d;text-transform:uppercase;font-weight:700;">Gastos</div>
          </div>
          <div style="background:#dcfce7;border-radius:8px;padding:8px;border-top:3px solid #059669;text-align:center;">
            <div style="font-weight:900;color:#059669;font-size:0.9em;">$75.000</div>
            <div style="font-size:0.6em;color:#7f8c8d;text-transform:uppercase;font-weight:700;">Balance</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;background:white;border-radius:8px;padding:8px 12px;border:1px solid #eee;font-size:0.8em;">
          <span>‹</span>
          <strong style="color:#2c3e50;">15 May → 14 Jun 2026</strong>
          <span>›</span>
        </div>
      </div>`,
      pasos:['Ve a la pestaña <strong>📦 Materiales</strong> en el menú','El panel muestra tres tarjetas: <strong>Ingresos totales</strong>, <strong>Gastos totales</strong> y <strong>Balance</strong>','El balance verde = superávit, rojo = déficit','Usa las flechas ‹ › para navegar entre períodos','Debajo aparece el historial de todos los movimientos del período, ordenados por fecha'],
      nota:'Los movimientos se ingresan manualmente al hacer el cierre de la propina. Todos quedan registrados en Auditoría.' },

    { id:'mat2', cat:'materiales', titulo:'¿Cómo registro un Ingreso de materiales?', tags:['ingreso','agregar','registrar','materiales','cierre','propina','fondo'],
      resp:'Un <strong>Ingreso</strong> es dinero que entra al fondo de materiales, por ejemplo el monto del cierre de propina destinado a materiales o una recuperación de gastos.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">📈 Formulario Nuevo Ingreso</div>
        <div class="ayuda-mini-card" style="font-size:0.82em;">
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            <span style="background:#10b981;color:white;border-radius:8px;padding:5px 14px;font-weight:700;font-size:0.85em;flex:1;text-align:center;">INGRESO</span>
            <span style="background:white;color:#ef4444;border:2px solid #ef4444;border-radius:8px;padding:5px 14px;font-weight:700;font-size:0.85em;flex:1;text-align:center;">GASTO</span>
          </div>
          <div style="margin-bottom:6px;"><div style="font-size:0.7em;color:#7f8c8d;font-weight:700;text-transform:uppercase;">Fecha</div>
            <div style="border:1px solid #ddd;border-radius:5px;padding:5px 8px;margin-top:2px;">15/05/2026</div></div>
          <div style="margin-bottom:6px;"><div style="font-size:0.7em;color:#7f8c8d;font-weight:700;text-transform:uppercase;">Monto ($)</div>
            <div style="border:2px solid #10b981;border-radius:5px;padding:5px 8px;margin-top:2px;font-weight:800;color:#10b981;">120.000</div></div>
          <div><div style="font-size:0.7em;color:#7f8c8d;font-weight:700;text-transform:uppercase;">Descripción</div>
            <div style="border:1px solid #ddd;border-radius:5px;padding:5px 8px;margin-top:2px;color:#aaa;">Cierre de mes Mayo</div></div>
        </div>
      </div>`,
      pasos:['Presiona el botón verde <strong>"↑ Agregar Ingreso"</strong> en la sección Materiales','La ventana se abre con el tipo <strong>INGRESO</strong> preseleccionado (verde activo)','Ingresa la fecha (por defecto hoy)','Escribe el monto sin puntos ni comas','Agrega una descripción opcional (ej: "Cierre de mes Mayo")','Presiona <strong>Guardar</strong> — el ingreso aparece en el historial del período'],
      nota:'El ingreso se asigna al período según su fecha: si el día es ≥15 va al mes actual, si es <15 va al período anterior. Queda en Auditoría como "Ingreso Material".' },

    { id:'mat3', cat:'materiales', titulo:'¿Cómo registro un Gasto de materiales?', tags:['gasto','egreso','compra','materiales','suministros','artículos'],
      resp:'Un <strong>Gasto</strong> es dinero que sale del fondo de materiales, como la compra de suministros, artículos de limpieza u otros insumos del casino.',
      pasos:['Presiona el botón rojo <strong>"↓ Agregar Gasto"</strong> en la sección Materiales','La ventana se abre con el tipo <strong>GASTO</strong> preseleccionado (rojo activo)','Ingresa la fecha del gasto','Escribe el monto','Agrega una descripción del gasto (ej: "Compra de materiales de limpieza")','Presiona <strong>Guardar</strong>'],
      nota:'También puedes cambiar el tipo dentro de la ventana: si abriste "Ingreso" por error, presiona el botón GASTO para cambiarlo antes de guardar.' },

    { id:'mat4', cat:'materiales', titulo:'¿Cómo funciona el período 15 a 15 en Materiales?', tags:['período','15','mes','materiales','navegar','histórico','ciclo'],
      resp:'Los movimientos se agrupan en períodos del <strong>día 15 de un mes al 14 del siguiente</strong>, siguiendo el mismo ciclo de la propina.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">📅 Lógica del período</div>
        <div style="display:grid;gap:5px;font-size:0.82em;">
          <div class="ayuda-mini-card" style="display:flex;align-items:center;gap:8px;">
            <span style="background:#dcfce7;color:#059669;border-radius:5px;padding:2px 7px;font-weight:700;font-size:0.8em;">20 Mayo</span>
            <span style="color:#7f8c8d;">→ período</span>
            <span style="font-weight:700;">15 May → 14 Jun</span>
          </div>
          <div class="ayuda-mini-card" style="display:flex;align-items:center;gap:8px;">
            <span style="background:#fee2e2;color:#dc2626;border-radius:5px;padding:2px 7px;font-weight:700;font-size:0.8em;">10 Mayo</span>
            <span style="color:#7f8c8d;">→ período</span>
            <span style="font-weight:700;">15 Abr → 14 May</span>
          </div>
        </div>
        <div class="ayuda-formula" style="margin-top:6px;">Día ≥ 15 → período del mes actual<br>Día &lt; 15 → período del mes anterior</div>
      </div>`,
      pasos:['Al abrir la sección se muestra el <strong>período actual</strong> automáticamente','Presiona <strong>‹</strong> para retroceder un período o <strong>›</strong> para avanzar','Cada movimiento queda en el período de su fecha, no del día en que se ingresó','Para consultar meses anteriores, navega con las flechas hasta llegar al período deseado'],
      nota:'El encabezado siempre muestra el período activo, por ejemplo "15 May → 14 Jun 2026".' },

    { id:'mat5', cat:'materiales', titulo:'¿Cómo elimino un registro de Materiales?', tags:['eliminar','borrar','materiales','ingreso','gasto','corregir'],
      resp:'En el historial del período, cada registro tiene un botón <strong>🗑️</strong> a la derecha para eliminarlo.',
      pasos:['En el historial del período, localiza el registro a eliminar','Presiona el ícono 🗑️ a la derecha del monto','Confirma la eliminación','El balance se actualiza automáticamente'],
      nota:'La eliminación queda registrada en Auditoría como "Eliminar Material". No se puede deshacer.' },

    // ═══════════════════════════════════════════════════════
    // MENÚ Y NAVEGACIÓN
    // ═══════════════════════════════════════════════════════
    { id:'nav1', cat:'config', titulo:'¿Cómo reordeno las secciones del menú?', tags:['menú','reordenar','mover','secciones','personalizar','orden','drag','arrastrar'],
      resp:'Puedes <strong>arrastrar y soltar</strong> cualquier sección del menú para organizarlas a tu gusto. El nuevo orden se guarda automáticamente en el dispositivo.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">↕️ Arrastrar para reordenar</div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:0.82em;">
          <div class="ayuda-mini-card" style="opacity:0.4;border:2px dashed #3498db;display:flex;align-items:center;gap:8px;">
            <span style="color:#3498db;">⋮⋮</span><strong>💰 Arqueo de Caja</strong>
            <span style="font-size:0.7em;color:#3498db;margin-left:auto;">arrastrando...</span>
          </div>
          <div class="ayuda-mini-card" style="display:flex;align-items:center;gap:8px;">
            <span style="color:#aaa;">⋮⋮</span><strong>👥 Gestión de Socios</strong>
          </div>
          <div class="ayuda-mini-card" style="border-top:3px solid #3498db;display:flex;align-items:center;gap:8px;">
            <span style="color:#aaa;">⋮⋮</span><strong>📊 Montos Recaudados</strong>
            <span style="font-size:0.7em;color:#3498db;margin-left:auto;">← soltar aquí</span>
          </div>
        </div>
      </div>`,
      pasos:['<strong>En computador:</strong> haz clic y arrastra cualquier sección del menú lateral hacia arriba o abajo','<strong>En móvil:</strong> abre "☰ Secciones" → mantén el dedo sobre una sección y arrastra verticalmente','Una línea azul indica dónde quedará la sección al soltar','Suelta para confirmar la nueva posición','El orden se guarda automáticamente — persiste al recargar la página'],
      nota:'El orden se guarda por dispositivo en el almacenamiento local. Si accedes desde otro dispositivo, verás el orden predeterminado.' },

    { id:'nav2', cat:'config', titulo:'¿Cómo funciona el menú en computador y en móvil?', tags:['menú','lateral','sidebar','móvil','drawer','secciones','computador','pantalla'],
      resp:'El menú se adapta al tamaño de pantalla: <strong>menú lateral fijo</strong> en computador (≥900px) y <strong>panel desde abajo</strong> en móvil.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">📱 Móvil vs 🖥️ Computador</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.78em;">
          <div class="ayuda-mini-card">
            <div style="font-weight:700;margin-bottom:6px;text-align:center;">📱 Móvil</div>
            <div style="background:#f8f9fa;border-radius:6px;padding:6px;">
              <div style="display:flex;justify-content:space-between;align-items:center;background:white;border-radius:5px;padding:4px 6px;border:1px solid #eee;">
                <span style="color:#3498db;font-weight:700;font-size:0.85em;">Arqueo de Caja</span>
                <span style="background:#3498db;color:white;border-radius:10px;padding:1px 6px;font-size:0.75em;">☰</span>
              </div>
              <div style="text-align:center;color:#7f8c8d;font-size:0.72em;margin-top:4px;">Barra con sección activa + botón menú</div>
            </div>
          </div>
          <div class="ayuda-mini-card">
            <div style="font-weight:700;margin-bottom:6px;text-align:center;">🖥️ Computador</div>
            <div style="display:flex;gap:4px;">
              <div style="background:#f8f9fa;border-radius:5px;padding:4px;display:flex;flex-direction:column;gap:2px;min-width:55px;">
                <div style="background:#3498db;color:white;border-radius:3px;padding:2px 4px;font-size:0.72em;font-weight:700;">Arqueo</div>
                <div style="background:#eee;border-radius:3px;padding:2px 4px;font-size:0.72em;">Socios</div>
                <div style="background:#eee;border-radius:3px;padding:2px 4px;font-size:0.72em;">Montos</div>
              </div>
              <div style="flex:1;background:#f8f9fa;border-radius:5px;padding:6px;font-size:0.7em;color:#7f8c8d;display:flex;align-items:center;">contenido →</div>
            </div>
          </div>
        </div>
      </div>`,
      pasos:['<strong>Computador:</strong> el menú aparece como panel fijo a la izquierda, siempre visible','<strong>Móvil:</strong> la barra superior muestra la sección activa y el botón "☰ Secciones"','Para navegar en móvil: presiona "☰ Secciones" → el panel aparece desde abajo → toca la sección deseada → el panel se cierra','Para reordenar en móvil: con el panel de menú abierto, arrastra verticalmente las secciones','En computador: el cursor cambia a ⊹ al pasar sobre el menú, indicando que se puede arrastrar'],
      nota:'El panel de menú en móvil cubre automáticamente los botones flotantes para evitar confusión.' },

    { id:'tec1', cat:'config', titulo:'¿Qué tecnología usa el sistema por dentro?', tags:['supabase','PWA','offline','tecnología','tiempo real','apps script','base de datos','instalar'],
      resp:'El sistema combina <strong>Supabase</strong> como base de datos en tiempo real, <strong>Google Apps Script</strong> para procesos de cierre y notificaciones, y funciona como <strong>PWA instalable</strong> en cualquier dispositivo.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">⚡ Tecnologías del sistema</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div class="ayuda-mini-card" style="flex-direction:row;align-items:center;gap:10px;">
            <span style="font-size:20px;">🗄️</span>
            <div><div style="font-weight:700;font-size:0.85em;">Supabase</div><div style="font-size:0.75em;color:#7f8c8d;">Base de datos principal · sincronización Realtime entre dispositivos</div></div>
          </div>
          <div class="ayuda-mini-card" style="flex-direction:row;align-items:center;gap:10px;">
            <span style="font-size:20px;">⚙️</span>
            <div><div style="font-weight:700;font-size:0.85em;">Google Apps Script</div><div style="font-size:0.75em;color:#7f8c8d;">Servicio en la nube · cierres, notificaciones Telegram, respaldo en Sheets</div></div>
          </div>
          <div class="ayuda-mini-card" style="flex-direction:row;align-items:center;gap:10px;">
            <span style="font-size:20px;">📱</span>
            <div><div style="font-weight:700;font-size:0.85em;">Aplicación instalable (PWA)</div><div style="font-size:0.75em;color:#7f8c8d;">Instálala desde Safari/Chrome · funciona sin conexión con caché automático</div></div>
          </div>
        </div>
      </div>`,
      pasos:['Para instalar en iPhone: abre en Safari → botón Compartir → "Agregar a pantalla de inicio"','Para instalar en Android: abre en Chrome → menú ⋮ → "Instalar app" o "Agregar a pantalla de inicio"','Los datos se sincronizan en tiempo real entre todos los dispositivos vía Supabase','Si te quedas sin conexión, la app sigue funcionando con los datos en caché — los cambios se sincronizan al volver a conectarse'],
      nota:'No se necesita instalarla para usarla — funciona directo desde el navegador. La instalación solo añade el ícono en la pantalla de inicio y mejora la experiencia.' },

    // ═══════════════════════════════════════════════════════
    // EGRESOS (solicitudes de anticipo desde la app del socio)
    // ═══════════════════════════════════════════════════════
    { id:'eg1', cat:'egresos', titulo:'¿Qué es un "Egreso pendiente" y de dónde viene?', tags:['egreso','egresos','pendiente','solicitud','anticipo','socio','propi.solicitada','solicitar'],
      resp:'Es una <strong>solicitud de anticipo</strong> que el socio envía desde su app <strong>propi.solicitada</strong> (botón "Solicitar Egreso"). Aparece como aviso en <strong>Anticipos y Ausencias</strong> para que tú la proceses o la rechaces.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">💸 Aviso de egresos pendientes</div>
        <div style="background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:10px;padding:10px;">
          <div style="color:white;font-weight:800;font-size:0.85em;margin-bottom:8px;">💸 Egresos pendientes <span style="background:rgba(255,255,255,0.25);border-radius:8px;padding:1px 6px;">1</span></div>
          <div style="background:white;border-radius:8px;padding:8px;">
            <div style="font-weight:800;font-size:0.82em;color:#075985;">Juan Pérez</div>
            <div style="font-size:0.72em;color:#0369a1;">Solicita $50.000 · gasto imprevisto</div>
            <div style="display:flex;gap:6px;margin-top:7px;">
              <div style="flex:1;background:#0284c7;color:white;border-radius:6px;padding:6px;text-align:center;font-size:0.72em;font-weight:800;">✅ Procesar</div>
              <div style="flex:1;background:white;border:1px solid #fca5a5;color:#dc2626;border-radius:6px;padding:6px;text-align:center;font-size:0.72em;font-weight:800;">✖️ Rechazar</div>
            </div>
          </div>
        </div>
      </div>`,
      pasos:['El socio pide el egreso desde su app indicando monto y (opcional) un motivo','El aviso aparece arriba en Anticipos y Ausencias, y el socio queda marcado con el badge 💸 EGRESO en la lista','Desde ahí decides: Procesar (registrar el anticipo) o Rechazar (con motivo)','El aviso se actualiza en tiempo real: si el socio pide otro, aparece al instante'],
      nota:'Mientras no lo proceses ni rechaces, el socio ve en su app una tarjeta "Egreso solicitado · pendiente".' },

    { id:'eg2', cat:'egresos', titulo:'¿Cómo proceso un egreso solicitado?', tags:['procesar','egreso','aceptar','anticipo','registrar','aprobar'],
      resp:'Al tocar <strong>✅ Procesar</strong>, se abre el socio con el <strong>monto ya pre-cargado</strong> en el formulario de anticipo. Solo confirmas y registras el anticipo como siempre.',
      pasos:['Toca ✅ Procesar en el aviso del egreso','Se selecciona el socio y el monto solicitado aparece cargado en "Monto"','Revisa la fecha y el responsable, y pulsa "Registrar Anticipo" (con su desglose de billetes)','Al registrarlo, la solicitud pasa a PROCESADO y el socio recibe el aviso "✅ Egreso procesado"'],
      nota:'Si registras un anticipo normal sin pasar por el botón Procesar, la solicitud NO se cierra sola: usa el aviso para vincularla.' },

    { id:'eg3', cat:'egresos', titulo:'¿Cómo rechazo un egreso e informo el motivo al socio?', tags:['rechazar','egreso','motivo','negar','denegar','nota','notificar'],
      resp:'Al tocar <strong>✖️ Rechazar</strong>, el sistema te pide escribir el <strong>motivo</strong>. Ese motivo se le envía automáticamente al socio como <strong>mensaje del administrador</strong> en su app.',
      pasos:['Toca ✖️ Rechazar en el aviso del egreso','Escribe el motivo del rechazo (es obligatorio; el socio lo verá)','La solicitud queda como RECHAZADO y desaparece de los pendientes','El socio recibe en su app (Mensajes → Admin) el aviso: "❌ Egreso rechazado" + tu motivo'],
      nota:'El motivo queda guardado en la solicitud y también le llega al socio como notificación. Sé claro y breve.' },

    // ═══════════════════════════════════════════════════════
    // MENSAJES A SOCIOS (privado)
    // ═══════════════════════════════════════════════════════
    { id:'msg1', cat:'mensajes', titulo:'¿Cómo le envío un mensaje privado a un socio?', tags:['mensaje','mensajes','privado','chat','socio','escribir','comunicar','contactar'],
      resp:'En la sección <strong>💬 Mensajes</strong> eliges un socio de la lista y le escribes. Solo ese socio lo verá, en su app (Mensajes → <strong>"Admin"</strong>), y puede responderte.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">💬 Conversación con un socio</div>
        <div style="background:#eef2f6;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px;">
          <div style="align-self:flex-end;background:#0284c7;color:white;border-radius:10px;padding:6px 10px;font-size:0.78em;max-width:80%;">Hola, pasa por oficina a firmar tu contrato.</div>
          <div style="align-self:flex-start;background:white;border:1px solid #e2e8f0;border-radius:10px;padding:6px 10px;font-size:0.78em;max-width:80%;">Ok, voy en la tarde 👍</div>
        </div>
      </div>`,
      pasos:['Entra a la sección 💬 Mensajes del menú','Busca y selecciona el socio en la lista de la izquierda','Escribe tu mensaje abajo y pulsa Enviar','El socio lo recibe en su app y, si tiene notificaciones activadas, le llega un aviso al teléfono'],
      nota:'Los mensajes de "❌ Egreso rechazado" y "✅ Egreso procesado" también le llegan al socio por este mismo canal.' },

    { id:'msg2', cat:'mensajes', titulo:'¿Cómo sé si un socio me respondió?', tags:['respuesta','responder','nuevo','no leído','aviso','punto rojo','mensajes'],
      resp:'Los socios con respuesta <strong>sin leer</strong> aparecen arriba en la lista con la etiqueta <strong>NUEVO</strong>, y el menú muestra un <strong>punto rojo</strong> en "💬 Mensajes".',
      pasos:['Un punto rojo en el botón 💬 Mensajes del menú indica que hay respuestas nuevas','Al entrar, los socios con mensajes sin leer se ordenan primero, con la etiqueta NUEVO','Abre la conversación del socio para leer; al abrirla se marca como vista','Los socios con conversación (ya leída) muestran el ícono 💬'],
      nota:'La lista y las conversaciones se actualizan en tiempo real: si el socio escribe mientras la tienes abierta, aparece al instante.' },

    // ═══════════════════════════════════════════════════════
    // DOCUMENTACIÓN
    // ═══════════════════════════════════════════════════════
    { id:'doc1', cat:'documentacion', titulo:'¿Qué es la sección Documentación?', tags:['documentación','documentos','archivos','contrato','reglamento','pdf','subir'],
      resp:'Es donde se guardan y consultan <strong>documentos en PDF o imagen</strong>. Tiene dos vistas: <strong>Generales</strong> (compartidos, ej. el reglamento) y <strong>Por socio</strong> (lo que cada socio sube desde su app, ej. su contrato).',
      pasos:['Abre la sección 📁 Documentación del menú','Pestaña "Generales": documentos para todos (reglamento, comunicados…)','Pestaña "Por socio": buscas un socio y ves los documentos que él subió','Cada documento se puede abrir/descargar y, en Generales, eliminar'],
      nota:'Los documentos por socio los sube el propio socio desde propi.solicitada (Perfil → Mis Documentos). Son privados: solo el socio y la administración los ven.' },

    { id:'doc2', cat:'documentacion', titulo:'¿Cómo subo un documento general (reglamento, comunicado)?', tags:['subir','documento','general','reglamento','pdf','imagen','compartir'],
      resp:'En Documentación → pestaña <strong>Generales</strong>, pulsa <strong>"Subir documento general"</strong> y elige un PDF o imagen desde tu dispositivo.',
      pasos:['Entra a Documentación → pestaña Generales','Pulsa "⬆️ Subir documento general (PDF/imagen)"','Selecciona el archivo; queda listado para todos','Puedes abrirlo para descargarlo/enviarlo, o eliminarlo si ya no aplica'],
      nota:'Úsalo para el reglamento de la propina u otros documentos que todo el equipo deba tener a mano.' },

    { id:'doc3', cat:'documentacion', titulo:'¿Cómo veo el contrato u otros documentos que sube un socio?', tags:['contrato','socio','documento','ver','privado','buscar'],
      resp:'En Documentación → pestaña <strong>Por socio</strong>, buscas al socio por su nombre y se listan los archivos que él haya subido desde su app.',
      pasos:['Entra a Documentación → pestaña Por socio','Escribe el nombre del socio en el buscador','Toca el socio para ver sus documentos','Abre cada archivo para revisarlo o descargarlo'],
      nota:'Si un socio no tiene documentos, es porque aún no ha subido ninguno desde su app (Perfil → Mis Documentos).' },

    // ═══════════════════════════════════════════════════════
    // CERTIFICADOS
    // ═══════════════════════════════════════════════════════
    { id:'cert1', cat:'certificados', titulo:'¿Cómo genero un certificado para un socio?', tags:['certificado','certificados','documento','socio','rut','imprimir','pdf','constancia'],
      resp:'En la sección <strong>📜 Certificados</strong> eliges un socio y el sistema genera su certificado del Fondo Solidario con sus datos (nombre y <strong>RUT</strong>), listo para imprimir o compartir.',
      pasos:['Abre la sección 📜 Certificados del menú','Selecciona el socio para el que necesitas el certificado','Revisa que sus datos (nombre y RUT) estén correctos','Genera el certificado y descárgalo/imprímelo'],
      nota:'Para que el certificado salga completo, el socio debe tener su RUT registrado (lo agrega él en su app, o tú en Gestión de Socios).' },

    // ═══════════════════════════════════════════════════════
    // DINEROS SOBRANTES
    // ═══════════════════════════════════════════════════════
    { id:'din1', cat:'dineros', titulo:'¿Qué es "Dineros Sobrantes"?', tags:['dineros','sobrantes','ingreso','retiro','caja','excedente','registro','anual'],
      resp:'Es un <strong>registro de movimientos de dinero sobrante</strong> del fondo: puedes agregar <strong>Ingresos</strong> y <strong>Retiros</strong>, y ver un <strong>resumen anual</strong> de todo.',
      pasos:['Abre la sección 💵 Dineros Sobrantes del menú','"↑ Agregar Ingreso" para registrar dinero que entra al sobrante','"↓ Agregar Retiro" para registrar dinero que sale','El resumen anual muestra el acumulado del período'],
      nota:'Sirve para llevar el control claro del dinero que queda fuera del reparto normal (excedentes, ajustes, etc.).' },

    // ═══════════════════════════════════════════════════════
    // PIN DIARIO (usuarios de diario.propi)
    // ═══════════════════════════════════════════════════════
    { id:'pin1', cat:'pindiario', titulo:'¿Qué es "PIN Diario" (PIN de usuarios de diario.propi)?', tags:['pin','diario','diario.propi','clave','usuarios','recuperar','cambiar','acceso','4 dígitos'],
      resp:'Es donde se administra el <strong>PIN de 4 dígitos</strong> con que cada socio entra a la app <strong>diario.propi</strong>: puedes <strong>crear, cambiar y recuperar</strong> ese PIN.',
      pasos:['Abre la sección 🔑 PIN Diario del menú','Busca al socio/usuario correspondiente','Crea o cambia su PIN de 4 dígitos si lo necesita','Úsalo también para recuperar el acceso de quien olvidó su PIN de diario.propi'],
      nota:'Es distinto del PIN con que TÚ entras a este sistema (ese se gestiona en Configuración / Seguridad). Este es el de los usuarios de diario.propi.' },

    // ═══════════════════════════════════════════════════════
    // CARPETAS (archivo de períodos)
    // ═══════════════════════════════════════════════════════
    { id:'carp1', cat:'carpetas', titulo:'¿Qué es la sección Carpetas (archivo de períodos)?', tags:['carpetas','archivar','archivero','período','histórico','nube','vaciar','respaldo'],
      resp:'Son las <strong>carpetas archivadas</strong>: cada vez que cierras y archivas un período con "Vaciar Nube y Archivar Todo", queda aquí guardado como respaldo histórico consultable.',
      pasos:['Abre la sección 📁 Carpetas del menú','Verás una carpeta por cada período que archivaste','Ábrelas para consultar los datos históricos de ese período','Se crean desde Montos Recaudados con "Vaciar Nube y Archivar Todo"'],
      nota:'Archivar limpia la nube para empezar un período nuevo, pero nada se pierde: queda guardado aquí.' },

    // ═══════════════════════════════════════════════════════
    // NOTAS DE ADMINISTRACIÓN
    // ═══════════════════════════════════════════════════════
    { id:'not1', cat:'notas', titulo:'¿Qué son las "Notas de Administración"?', tags:['notas','tablero','administración','recados','compartido','avisos','pizarra'],
      resp:'Es un <strong>espacio compartido</strong> para dejar mensajes/recados importantes <strong>visibles para todos los administradores</strong>. Se sincroniza en la nube automáticamente.',
      pasos:['Abre la sección 📝 Notas del menú','Escribe una nota para dejar un aviso al resto del equipo administrativo','Las notas se sincronizan solas con la nube','Mantén presionada una nota para acciones adicionales (ej. fijar/eliminar)'],
      nota:'Es interno de la administración: los socios NO ven estas notas. Para hablarle a un socio usa 💬 Mensajes.' },

    // ═══════════════════════════════════════════════════════
    // SOCIOS — RUT y FOTO
    // ═══════════════════════════════════════════════════════
    { id:'s4', cat:'socios', titulo:'¿Cómo agrego o edito el RUT de un socio y para qué sirve?', tags:['rut','socio','editar','agregar','certificado','recuperar pin','identificación'],
      resp:'En <strong>Gestión de Socios</strong>, al abrir un socio puedes ver y <strong>editar su RUT</strong>. El RUT se usa para los <strong>certificados</strong> y para que el socio pueda <strong>recuperar su PIN</strong>.',
      pasos:['Entra a Anticipos y Ausencias y selecciona el socio','En su ficha aparece el RUT; si falta o está mal, edítalo','Guárdalo con el formato chileno (12.345.678-9)','También el propio socio puede agregarlo desde su app la primera vez'],
      nota:'Sin RUT, el socio no puede recuperar su PIN por sí mismo y los certificados salen incompletos.' },

    { id:'s5', cat:'socios', titulo:'¿De dónde sale la foto del socio en las tarjetas?', tags:['foto','avatar','socio','perfil','imagen','tarjeta'],
      resp:'La foto la sube el <strong>propio socio</strong> desde su app (propi.solicitada → Perfil). Si la subió, aparece como avatar en su tarjeta de Gestión de Socios; si no, se muestra su inicial.',
      pasos:['El socio agrega su foto en su app (cámara o galería)','Automáticamente aparece en su tarjeta aquí en Gestión de Socios','También se ve en su propio login y perfil','Si no tiene foto, se muestra la primera letra de su nombre'],
      nota:'La foto es opcional; el socio decide si la pone o no.' },

    // ═══════════════════════════════════════════════════════
    // CIERRE DE MES / ESTADO DE COBROS DEL PERÍODO
    // ═══════════════════════════════════════════════════════
    { id:'cm1', cat:'cierre', titulo:'¿Qué es "Estado de Cobros del Período" (Cierre de Mes)?', tags:['cierre','cobros','período','estado','mes','panel','pendiente','sobre','cobrado','liquidar'],
      resp:'Es el panel (en <strong>Anticipos y Ausencias</strong>) para <strong>liquidar el mes de cada socio</strong> y llevar el control de quién ya cobró. Muestra cuántos socios están <strong>Pendientes</strong>, <strong>En Sobre</strong> o <strong>Cobrados</strong>.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">📊 Estado de Cobros del Período</div>
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:6px;text-align:center;"><div style="font-weight:900;color:#dc2626;">3</div><div style="font-size:0.6em;font-weight:700;color:#991b1b;">⏳ PENDIENTE</div></div>
          <div style="flex:1;background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:6px;text-align:center;"><div style="font-weight:900;color:#b45309;">2</div><div style="font-size:0.6em;font-weight:700;color:#92400e;">📩 EN SOBRE</div></div>
          <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:6px;text-align:center;"><div style="font-weight:900;color:#16a34a;">7</div><div style="font-size:0.6em;font-weight:700;color:#15803d;">💵 COBRADO</div></div>
        </div>
        <div style="font-size:0.72em;color:#475569;">La etiqueta del panel muestra <strong>7/12 · 💵7 📩2</strong> → 7 de 12 cerrados, 7 cobraron y 2 quedaron en sobre.</div>
      </div>`,
      pasos:['Ábrelo tocando "📊 Estado de Cobros del Período" en Anticipos y Ausencias','La etiqueta de color resume el avance: rojo (nadie cerrado), naranjo (algunos) o verde (todos)','Cada socio aparece en una de tres listas: ⏳ Pendiente, 📩 En Sobre o 💵 Cobrado','Puedes buscar un socio por nombre dentro del panel'],
      nota:'“Cerrar” a un socio NO es lo mismo que “Archivar el período”. Primero cierras/cobras a cada uno; archivar es el paso final del mes.' },

    { id:'cm2', cat:'cierre', titulo:'¿Qué hace el botón "🔒 Cerrar" de un socio y para qué sirve?', tags:['cerrar','cierre','socio','liquidar','pagar','remanente','saldo','recibo','cobrar'],
      resp:'“Cerrar” <strong>liquida el mes de ese socio</strong>: calcula cuánto le toca cobrar, <strong>guarda el sobrante (remanente) como saldo del próximo mes</strong> y te pregunta si está cobrando ahora o queda en sobre.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">🔒 Qué calcula al cerrar</div>
        <div style="background:white;border:1px solid #eee;border-radius:8px;padding:8px;font-size:0.8em;">
          <div style="display:flex;justify-content:space-between;"><span>Alcance (puntos × valor de días)</span><b>$180.000</b></div>
          <div style="display:flex;justify-content:space-between;"><span>+ Saldo anterior</span><b>$8.000</b></div>
          <div style="display:flex;justify-content:space-between;"><span>− Anticipos pedidos</span><b style="color:#dc2626;">-$20.000</b></div>
          <hr style="border:none;border-top:1px solid #eee;margin:5px 0;">
          <div style="display:flex;justify-content:space-between;"><span>💵 A pagar (redondeado a mil)</span><b style="color:#15803d;">$168.000</b></div>
          <div style="display:flex;justify-content:space-between;"><span>💜 Remanente (pasa al próximo mes)</span><b style="color:#8e44ad;">$0</b></div>
        </div>
      </div>`,
      pasos:['Toca 🔒 Cerrar en el socio (lista de Pendientes) y confirma','El sistema calcula: Alcance + Saldo anterior − Anticipos = lo que le corresponde','El “A pagar” se redondea hacia abajo al mil más cercano; lo que sobra es el remanente','El remanente se guarda automáticamente como su saldo anterior del próximo mes, y se genera el recibo','Te pregunta “¿está cobrando ahora?” → ✅ = 💵 Cobrado · ❌ = 📩 queda En Sobre'],
      nota:'Cerrar es reversible en su estado (puedes cambiar Cobrado/En sobre), pero recalcula y guarda saldos: hazlo cuando los anticipos del socio ya estén completos.' },

    { id:'cm3', cat:'cierre', titulo:'¿Qué significan Pendiente, En Sobre y Cobrado? ¿Y el botón 💵/📩?', tags:['pendiente','en sobre','cobrado','estado','sobre','marcar','cambiar','cobro'],
      resp:'Son los tres estados de cada socio en el cierre: <strong>⏳ Pendiente</strong> (aún no cerrado), <strong>📩 En Sobre</strong> (cerrado, pero aún no cobra — la plata queda guardada) y <strong>💵 Cobrado</strong> (cerrado y ya cobró).',
      pasos:['⏳ Pendiente: todavía no le cierras el mes','📩 En Sobre: ya lo cerraste, pero no vino a cobrar; su dinero queda en sobre','💵 Cobrado: ya cerró y cobró','El botón 💵/📩 de cada socio cerrado cambia su estado: cuando venga a cobrar el sobre, tócalo para pasarlo a Cobrado'],
      nota:'Así sabes en todo momento a quién le falta cobrar (los que están En Sobre) sin volver a calcular nada.' },

    { id:'cm4', cat:'cierre', titulo:'¿Qué hace "Archivar anticipos y empezar nuevo mes"?', tags:['archivar','finalizar','período','nuevo mes','reiniciar','vaciar','anticipos','limpiar'],
      resp:'Es el <strong>paso final del mes</strong>: mueve TODOS los anticipos del período a una pestaña de respaldo (ej. <strong>Anticipos_JULIO_2026</strong>) y limpia la hoja activa y la nube para empezar el mes nuevo <strong>desde cero</strong>.',
      pasos:['Úsalo SOLO cuando ya cerraste/cobraste a todos (idealmente el panel en verde)','Confirma el aviso: los anticipos se archivan en la pestaña del mes y se borran de lo activo','La lista de anticipos queda vacía para el mes nuevo','Los datos NO se pierden: quedan guardados en esa pestaña (y consultables en 🗂️ Carpetas)'],
      nota:'⚠️ Es una acción fuerte y no se deshace. Si aún hay socios pendientes, el botón te lo advierte con “(N pendientes)”.' },

    { id:'cm5', cat:'cierre', titulo:'¿Qué es "Reiniciar seguimiento" y qué borra?', tags:['reiniciar','seguimiento','local','borrar','estado','cobros','resetear'],
      resp:'Borra <strong>solo el seguimiento local</strong> de quién está Pendiente/En Sobre/Cobrado en este dispositivo. <strong>No borra</strong> los anticipos ni los saldos guardados en la nube/Sheets.',
      pasos:['Está abajo del panel: “↺ Reiniciar seguimiento”','Úsalo si el conteo de cobros de ESTE dispositivo quedó desordenado y quieres empezar el marcado de nuevo','Confirma el aviso','No afecta datos reales (anticipos, saldos ni archivos): solo el marcado de cobros local'],
      nota:'Distinto de “Archivar”: reiniciar seguimiento no toca datos; archivar sí mueve y limpia los anticipos.' },

    { id:'cm6', cat:'cierre', titulo:'¿Qué muestran "ANTICIPOS (Nube)" y "REMANENTES" arriba del panel?', tags:['anticipos','nube','remanentes','total','banner','cierre','detalle'],
      resp:'Son totales de referencia del período: <strong>💰 ANTICIPOS (Nube)</strong> = suma de todos los anticipos registrados, y <strong>💜 REMANENTES</strong> = suma de los sobrantes guardados como saldo del próximo mes.',
      pasos:['💰 ANTICIPOS (Nube): cuánto se ha adelantado en total este período','💜 REMANENTES: cuánto quedó guardado como saldo para el próximo mes','El botón “📋 Detalle Anticipos” abre el informe completo (para revisar o imprimir)','Se actualizan solos a medida que registras anticipos y cierras socios'],
      nota:'Sirven para tener la foto global del período de un vistazo, sin abrir socio por socio.' },
];

// ══════════════════════════════════════════════════════════
// BUSCADOR DE IDs
// ══════════════════════════════════════════════════════════
function ids_abrirModal() {
    document.getElementById('modalBuscadorIDs').style.display = 'block';
    document.getElementById('ids-search-input').value = '';
    document.getElementById('ids-resultados').innerHTML =
        '<div style="text-align:center;color:#7f8c8d;padding:30px;font-size:0.85em;">Escribe un nombre para buscar</div>';
    setTimeout(() => document.getElementById('ids-search-input').focus(), 200);
}

function ids_buscar(q) {
    const cont = document.getElementById('ids-resultados');
    const texto = q.trim().toLowerCase();
    if (!texto) {
        cont.innerHTML = '<div style="text-align:center;color:#7f8c8d;padding:30px;font-size:0.85em;">Escribe un nombre para buscar</div>';
        return;
    }
    // Usar cacheSocios ya cargado — sin llamadas al servidor
    const matches = (cacheSocios || []).filter(s =>
        (s.nombre + ' ' + s.apellido).toLowerCase().includes(texto)
        || (s.area || '').toLowerCase().includes(texto)
    );
    if (!matches.length) {
        cont.innerHTML = '<div style="text-align:center;color:#7f8c8d;padding:24px;font-size:0.85em;">😕 No se encontraron socios con ese nombre</div>';
        return;
    }
    cont.innerHTML = matches.map(s => {
        const inicial = (s.nombre || '?').charAt(0).toUpperCase();
        const nombre  = (s.nombre + ' ' + s.apellido).trim();
        const area    = s.area || '';
        const id      = s.id || 'Sin ID';
        return (
            '<div class="id-card">'
            + '<div class="id-card-info">'
            + '<div class="id-card-avatar">' + inicial + '</div>'
            + '<div style="overflow:hidden;">'
            + '<div class="id-card-nombre">' + nombre + '</div>'
            + '<div class="id-card-area">' + area + '</div>'
            + '</div></div>'
            + '<button class="id-copy-btn" onclick="ids_copiar(this,\'' + id + '\')" title="Copiar ID">'
            + '<span class="id-code">' + id + '</span>'
            + '<span class="id-copy-icon">📋</span>'
            + '</button>'
            + '</div>'
        );
    }).join('');
}

function ids_copiar(btn, id) {
    // Copiar al portapapeles
    const copia = () => {
        btn.classList.add('id-copiado');
        btn.querySelector('.id-copy-icon').textContent = '✅';
        btn.querySelector('.id-code').textContent = '¡Copiado!';
        setTimeout(() => {
            btn.classList.remove('id-copiado');
            btn.querySelector('.id-copy-icon').textContent = '📋';
            btn.querySelector('.id-code').textContent = id;
        }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(id).then(copia).catch(() => ids_copiarFallback(id, copia));
    } else {
        ids_copiarFallback(id, copia);
    }
}

function ids_copiarFallback(texto, callback) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
    if (callback) callback();
}

// ── Popovers de ayuda rápida ─────────────────────────────
function ayudaIrA(cat) {
    ayudaRapida_cerrarTodos();
    ayudaCompleta_abrir();
    setTimeout(function() {
        var t = document.querySelector('.ayuda-tag[onclick*=' + cat + ']');
        if (t) ayudaCompleta_filtrar(cat, t);
    }, 300);
}

function ayudaRapida_toggle(id, btn) {
    const pop = document.getElementById(id);
    if (!pop) return;
    const estaVisible = pop.classList.contains('visible');
    ayudaRapida_cerrarTodos();
    if (!estaVisible) {
        pop.classList.add('visible');
        // Calcular posición inteligente con position:fixed
        const rect = btn.getBoundingClientRect();
        const vw   = window.innerWidth;
        const vh   = window.innerHeight;
        const pw   = Math.min(300, vw - 24); // ancho del popover
        const margen = 8;

        // Horizontal: preferir alinear a la derecha del botón,
        // pero si se sale de pantalla, alinear a la izquierda
        let left = rect.right - pw;
        if (left < 12) left = 12;
        if (left + pw > vw - 12) left = vw - pw - 12;

        // Vertical: preferir abajo del botón,
        // si no cabe, abrir hacia arriba
        let top = rect.bottom + margen;
        // Estimar altura aproximada del popover
        pop.style.visibility = 'hidden';
        pop.style.top = '0px';
        pop.style.left = left + 'px';
        const ph = Math.min(pop.offsetHeight || 320, vh * 0.8);
        pop.style.visibility = '';
        if (top + ph > vh - 16) {
            // No cabe abajo → abrir hacia arriba
            top = Math.max(16, rect.top - ph - margen);
        }
        // Asegurar que no se sale por arriba
        if (top < 16) top = 16;

        pop.style.top  = top + 'px';
        pop.style.left = left + 'px';
        // Quitar right/bottom que puedan haber quedado
        pop.style.right  = 'auto';
        pop.style.bottom = 'auto';
    }
}
function ayudaRapida_cerrar(id) {
    const pop = document.getElementById(id);
    if (pop) pop.classList.remove('visible');
}
function ayudaRapida_cerrarTodos() {
    document.querySelectorAll('.ayuda-popover.visible').forEach(p => p.classList.remove('visible'));
}
// Cerrar popovers al tocar fuera
document.addEventListener('click', function(ev) {
    if (!ev.target.closest('.ayuda-rapida-btn') && !ev.target.closest('.ayuda-popover')) {
        ayudaRapida_cerrarTodos();
    }
});

function ayudaCompleta_abrir() {
    document.getElementById('modalAyudaCompleta').style.display = 'block';
    document.getElementById('ayudaSearchInput').value = '';
    ayudaCompleta_renderizar(BASE_CONOCIMIENTO);
    setTimeout(() => document.getElementById('ayudaSearchInput').focus(), 200);
}

function ayudaCompleta_buscar(termino) {
    const t = termino.toLowerCase().trim();
    document.querySelectorAll('.ayuda-tag').forEach(el => el.classList.remove('activo'));
    document.querySelectorAll('.ayuda-tag')[0].classList.add('activo');
    ayudaFiltroActivo = '';
    if (!t) { ayudaCompleta_renderizar(BASE_CONOCIMIENTO); return; }
    const results = BASE_CONOCIMIENTO.filter(item =>
        item.titulo.toLowerCase().includes(t) ||
        item.tags.some(tag => tag.toLowerCase().includes(t)) ||
        item.resp.toLowerCase().includes(t) ||
        (item.pasos && item.pasos.some(p => p.toLowerCase().includes(t)))
    );
    ayudaCompleta_renderizar(results, t);
}

function ayudaCompleta_filtrar(cat, btn) {
    document.querySelectorAll('.ayuda-tag').forEach(el => el.classList.remove('activo'));
    btn.classList.add('activo');
    ayudaFiltroActivo = cat;
    document.getElementById('ayudaSearchInput').value = '';
    ayudaCompleta_renderizar(cat ? BASE_CONOCIMIENTO.filter(i => i.cat === cat) : BASE_CONOCIMIENTO);
}

function ayudaCompleta_renderizar(items, resaltar) {
    const cont = document.getElementById('ayudaResultados');
    if (!items.length) { cont.innerHTML = '<div class="ayuda-sin-result">😕 No encontramos respuesta.<br><small>Intenta: anticipo, punto, arqueo, recibo, divisor...</small></div>'; return; }
    const catIcon = {socios:'👥',anticipos:'💰',recaudacion:'📊',arqueo:'🔒',puntos:'⭐',impresion:'🖨️',config:'⚙️',seguridad:'🔐',materiales:'📦',egresos:'💸',mensajes:'💬',documentacion:'📁',certificados:'📜',dineros:'💵',pindiario:'🔑',carpetas:'🗂️',notas:'📝',cierre:'🔒'};
    cont.innerHTML = items.map((item, idx) => {
        let titulo = item.titulo;
        if (resaltar) { const re = new RegExp('('+resaltar.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'); titulo = titulo.replace(re,'<span class="ayuda-highlight">$1</span>'); }
        const pasosHtml = item.pasos ? '<ol>'+item.pasos.map(p=>'<li>'+p+'</li>').join('')+'</ol>' : '';
        const notaHtml  = item.nota ? '<div class="nota">💡 '+item.nota+'</div>' : '';
        return '<div class="ayuda-resultado">'
            + '<div class="ayuda-resultado-hdr" onclick="ayudaCompleta_toggle('+idx+')">'
            + (catIcon[item.cat]||'❓')+' '+titulo
            + '<span style="margin-left:auto;color:#7f8c8d;font-size:0.85em;">▼</span>'
            + '</div>'
            + '<div class="ayuda-resultado-body" id="ayudaBody_'+idx+'">'
            + '<p>'+item.resp+'</p>'
            + (item.vista ? item.vista : '')
            + pasosHtml+notaHtml
            + '</div></div>';
    }).join('');
    if (resaltar && items.length) ayudaCompleta_toggle(0);
}

function ayudaCompleta_toggle(idx) {
    const b = document.getElementById('ayudaBody_'+idx);
    if (b) b.classList.toggle('abierto');
}
