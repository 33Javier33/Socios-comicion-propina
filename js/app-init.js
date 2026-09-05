// ============================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Si hay sesión activa, mostrar app directamente
    if (sessionStorage.getItem(SESSION_KEY) === 'ok') {
        document.getElementById('loginOverlay').style.display = 'none';
        iniciarApp();
        return;
    }
    // Poblar selector inmediatamente con lo que haya en localStorage
    responsables_poblarLoginSelector();
    // Refrescar lista de responsables y credenciales desde Supabase en background.
    // sbCargarResponsables lee config_sistema directamente (sin pasar por GAS).
    // Si localStorage estaba vacío o desactualizado, el selector se re-pobla solo.
    if (typeof window.sbCargarResponsables === 'function') window.sbCargarResponsables();
    cfg_cargarDesdeSupabase().catch(() => {});
    cargarCredenciales().catch(() => {});
    // Enfocar PIN + ojito para revisar lo escrito
    setTimeout(() => document.getElementById('pinInput').focus(), 300);
    if (typeof cfg_ponerOjo === 'function') cfg_ponerOjo(document.getElementById('pinInput'));
});

function iniciarApp() {
    const hoy = new Date();
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('fechaHoyBadge').textContent = hoy.toLocaleDateString('es-ES', opciones);
    const todayISO = hoy.toISOString().split('T')[0];
    document.getElementById('fechaAnticipo').value = todayISO;
    document.getElementById('fechaAusencia').value = todayISO;
    iniciarWatchdogInactividad();
    responsables_poblarSelector();
    // Mostrar badge responsable en header
    const rObj = getSesionResponsableObj();
    const rBadge = document.getElementById('sesionRespBadge');
    const rNombre = document.getElementById('sesionRespNombre');
    if (rBadge && rObj.ini) { rNombre.textContent = rObj.ini + ' (' + rObj.area + ')'; rBadge.style.display = 'block'; }
    initLayout();
    initDragReorder();
    initScrollTopFab();
    // Mensajes privados admin↔socio: aviso en el nav aunque no se abra la pestaña
    if (typeof msgAdmin_initRealtime === 'function') { msgAdmin_initRealtime(); setTimeout(msgAdmin_cargarResumen, 1500); }
    // Centro de notificaciones (campana): egresos y días PT también se cargan al
    // arrancar para que la campana funcione desde cualquier pestaña (no solo en Gestión).
    if (typeof egresos_initRealtime === 'function') egresos_initRealtime();
    if (typeof egresos_cargarPendientes === 'function') setTimeout(egresos_cargarPendientes, 1600);
    // Presencia en recaudación: escuchar quién está ingresando en las otras apps
    if (typeof window.recPresIniciar === 'function') window.recPresIniciar();
    // Registro de actividad de socios (conexión / entrada a recaudación)
    if (typeof conexionesLog_initRealtime === 'function') conexionesLog_initRealtime();
    if (typeof conexionesLog_cargar === 'function') setTimeout(conexionesLog_cargar, 1800);
    if (typeof conexionesLog_limpiarViejos === 'function') setTimeout(conexionesLog_limpiarViejos, 9000);
    if (typeof ptdias_initRealtime === 'function') ptdias_initRealtime();
    if (typeof ptdias_cargarPendientes === 'function') setTimeout(ptdias_cargarPendientes, 1700);
    // Anticipos en vivo: si otro encargado registra uno, esta pantalla se actualiza sola
    if (typeof anticipos_initRealtime === 'function') anticipos_initRealtime();
    // Estado de Cobros sincronizado entre dispositivos (realtime + carga inicial)
    if (typeof cierresMes_initRealtime === 'function') cierresMes_initRealtime();
    if (typeof cierresMes_sincronizar === 'function') setTimeout(() => cierresMes_sincronizar(true), 1200);
    if(!URL_SOCIOS || URL_SOCIOS.includes('PEGA_AQUI')) {
        alert('Falta configurar URL_SOCIOS');
    } else {
        precargarTodo();
    }
}

