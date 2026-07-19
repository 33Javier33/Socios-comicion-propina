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
    // Enfocar PIN
    setTimeout(() => document.getElementById('pinInput').focus(), 300);
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
        if (typeof egresos_initRealtime === 'function') egresos_initRealtime();
        if (typeof egresos_cargarPendientes === 'function') egresos_cargarPendientes();
        if (typeof ptdias_initRealtime === 'function') ptdias_initRealtime();
        if (typeof ptdias_cargarPendientes === 'function') ptdias_cargarPendientes();
    }
    else if(tabName === 'recaudacion') { fabRec.style.display = 'flex'; aq_detenerSync(); cargarRecaudaciones(); }
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
    else if(tabName === 'mensajes') { fabRec.style.display = 'none'; aq_detenerSync(); msgAdmin_init(); }
    else if(tabName === 'desglose') { fabRec.style.display = 'none'; aq_detenerSync(); if(typeof dsg_cargarHistorial === 'function' && _dsgRegistros.length === 0) dsg_cargarHistorial(); }
    else if(tabName === 'mesesant') { fabRec.style.display = 'none'; aq_detenerSync(); if(typeof mesesAnt_init === 'function') mesesAnt_init(); }
}

// ── Sidebar + drag-to-reorder ────────────────────────────────
const NAV_ORDER_KEY = 'fondo_nav_order';

function initLayout() {
    const container = document.querySelector('.container');
    const headerSection = container.querySelector('.header-section');
    const navTabs = container.querySelector('.nav-tabs');
    const tabContents = Array.from(container.querySelectorAll('.tab-content'));

    nav_restoreOrder(navTabs);

    if (window.innerWidth >= 900) {
        // Desktop: sidebar fijo a la izquierda
        const layout = document.createElement('div');
        layout.className = 'app-layout';
        const sidebar = document.createElement('div');
        sidebar.className = 'app-sidebar';
        sidebar.appendChild(navTabs);
        const main = document.createElement('div');
        main.className = 'app-main';
        tabContents.forEach(tc => main.appendChild(tc));
        layout.appendChild(sidebar);
        layout.appendChild(main);
        headerSection.insertAdjacentElement('afterend', layout);
    } else {
        // Mobile: barra + drawer desde abajo
        navTabs.style.display = 'none';

        // Barra de navegación mobile (muestra sección activa + botón menú)
        const mobileBar = document.createElement('div');
        mobileBar.id = 'mobileNavBar';
        mobileBar.innerHTML = `
            <span id="mobileActiveLabel">Gestión de Socios</span>
            <button id="mobileMenuBtn" onclick="mobileNav_open()">☰ Secciones</button>`;
        headerSection.insertAdjacentElement('afterend', mobileBar);

        // Drawer overlay
        const drawer = document.createElement('div');
        drawer.id = 'mobileDrawer';
        drawer.onclick = e => { if (e.target === drawer) mobileNav_close(); };
        drawer.innerHTML = `
            <div id="mobileDrawerPanel">
                <div id="mobileDrawerHeader">
                    <span>Secciones <small style="font-size:0.7em;color:#94a3b8;font-weight:500">— mantén para reordenar</small></span>
                    <button id="mobileDrawerClose" onclick="mobileNav_close()">✕</button>
                </div>
                <div id="mobileDrawerNav"></div>
            </div>`;
        document.body.appendChild(drawer);

        // Mover los botones al drawer (lista vertical)
        const drawerNav = document.getElementById('mobileDrawerNav');
        navTabs.style.cssText = 'display:flex;flex-direction:column;gap:6px;border:none;margin:0;padding:0;overflow:visible;background:none;';
        drawerNav.appendChild(navTabs);

        // Cerrar drawer al pulsar una sección
        navTabs.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => setTimeout(mobileNav_close, 80));
        });
    }
}

function mobileNav_open() {
    const d = document.getElementById('mobileDrawer');
    if (d) d.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function mobileNav_close() {
    const d = document.getElementById('mobileDrawer');
    if (d) d.classList.remove('open');
    document.body.style.overflow = '';
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
            ts = { btn, startX: e.touches[0].clientX, startY: e.touches[0].clientY, isDragging: false };
        }, { passive: true });

        btn.addEventListener('touchmove', e => {
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
                else { await callApiSocios('addSocio', { socio: d }); showToast('Socio registrado', 'success'); }
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
