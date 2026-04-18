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
        <div class="ayuda-vista-titulo">📊 Así se ve el dashboard de socios</div>
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
      pasos:['Los 6 números del dashboard (Total Socios, Total Puntos, Pts Planta, S. Planta, S. Part-Time, Escalamientos) se actualizan solos al cargar','Presiona el nombre de cada área para desplegar las tarjetas de sus socios','Cada tarjeta muestra nombre, contrato, puntos actuales y botones de acción','El botón 🏆 Escalamientos te avisa quién sube puntos este mes o el próximo'],
      nota:'Los socios con fecha de inicio de puntos en el futuro aparecen en la lista pero NO suman al total de puntos.' },

    { id:'s2', cat:'socios', titulo:'¿Cómo funciona el escalamiento de puntos?', tags:['escalamiento','puntos','años','tope','antigüedad'],
      resp:'Cada año de antigüedad en el casino suma <strong>+2 puntos</strong> al socio, comenzando desde 4 puntos base. Cada área tiene un tope que no se puede superar.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">⭐ Topes por área</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <div class="ayuda-mini-card"><strong>🎰 Mesas</strong><div style="color:#2563eb;font-weight:900;">Máx 20 pts</div></div>
          <div class="ayuda-mini-card"><strong>🎮 Máquinas</strong><div style="color:#7c3aed;font-weight:900;">Máx 12 pts</div></div>
          <div class="ayuda-mini-card"><strong>🔧 Técnicos</strong><div style="color:#7f8c8d;font-weight:900;">Máx 12 pts</div></div>
          <div class="ayuda-mini-card"><strong>🏦 Bóveda</strong><div style="color:#27ae60;font-weight:900;">Máx 10 pts</div></div>
          <div class="ayuda-mini-card"><strong>💱 Cambistas</strong><div style="color:#9b59b6;font-weight:900;">Máx 8 pts</div></div>
          <div class="ayuda-mini-card"><strong>📋 G. Comisión</strong><div style="color:#607d8b;font-weight:900;">Máx 1 pt</div></div>
        </div>
        <div class="ayuda-formula" style="margin-top:8px;">Puntos = 4 + (años × 2) → hasta el tope del área</div>
      </div>`,
      pasos:['El sistema calcula los puntos automáticamente según la fecha de ingreso','Cuando un socio cumple años en el trabajo, aparece en el panel 🏆 Escalamientos','Si ya llegó al tope de su área, el recibo muestra "TOPE MÁXIMO"','La fecha de inicio de puntos puede ser diferente a la de ingreso (ej: si tuvo un período sin puntos)'],
      nota:'El 🏆 en el dashboard muestra quiénes escalan este mes, el mes pasado y el próximo.' },

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

    { id:'a3', cat:'anticipos', titulo:'¿Cómo elimino un anticipo por error?', tags:['eliminar','borrar','anticipo','error','corregir'],
      resp:'En la tabla de historial del socio, <strong>mantén presionado</strong> el registro que quieres eliminar durante 1 segundo.',
      vista:`<div class="ayuda-vista">
        <div class="ayuda-vista-titulo">🗑️ Eliminar un anticipo</div>
        <div class="ayuda-mini-card">
          <div style="display:grid;grid-template-columns:auto 1fr auto auto;gap:8px;align-items:center;font-size:0.82em;">
            <div>19/03</div><div style="color:#2980b9;font-weight:700;">Anticipo</div><div>Adelanto</div>
            <div style="color:#e74c3c;font-weight:700;">-$50.000</div>
          </div>
          <div style="margin-top:8px;padding:6px;background:#fff3cd;border-radius:6px;font-size:0.75em;text-align:center;">
            👆 Mantén presionado 1 seg → aparece confirmación
          </div>
        </div>
      </div>`,
      pasos:['Selecciona el socio','En la tabla inferior, localiza el anticipo a eliminar','Mantén presionado por 1 segundo','Confirma la eliminación en el diálogo'],
      nota:'⚠️ Esta acción no se puede deshacer. Asegúrate antes de confirmar.' },

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
      pasos:['Presiona "➕ Nueva Recaudación" en la barra superior','Selecciona el tipo: Sala de Juegos, Efectivo MDA, Tarjeta MDA o Bóveda','Ingresa la fecha de la noche y el monto','El divisor es opcional — si no lo sabes, déjalo vacío y lo ingresas después desde la tarjeta del día','Presiona Guardar'],
      nota:'Puedes ingresar varios tipos para el mismo día (ej: Mesas + Efectivo MDA + Bóveda). Cada uno va por separado.' },

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
          ⚠️ Los días sin divisor muestran badge rojo y NO suman al total
        </div>
      </div>`,
      pasos:['Si no ingresas divisor al crear, la tarjeta muestra ⚠️ badge rojo','Ese día no suma al Cierre de Punto (protección contra inflación)','Cuando conozcas el divisor, ingrésalo en el campo de la tarjeta del día','El sistema recalcula automáticamente al guardar'],
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
      pasos:['Presiona "💵 Conteo" en la barra del arqueo','Ingresa cuántos billetes/monedas hay de cada denominación ($20.000, $10.000, etc.)','El total se calcula automáticamente','Presiona "✅ Realizar Arqueo" para ver si cuadra','Si hay diferencia: revisa retiros y anticipos ingresados antes de cerrar'],
      nota:'Verde = cuadrado. Amarillo = sobrante. Rojo = faltante. Guarda con ☁️ Guardar para no perder el progreso.' },

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
      resp:'En la pantalla de login hay un enlace <strong>"¿Olvidaste el PIN?"</strong>. Al presionarlo, puedes ingresar la Clave de Recuperación para restablecer el acceso.',
      pasos:['En la pantalla de ingreso de PIN, presiona "¿Olvidaste el PIN?" (enlace pequeño bajo el campo)','Ingresa la Clave de Recuperación que configuraste','Si es correcta, podrás establecer un nuevo PIN','Si tampoco recuerdas la Clave de Recuperación, deberás editar el archivo HTML directamente'],
      nota:'⚠️ Si pierdes tanto el PIN como la Clave de Recuperación, contacta al administrador técnico del sistema. Por eso es vital guardar la clave en un lugar seguro.' },
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
    const catIcon = {socios:'👥',anticipos:'💰',recaudacion:'📊',arqueo:'🔒',puntos:'⭐',impresion:'🖨️',config:'⚙️'};
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