// Precarga paralela de TODOS los datos al entrar
async function precargarTodo() {
    fetchSociosDeGoogle();
    cargarRecaudaciones(true);
    cargarCredenciales(); // PINs personales desde Supabase (responsable_creds)
    cfg_cargarDesdeSupabase(); // PIN global, clave recuperación y responsables desde Supabase
    if (typeof window.sbSyncResponsables === 'function') window.sbSyncResponsables();

    await Promise.allSettled([
        fetch(URL_RECAUDACIONES + '?action=getNotes&t=' + Date.now())
            .then(r => r.json())
            .then(json => {
                const notas = (json.data||json.result||[]).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
                guardarCache(CACHE_KEY_NOTAS, notas);
            }).catch(() => {}),

        fetch(AQ_URL_GET)
            .then(r => r.json())
            .then(data => {
                if (data && data.totalAcumulado !== undefined) {
                    localStorage.setItem('fondo_cache_aq_esperado', JSON.stringify({ ts: Date.now(), data }));
                }
            }).catch(() => {}),
    ]);
}

function switchTab(tabName) {
    if (tabName === 'config') setTimeout(cfg_renderResponsables, 50);
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn[data-tab]').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    const mobileLabel = document.getElementById('mobileActiveLabel');
    if (mobileLabel && activeBtn) mobileLabel.textContent = activeBtn.textContent.trim();
    const fabRec = document.getElementById('fabRecAgregar');
    document.getElementById('fabMatAgregar').style.display = 'none';
    if(tabName === 'registro') { fabRec.style.display = 'none'; aq_detenerSync(); }
    else if(tabName === 'gestion') {
        fabRec.style.display = 'none'; aq_detenerSync();
        gestionSociosConMovimientos = {};
        gestionFiltroActivo = 'todos';
        ['Todos','Anticipos','Ausencias'].forEach((t,i) => {
            const btn = document.getElementById('filtroGestion'+t);
            const colores = ['var(--secondary)','var(--warning)','var(--danger)'];
            if(btn) { btn.style.background = i===0 ? colores[i] : 'white'; btn.style.color = i===0 ? 'white' : colores[i]; }
        });
        renderizarListaBusqueda();
        gestion_cargarTotalAnticipos();
        gestion_cargarTotalRemanentes();
        gestion_cargarRemanenteVivo();
        cierresMes_render();
        if (typeof anticipos_initRealtime === 'function') anticipos_initRealtime();
        if (typeof egresos_initRealtime === 'function') egresos_initRealtime();
        if (typeof egresos_cargarPendientes === 'function') egresos_cargarPendientes();
        if (typeof ptdias_initRealtime === 'function') ptdias_initRealtime();
        if (typeof ptdias_cargarPendientes === 'function') ptdias_cargarPendientes();
    }
    else if(tabName === 'recaudacion') {
        fabRec.style.display = 'flex'; aq_detenerSync(); cargarRecaudaciones();
        // Presencia: la comisión también se anuncia mientras está en Recaudación
        if (typeof window.recPresEntrar === 'function') {
            const _r = (typeof getSesionResponsableObj === 'function') ? getSesionResponsableObj() : {};
            window.recPresEntrar((_r && _r.ini) ? (_r.ini + (_r.area ? ' ' + _r.area : '')) : 'Comisión', '');
        }
    }
    else if(tabName === 'config') { fabRec.style.display = 'none'; aq_detenerSync(); cfg_limpiarCampos(); }
    else if(tabName === 'arqueo') { fabRec.style.display = 'none'; aq_initSiNoIniciado(); aq_arrancarSync(); }
    else if(tabName === 'notas') { fabRec.style.display = 'none'; aq_detenerSync(); localStorage.setItem('_rec_last_seen', Date.now()); notasCargar(); }
    else if(tabName === 'auditoria') { fabRec.style.display = 'none'; aq_detenerSync(); auditoria_cargar(); }
    else if(tabName === 'carpetas') { fabRec.style.display = 'none'; aq_detenerSync(); carpetas_renderArchivero(); }
    else if(tabName === 'materiales') { fabRec.style.display = 'none'; document.getElementById('fabMatAgregar').style.display = 'flex'; aq_detenerSync(); mat_cargar(); }
    else if(tabName === 'dineros') { fabRec.style.display = 'none'; aq_detenerSync(); ds_cargar(); }
    else if(tabName === 'certificados') { fabRec.style.display = 'none'; aq_detenerSync(); cert_init(); }
    else if(tabName === 'diariopins') { fabRec.style.display = 'none'; aq_detenerSync(); dp_init(); }
    else if(tabName === 'documentacion') { fabRec.style.display = 'none'; aq_detenerSync(); doc_init(); }
    else if(tabName === 'donaciones') { fabRec.style.display = 'none'; aq_detenerSync(); don_init(); }
    else if(tabName === 'mensajes') { fabRec.style.display = 'none'; aq_detenerSync(); msgAdmin_init(); }
    else if(tabName === 'desglose') { fabRec.style.display = 'none'; aq_detenerSync(); if(typeof dsg_cargarHistorial === 'function' && _dsgRegistros.length === 0) dsg_cargarHistorial(); }
    else if(tabName === 'mesesant') { fabRec.style.display = 'none'; aq_detenerSync(); if(typeof mesesAnt_init === 'function') mesesAnt_init(); }
}

