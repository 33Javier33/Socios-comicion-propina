// ══════════════════════════════════════════════════════════════════════
// comunicacion-auth — el portero de index3.html (Comunicación)
//
// POR QUÉ EXISTE
// El PIN de cada área nunca puede viajar al navegador. En esta misma
// base hay dos tablas que sí lo hacen —`horarios_pins` y `credenciales`,
// con el PIN en texto plano y abiertas al rol anon— y con la clave
// pública, que está en el código de un repositorio público, cualquiera
// se los lleva todos. Acá el PIN se guarda SOLO como hash, la tabla está
// cerrada a anon, y la comparación ocurre en este servidor.
//
// Y la clave de administración tampoco va en el código. En
// `js/diario-pins.js` quedó escrita ('pinadm_…'), así que cualquiera que
// lea el repositorio puede ponerle o quitarle el PIN a quien quiera.
// Acá la escribe la persona cada vez y se compara contra un hash que
// vive en `config_seguridad`.
//
// CÓMO DESPLEGARLA
//   1. Supabase → Edge Functions → Deploy a new function
//   2. Nombre exacto:  comunicacion-auth
//   3. Pegar este archivo completo
//   4. En Settings de la función, marcar  verify_jwt = false
//      (la app la llama con la clave pública, no con un JWT de usuario)
//
// ACCIONES
//   verificar {area, pin}              → { ok, area, sinEstrenar }
//   fijar     {area, pin, adminPass}   → { ok }
//   quitar    {area, adminPass}        → { ok }
//   estado    {adminPass}              → { ok, areas: [{area, sinEstrenar}] }
// ══════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' }
    });

async function sha256(txt: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// El hash del PIN lleva el área dentro: así dos áreas con el mismo PIN no
// terminan con el mismo hash, y no se puede copiar uno de un área a otra.
const hashPin = (pin: string, area: string) => sha256(String(pin) + ':' + String(area));

// Comparación en tiempo constante: comparar con === deja filtrar, por el
// tiempo que tarda, cuántos caracteres del principio acertaste.
function igualesSeguro(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let dif = 0;
    for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return dif === 0;
}

const normArea = (a: unknown) =>
    String(a || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/\s+/g, '').trim();

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false } }
    );

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ ok: false, reason: 'cuerpo inválido' }); }

    const accion = String(body.action || '');
    const area   = normArea(body.area);

    // ── Comprobar la clave de administración ──────────────────────────
    // Se pide para todo lo que cambia quién entra. No se guarda en ningún
    // archivo: la escribe la persona y acá se compara contra el hash.
    async function esAdmin(): Promise<boolean> {
        const pass = String(body.adminPass || '');
        if (!pass) return false;
        const { data } = await admin.from('config_seguridad')
            .select('valor').eq('clave', 'comunicacion_admin_hash').maybeSingle();
        if (!data || !data.valor) return false;
        return igualesSeguro(await sha256(pass), String(data.valor));
    }

    // ── El supervisor entra ───────────────────────────────────────────
    if (accion === 'verificar') {
        const pin = String(body.pin || '');
        if (!area || !/^\d{4,8}$/.test(pin)) return json({ ok: false, reason: 'datos incompletos' });

        const { data } = await admin.from('comunicacion_pins')
            .select('pin_hash, sin_estrenar').eq('area', area).maybeSingle();
        if (!data) return json({ ok: false, reason: 'esa área todavía no tiene clave' });

        if (!igualesSeguro(await hashPin(pin, area), String(data.pin_hash)))
            return json({ ok: false, reason: 'clave incorrecta' });

        // Primera entrada: deja de estar «sin estrenar».
        if (data.sin_estrenar) {
            await admin.from('comunicacion_pins')
                .update({ sin_estrenar: false }).eq('area', area);
        }
        return json({ ok: true, area, sinEstrenar: !!data.sin_estrenar });
    }

    // ── La administración fija la clave de un área ────────────────────
    if (accion === 'fijar') {
        if (!await esAdmin()) return json({ ok: false, reason: 'clave de administración incorrecta' });
        const pin = String(body.pin || '');
        if (!area) return json({ ok: false, reason: 'falta el área' });
        if (!/^\d{4,8}$/.test(pin)) return json({ ok: false, reason: 'el PIN son 4 a 8 dígitos' });

        const { error } = await admin.from('comunicacion_pins').upsert({
            area,
            pin_hash: await hashPin(pin, area),
            actualizado_en: new Date().toISOString(),
            sin_estrenar: true
        }, { onConflict: 'area' });
        if (error) return json({ ok: false, reason: error.message });
        return json({ ok: true });
    }

    // ── La administración le quita el acceso a un área ────────────────
    if (accion === 'quitar') {
        if (!await esAdmin()) return json({ ok: false, reason: 'clave de administración incorrecta' });
        if (!area) return json({ ok: false, reason: 'falta el área' });
        const { error } = await admin.from('comunicacion_pins').delete().eq('area', area);
        if (error) return json({ ok: false, reason: error.message });
        return json({ ok: true });
    }

    // ── Qué áreas tienen clave (nunca cuál) ───────────────────────────
    if (accion === 'estado') {
        if (!await esAdmin()) return json({ ok: false, reason: 'clave de administración incorrecta' });
        const { data } = await admin.from('comunicacion_pins').select('area, sin_estrenar');
        return json({ ok: true, areas: (data || []).map(r => ({ area: r.area, sinEstrenar: !!r.sin_estrenar })) });
    }

    return json({ ok: false, reason: 'acción desconocida' });
});
