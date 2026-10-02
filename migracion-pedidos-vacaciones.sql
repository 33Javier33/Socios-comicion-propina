-- ══════════════════════════════════════════════════════════════════════
-- PEDIDOS DE VACACIONES  (app de Horarios, index2.html)
--
-- Un pedido NO marca el calendario. Es la intención: "en enero digo que
-- quiero salir en noviembre". El supervisor lo ve con tiempo, decide, y
-- cuando llega el momento marca las fechas de verdad con el motor de
-- vacaciones de siempre.
--
-- Cómo aplicarla: Supabase → SQL Editor → pegar esto → Run.
-- Es aditiva: crea una tabla nueva y no toca nada de lo que ya existe.
--
-- Nota sobre RLS: se deja abierta como el resto de las tablas `horarios_*`,
-- que la app consulta con la llave pública. Si algún día se cierran todas,
-- esta tiene que cerrarse con ellas.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.horarios_vacaciones_pedidos (
    id          text primary key,
    socio_id    text not null references public.socios(id) on delete cascade,
    anio        int  not null,
    mes         int  not null check (mes between 1 and 12),
    -- Qué piensa tomar: 'v15', 'v6', 'ambos', o null si todavía no lo sabe.
    tipo        text,
    -- pendiente → el supervisor no ha respondido
    -- aceptado  → aprobado, falta marcar las fechas
    -- rechazado → con su motivo
    -- cumplido  → ya se marcaron las fechas en el calendario
    estado      text not null default 'pendiente',
    motivo      text,
    origen      text not null default 'socio',   -- socio | supervisor
    nota        text,
    creado_en   timestamptz not null default now(),
    resuelto_en timestamptz
);

-- Un socio no puede pedir dos veces el mismo mes. Si cambia de idea, se
-- actualiza el pedido que ya existe en vez de acumular duplicados.
create unique index if not exists horarios_vac_pedidos_unico
    on public.horarios_vacaciones_pedidos (socio_id, anio, mes);

-- La vista por mes del supervisor consulta por año y mes.
create index if not exists horarios_vac_pedidos_mes
    on public.horarios_vacaciones_pedidos (anio, mes);

comment on table public.horarios_vacaciones_pedidos is
    'Intención de vacaciones: el socio pide un MES con anticipación. No marca el calendario; eso lo hace el supervisor con horarios_vacaciones.';