// ── Sidebar + drag-to-reorder ────────────────────────────────
const NAV_ORDER_KEY = 'fondo_nav_order';

// ══════════════════════════════════════════════════════════════════════
// LAYOUT — escritorio (barra lateral) vs celular (barra + cajón)
//
// Antes esto se armaba UNA sola vez al iniciar y no reaccionaba a cambios de
// tamaño. Al minimizar y volver a maximizar la ventana en un computador se
// cruzaba el corte de 900px y el menú quedaba inservible: si la app había
// arrancado en tamaño chico, los botones estaban dentro del cajón (oculto en
// escritorio) y no había barra lateral; al revés, la barra lateral quedaba
// escondida por CSS y nunca se creaba la barra de celular. Solo se arreglaba
// recargando. Ahora el layout se puede desmontar y volver a montar, y se
// recalcula cuando la ventana cruza el corte.
// ══════════════════════════════════════════════════════════════════════
const LAYOUT_CORTE = 900;
let _layoutModo = null;      // 'escritorio' | 'celular'
let _layoutPiezas = null;    // posición y estilo originales de lo que se mueve

// Se guarda una sola vez, ANTES de mover nada, para poder volver al original.
function _layoutGuardarOriginal() {
    if (_layoutPiezas) return;
    const container = document.querySelector('.container');
    if (!container) return;
    const orden = [
        container.querySelector('.nav-tabs'),
        document.getElementById('recPresenciaCard'),
        document.getElementById('actividadCard'),
        ...Array.from(container.querySelectorAll('.tab-content'))
    ].filter(Boolean);
    _layoutPiezas = orden.map(el => ({ el, style: el.getAttribute('style') }));
}

// Devuelve todo a la estructura original del HTML y borra lo que se creó.
function _layoutDesmontar() {
    if (!_layoutPiezas) return;
    const container = document.querySelector('.container');
    const header = container && container.querySelector('.header-section');
    if (!header) return;
    // Se reinsertan en cadena justo después del encabezado, en su orden
    // original, sin depender de qué más haya en el contenedor.
    let ancla = header;
    _layoutPiezas.forEach(({ el, style }) => {
        ancla.insertAdjacentElement('afterend', el);
        ancla = el;
        if (style === null) el.removeAttribute('style'); else el.setAttribute('style', style);
    });
    document.querySelectorAll('.app-layout').forEach(n => n.remove());
    const mb = document.getElementById('mobileNavBar'); if (mb) mb.remove();
    const dr = document.getElementById('mobileDrawer'); if (dr) dr.remove();
    _navModoMover = false;
    _navSeleccion = null;
    document.body.style.overflow = '';
    _layoutModo = null;
}

