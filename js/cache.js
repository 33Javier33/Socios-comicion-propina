// ============================================================
// CACHÉ EN LOCALSTORAGE
// ============================================================

function guardarCache(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch(e) {}
}
function leerCache(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (Date.now() - obj.ts > CACHE_TTL) return null;
        return obj.data;
    } catch(e) { return null; }
}

// Trae todos los anticipos/extras en UNA llamada y los guarda en memoria
async function fetchAllDataCached(forzar = false) {
    if (!forzar && globalCacheAllData) return globalCacheAllData;
    // Intentar desde localStorage primero
    if (!forzar) {
        try {
            const stored = localStorage.getItem(CACHE_KEY_ALL_DATA);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Caché válido por 5 minutos
                if (parsed.ts && (Date.now() - parsed.ts) < 5 * 60 * 1000) {
                    globalCacheAllData = parsed.data;
                    return globalCacheAllData;
                }
            }
        } catch(e) {}
    }
    const res = await fetch(URL_SOCIOS, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getAllDataDesdeSheets' })
    }).then(r => r.json());
    globalCacheAllData = { anticipos: res.anticipos || {}, extras: res.extras || {} };
    try { localStorage.setItem(CACHE_KEY_ALL_DATA, JSON.stringify({ ts: Date.now(), data: globalCacheAllData })); } catch(e) {}
    return globalCacheAllData;
}
