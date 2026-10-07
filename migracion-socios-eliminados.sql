-- ══════════════════════════════════════════════════════════════════════
-- RESPALDO DE SOCIOS ELIMINADOS
--
-- Hoy, al eliminar un socio pasa una de dos cosas:
--   · si NO tiene movimientos, se borra de verdad y no queda nada más que
--     una línea en la auditoría;
--   · si tiene movimientos, se desactiva (activo = false) y su historial
--     sigue en las tablas, pero no hay ninguna pantalla donde verlo.
--
-- Esta tabla guarda, en el momento del borrado, TODO lo que se sabía del
-- socio: su ficha de gestión y todos sus movimientos de anticipos y
-- ausencias. Queda como una foto, independiente de lo que pase después
-- con las tablas vivas.
--
-- Cómo aplicarla: Supabase → SQL Editor → pegar esto → Run.
-- Es aditiva: crea una tabla nueva y no toca nada de lo que ya existe.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.socios_eliminados (
    id             text primary key,
    socio_id       text not null,
    nombre         text,
    apellido       text,
    rut            text,
    correo         text,
    area           text,
    contrato       text,
    puntos         numeric,
    fecha_ingreso  date,
    -- 'eliminado'   → se borró de la tabla socios
    -- 'desactivado' → sigue en socios con activo = false
    -- 'recuperado'  → respaldo armado después, de alguien ya dado de baja
    modo           text not null default 'eliminado',
    eliminado_en   timestamptz not null default now(),
    eliminado_por  text,
    -- La foto completa: ficha + anticipos + extras + retiros + cierres +
    -- saldos + días PT + lo que se encuentre. Va en JSON para no tener que
    -- tocar esta tabla cada vez que aparezca un dato nuevo que guardar.
    datos          jsonb not null default '{}'::jsonb
);

-- Un socio puede aparecer más de una vez (se dio de baja, volvió, se fue
-- otra vez), así que el índice no es único: ordena por fecha.
create index if not exists socios_eliminados_socio on public.socios_eliminados (socio_id);
create index if not exists socios_eliminados_fecha on public.socios_eliminados (eliminado_en desc);

comment on table public.socios_eliminados is
    'Respaldo de socios eliminados: la foto completa de su ficha y sus movimientos al momento del borrado.';

-- ── Políticas de acceso ───────────────────────────────────────────────
-- Igual que el resto de las tablas que la app consulta con la llave
-- pública. Si el proyecto tiene RLS activado y la tabla no trae políticas,
-- los INSERT fallan y los SELECT devuelven cero filas sin avisar.
alter table public.socios_eliminados enable row level security;

drop policy if exists socios_elim_leer     on public.socios_eliminados;
drop policy if exists socios_elim_insertar on public.socios_eliminados;
drop policy if exists socios_elim_borrar   on public.socios_eliminados;

create policy socios_elim_leer     on public.socios_eliminados
    for select to anon, authenticated using (true);
create policy socios_elim_insertar on public.socios_eliminados
    for insert to anon, authenticated with check (true);
create policy socios_elim_borrar   on public.socios_eliminados
    for delete to anon, authenticated using (true);

-- ── Comprobar que quedó ───────────────────────────────────────────────
--   select count(*) from public.socios_eliminados;
--   select policyname, cmd from pg_policies where tablename = 'socios_eliminados';