function initLayout() {
    const container = document.querySelector('.container');
    if (!container) return;
    const modo = window.innerWidth >= LAYOUT_CORTE ? 'escritorio' : 'celular';
    if (_layoutModo === modo) return;      // nada que hacer

    _layoutGuardarOriginal();
    _layoutDesmontar();

    const headerSection = container.querySelector('.header-section');
    const navTabs = container.querySelector('.nav-tabs');
    const tabContents = Array.from(container.querySelectorAll('.tab-content'));
    if (!headerSection || !navTabs) return;

    nav_restoreOrder(navTabs);

    if (modo === 'escritorio') {
        // Escritorio: barra lateral fija a la izquierda
        const layout = document.createElement('div');
        layout.className = 'app-layout';
        const sidebar = document.createElement('div');
        sidebar.className = 'app-sidebar';
        sidebar.appendChild(navTabs);
        const main = document.createElement('div');
        main.className = 'app-main';
        // La tarjeta de presencia va ARRIBA de la columna principal (si se queda
        // fuera del layout cae al final de la página y se ve mal en escritorio).
        const presCard = document.getElementById('recPresenciaCard');
        if (presCard) main.appendChild(presCard);
        const actCard = document.getElementById('actividadCard');
        if (actCard) main.appendChild(actCard);
        tabContents.forEach(tc => main.appendChild(tc));
        layout.appendChild(sidebar);
        layout.appendChild(main);
        headerSection.insertAdjacentElement('afterend', layout);
    } else {
        // Celular: barra + cajón desde abajo
        navTabs.style.display = 'none';

        // Barra de navegación mobile (muestra sección activa + botón menú)
        const mobileBar = document.createElement('div');
        mobileBar.id = 'mobileNavBar';
        mobileBar.innerHTML = `
            <span id="mobileActiveLabel">Gestión de Socios</span>
            <button id="mobileMenuBtn" onclick="mobileNav_open()">☰ Secciones</button>`;
        headerSection.insertAdjacentElement('afterend', mobileBar);
        // La tarjeta de presencia queda justo debajo de la barra de secciones
        const presCardM = document.getElementById('recPresenciaCard');
        if (presCardM) mobileBar.insertAdjacentElement('afterend', presCardM);
        const actCardM = document.getElementById('actividadCard');
        if (actCardM && presCardM) presCardM.insertAdjacentElement('afterend', actCardM);

        // Drawer overlay
        const drawer = document.createElement('div');
        drawer.id = 'mobileDrawer';
        drawer.onclick = e => { if (e.target === drawer) mobileNav_close(); };
        drawer.innerHTML = `
            <div id="mobileDrawerPanel">
                <div id="mobileDrawerHeader">
                    <span>Secciones</span>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <button id="mobileDrawerMover" onclick="mobileNav_toggleMover()">↕ Mover</button>
                        <button id="mobileDrawerClose" onclick="mobileNav_close()">✕</button>
                    </div>
                </div>
                <div id="mobileMoverBarra">
                    <span id="mobileMoverTexto">Toca la sección que quieres mover</span>
                    <div style="display:flex;gap:6px;flex-shrink:0;">
                        <button onclick="mobileNav_moverSel(-1)" title="Subir">▲</button>
                        <button onclick="mobileNav_moverSel(1)" title="Bajar">▼</button>
                        <button onclick="mobileNav_toggleMover()" class="listo">✓ Listo</button>
                    </div>
                </div>
                <div id="mobileDrawerNav"></div>
            </div>`;
        document.body.appendChild(drawer);

        // Mover los botones al drawer (lista vertical)
        const drawerNav = document.getElementById('mobileDrawerNav');
        navTabs.style.cssText = 'display:flex;flex-direction:column;gap:6px;border:none;margin:0;padding:0;overflow:visible;background:none;';
        drawerNav.appendChild(navTabs);

        // En modo mover, tocar una sección la selecciona en lugar de abrirla.
        // Va en fase de CAPTURA sobre el contenedor para adelantarse al
        // onclick="switchTab(...)" que cada botón trae en su atributo.
        drawerNav.addEventListener('click', e => {
            if (!_navModoMover) return;
            const b = e.target.closest('.nav-btn[data-tab]');
            if (!b) return;
            e.preventDefault();
            e.stopPropagation();
            mobileNav_seleccionar(b === _navSeleccion ? null : b);
        }, true);

        // Cerrar drawer al pulsar una sección. El guard evita duplicar el
        // listener si se vuelve a montar el layout al cambiar de tamaño.
        navTabs.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
            if (btn.dataset.cierraDrawer === '1') return;
            btn.dataset.cierraDrawer = '1';
            btn.addEventListener('click', () => { if (!_navModoMover) setTimeout(mobileNav_close, 80); });
        });

        // Poner en la barra el nombre de la sección que está abierta
        const activo = document.querySelector('.nav-btn[data-tab].active');
        const label = document.getElementById('mobileActiveLabel');
        if (activo && label) label.textContent = activo.textContent.trim();
    }

    _layoutModo = modo;
}

// Rearmar el layout cuando la ventana cruza el corte (minimizar/maximizar,
// rotar el dispositivo, arrastrar el borde de la ventana). initLayout() sale
// solo si el modo no cambió, así que esto no cuesta nada mientras se arrastra.
let _layoutResizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(_layoutResizeTimer);
    _layoutResizeTimer = setTimeout(initLayout, 150);
});

function mobileNav_open() {
    const d = document.getElementById('mobileDrawer');
    if (d) d.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function mobileNav_close() {
    const d = document.getElementById('mobileDrawer');
    if (d) d.classList.remove('open');
    document.body.style.overflow = '';
    if (_navModoMover) mobileNav_toggleMover();   // salir del modo mover al cerrar
}

// ── Modo "Mover secciones" ────────────────────────────────────────────
// El arrastre táctil hacía preventDefault() apenas el dedo se movía 10px en
// CUALQUIER dirección, así que deslizar para hacer scroll dentro del menú
// arrastraba una sección en vez de desplazar la lista: en celular no se podía
// llegar a las secciones de abajo. Ahora el reordenamiento vive en un modo
// aparte: mientras está apagado (lo normal) el dedo solo hace scroll.
let _navModoMover = false;
let _navSeleccion = null;

function mobileNav_toggleMover() {
    _navModoMover = !_navModoMover;
    const nav = document.getElementById('mobileDrawerNav');
    const btn = document.getElementById('mobileDrawerMover');
    const barra = document.getElementById('mobileMoverBarra');
    if (nav) nav.classList.toggle('modo-mover', _navModoMover);
    if (barra) barra.style.display = _navModoMover ? 'flex' : 'none';
    if (btn) {
        btn.textContent = _navModoMover ? '✓ Listo' : '↕ Mover';
        btn.classList.toggle('activo', _navModoMover);
    }
    mobileNav_seleccionar(null);
}

function mobileNav_seleccionar(btn) {
    document.querySelectorAll('#mobileDrawerNav .nav-btn.sel-mover').forEach(b => b.classList.remove('sel-mover'));
    _navSeleccion = btn || null;
    if (_navSeleccion) _navSeleccion.classList.add('sel-mover');
    const txt = document.getElementById('mobileMoverTexto');
    if (txt) {
        txt.textContent = _navSeleccion
            ? _navSeleccion.textContent.trim()
            : 'Toca la sección que quieres mover';
        txt.style.fontWeight = _navSeleccion ? '800' : '500';
    }
}

// Mueve la sección seleccionada una posición arriba (-1) o abajo (+1)
function mobileNav_moverSel(dir) {
    if (!_navSeleccion) { showToast('Primero toca la sección que quieres mover', 'info'); return; }
    const btn = _navSeleccion;
    const hermanos = Array.from(btn.parentNode.querySelectorAll('.nav-btn[data-tab]'));
    const i = hermanos.indexOf(btn);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= hermanos.length) return;
    if (dir < 0) btn.parentNode.insertBefore(btn, hermanos[j]);
    else btn.parentNode.insertBefore(hermanos[j], btn);
    nav_saveOrder();
    try { btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch(e) {}
}

function initDragReorder() {
    const btns = document.querySelectorAll('.nav-btn[data-tab]');

    // ── HTML5 drag (desktop) ──────────────────────────────────
    btns.forEach(btn => {
        btn.setAttribute('draggable', 'true');
        btn.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', btn.dataset.tab);
            btn.classList.add('dragging');
        });
        btn.addEventListener('dragend', () => {
            btn.classList.remove('dragging');
            document.querySelectorAll('.nav-btn[data-tab]').forEach(b => b.classList.remove('drag-over'));
            nav_saveOrder();
        });
        btn.addEventListener('dragover', e => {
            e.preventDefault();
            document.querySelectorAll('.nav-btn[data-tab]').forEach(b => b.classList.remove('drag-over'));
            btn.classList.add('drag-over');
        });
        btn.addEventListener('drop', e => {
            e.preventDefault();
            const draggedTab = e.dataTransfer.getData('text/plain');
            const draggedBtn = document.querySelector(`.nav-btn[data-tab="${draggedTab}"]`);
            if (draggedBtn && draggedBtn !== btn) btn.parentNode.insertBefore(draggedBtn, btn);
            btn.classList.remove('drag-over');
        });
    });

    // ── Touch drag (mobile) ───────────────────────────────────
    let ts = null; // { btn, startX, startY, isDragging }

    btns.forEach(btn => {
        btn.addEventListener('touchstart', e => {
            // Fuera del modo mover no se arrastra nada: el dedo hace scroll.
            if (!_navModoMover) { ts = null; return; }
            ts = { btn, startX: e.touches[0].clientX, startY: e.touches[0].clientY, isDragging: false };
        }, { passive: true });

        btn.addEventListener('touchmove', e => {
            if (!_navModoMover) return;
            if (!ts || ts.btn !== btn) return;
            const dx = e.touches[0].clientX - ts.startX;
            const dy = e.touches[0].clientY - ts.startY;
            if (!ts.isDragging && Math.sqrt(dx * dx + dy * dy) < 10) return;
            if (!ts.isDragging) { ts.isDragging = true; btn.classList.add('dragging'); }
            e.preventDefault();
            const touch = e.touches[0];
            btn.style.visibility = 'hidden';
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            btn.style.visibility = '';
            document.querySelectorAll('.nav-btn[data-tab]').forEach(b => b.classList.remove('drag-over'));
            const target = el && el.closest('[data-tab]');
            if (target && target !== btn) target.classList.add('drag-over');
        }, { passive: false });

        btn.addEventListener('touchend', e => {
            if (!_navModoMover) return;
            if (!ts || ts.btn !== btn) return;
            if (ts.isDragging) {
                const touch = e.changedTouches[0];
                btn.style.visibility = 'hidden';
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                btn.style.visibility = '';
                document.querySelectorAll('.nav-btn[data-tab]').forEach(b => b.classList.remove('drag-over'));
                const target = el && el.closest('[data-tab]');
                if (target && target !== btn) target.parentNode.insertBefore(btn, target);
                btn.classList.remove('dragging');
                nav_saveOrder();
            }
            ts = null;
        }, { passive: true });
    });
}

function nav_saveOrder() {
    const order = Array.from(document.querySelectorAll('.nav-btn[data-tab]')).map(b => b.dataset.tab);
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order));
}

function nav_restoreOrder(parent) {
    try {
        const saved = JSON.parse(localStorage.getItem(NAV_ORDER_KEY) || '[]');
        if (!saved.length) return;
        const p = parent || document.querySelector('.nav-btn[data-tab]')?.parentNode;
        if (!p) return;
        const ayudaBtn = p.querySelector('button:not([data-tab])');
        saved.forEach(tab => {
            const btn = p.querySelector(`.nav-btn[data-tab="${tab}"]`);
            if (btn) p.appendChild(btn);
        });
        if (ayudaBtn) p.appendChild(ayudaBtn);
    } catch(e) {}
}

function abrirModalRegistro() { document.getElementById('modalRegistro').style.display = 'block'; if(!isEditing) { document.getElementById('registroForm').reset(); document.getElementById('editId').value = ''; document.getElementById('modalTitle').innerText = 'Nuevo Socio'; document.getElementById('btnSubmit').innerText = 'Registrar Socio'; } }
function cerrarModalRegistro() { document.getElementById('modalRegistro').style.display = 'none'; isEditing = false; document.getElementById('registroForm').reset(); document.getElementById('editId').value = ''; document.getElementById('fechaInicioPuntos').value = ''; }

window.addEventListener('click', function(e) {
    ['aq-modalConteo','aq-modalBackup','aq-modalEdicion','aq-modalStats','modalCanje','modalEditarAnticipo','modalReinicioMes','modalAyudaCompleta','modalBuscadorIDs','modalReiniciarDiasPT','modalReiniciarAusencias'].forEach(id => {
        const el = document.getElementById(id);
        if(el && e.target === el) el.style.display = 'none';
    });
    const am = document.getElementById('about-modal');
    if (am && e.target === am) am.style.display = 'none';
});

function toggleAbout(show) {
    document.getElementById('about-modal').style.display = show ? 'flex' : 'none';
}

// ── registroForm submit ───────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    const registroForm = document.getElementById('registroForm');
    if (registroForm) {
        registroForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const fechaInicioRaw = document.getElementById('fechaInicioPuntos').value;
            // Regla del día 15: siempre guardar el día 15 del mes seleccionado
            const fechaInicioVal = normalizarFechaInicioPuntos(fechaInicioRaw);
            const d = { Nombre: document.getElementById('nombre').value, Apellido: document.getElementById('apellido').value, FechaIngreso: document.getElementById('fechaIngreso').value, Area: document.getElementById('area').value, TipoContrato: document.getElementById('contrato').value, FechaInicioPuntos: fechaInicioVal || '' };
            const idEdit = document.getElementById('editId').value;
            // RUT (opcional): validar/formatear si viene
            const _rutRaw = (document.getElementById('rutSocio')?.value || '').trim();
            let _rutFmt = '';
            if (_rutRaw) {
                if (typeof _rutValidar === 'function' && !_rutValidar(_rutRaw)) { showToast('RUT no válido. Ej: 12.345.678-9', 'error'); return; }
                _rutFmt = (typeof _rutFormat === 'function') ? _rutFormat(_rutRaw) : _rutRaw;
            }
            // Correo (opcional): validar formato si viene
            const _correoRaw = (document.getElementById('correoSocio')?.value || '').trim().toLowerCase();
            if (_correoRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(_correoRaw)) { showToast('Correo no válido. Ej: nombre@correo.com', 'error'); return; }
            toggleLoader(true, isEditing ? "Actualizando..." : "Guardando...");
            try {
                if (isEditing) {
                    await callApiSocios('updateSocio', { socioId: idEdit, updates: d });
                    // Guardar el RUT directo en Supabase (socios.rut)
                    await callApiSocios('guardarRutSocio', { socioId: idEdit, rut: _rutFmt, nombre: (d.Nombre + ' ' + d.Apellido).trim() });
                    // Guardar el correo directo en Supabase (socios.correo)
                    await callApiSocios('guardarCorreoSocio', { socioId: idEdit, correo: _correoRaw, nombre: (d.Nombre + ' ' + d.Apellido).trim() });
                    const _sc = (cacheSocios || []).find(s => s.id === idEdit); if (_sc) { _sc.rut = _rutFmt; _sc.correo = _correoRaw; }
                    showToast('Socio actualizado', 'success');
                }
                else {
                    const _resAdd = await callApiSocios('addSocio', { socio: d });
                    // El socio se escribió en Sheets (GAS). Pero la lista se lee de
                    // Supabase PRIMERO, y ahí el socio recién existe tras el "seed" en
                    // segundo plano → por eso a veces no aparecía al instante.
                    // Fix: escribirlo de inmediato en Supabase (misma fuente que lee
                    // la lista) para que se vea al toque, sin esperar el seed.
                    const _nuevo = _resAdd && _resAdd.data;
                    if (_nuevo && _nuevo.ID && typeof dbSoc !== 'undefined') {
                        try {
                            const _row = {
                                id: String(_nuevo.ID),
                                nombre: _nuevo.Nombre || '',
                                apellido: _nuevo.Apellido || '',
                                area: _nuevo.Area || '',
                                contrato: _nuevo.TipoContrato || '',
                                fecha_ingreso: _nuevo.FechaIngreso || null,
                                fecha_inicio_puntos: _nuevo.FechaInicioPuntos || d.FechaInicioPuntos || null
                            };
                            if (_rutFmt)     _row.rut = _rutFmt;       // RUT del formulario (antes se perdía en alta)
                            if (_correoRaw)  _row.correo = _correoRaw; // Correo del formulario (antes se perdía en alta)
                            await dbSoc.from('socios').upsert(_row, { onConflict: 'id' });
                        } catch(_e) { console.warn('[addSocio] upsert Supabase falló, quedará por el seed:', _e && _e.message); }
                    }
                    showToast('Socio registrado', 'success');
                }
                cerrarModalRegistro(); fetchSociosDeGoogle();
            } catch (e) { showToast('Error al guardar', 'error'); } finally { toggleLoader(false); }
        });
    }
});

// Auto-refresh de recaudaciones y notas cada 5 segundos
setInterval(() => {
    if (typeof cargarRecaudaciones === 'function') cargarRecaudaciones(true);
    const notasTab = document.getElementById('tab-notas');
    if (notasTab && notasTab.classList.contains('active') && typeof notasCargar === 'function') notasCargar();
}, 5000);
