-- ══════════════════════════════════════════════════════════════════════
-- ARREGLO: "new row violates row-level security policy"
--          en horarios_vacaciones_pedidos
--
-- QUÉ PASÓ
-- La tabla quedó con RLS (row level security) ACTIVADO y sin ninguna
-- política. Con RLS activado y cero políticas, Postgres niega todo a la
-- llave pública que usa la app:
--   · los INSERT/UPDATE fallan con el error que apareció en pantalla;
--   · los SELECT NO fallan — devuelven CERO filas. Eso es peor, porque
--     la sección se ve vacía y parece que no hay pedidos, en vez de
--     avisar que algo está mal.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar esto → Run.
-- Es seguro repetirlo: todo va con IF EXISTS / DROP previo.
--
-- OJO, PARA QUE QUEDE DICHO: estas políticas dejan la tabla ABIERTA a
-- cualquiera que tenga la llave pública, igual que el resto de las tablas
-- `horarios_*` que la app ya usa. No es un candado, es dejarla como sus
-- hermanas y que la app vuelva a funcionar. Cerrar de verdad el conjunto
-- `horarios_*` es otra tarea: hay que decidir antes cómo se identifica
-- cada socio contra Supabase, porque hoy la app entra con PIN propio y no
-- con usuarios de Supabase Auth.
-- ══════════════════════════════════════════════════════════════════════

alter table public.horarios_vacaciones_pedidos enable row level security;

drop policy if exists horarios_vac_pedidos_leer      on public.horarios_vacaciones_pedidos;
drop policy if exists horarios_vac_pedidos_insertar  on public.horarios_vacaciones_pedidos;
drop policy if exists horarios_vac_pedidos_actualizar on public.horarios_vacaciones_pedidos;
drop policy if exists horarios_vac_pedidos_borrar    on public.horarios_vacaciones_pedidos;

create policy horarios_vac_pedidos_leer
    on public.horarios_vacaciones_pedidos
    for select to anon, authenticated
    using (true);

create policy horarios_vac_pedidos_insertar
    on public.horarios_vacaciones_pedidos
    for insert to anon, authenticated
    with check (true);

create policy horarios_vac_pedidos_actualizar
    on public.horarios_vacaciones_pedidos
    for update to anon, authenticated
    using (true) with check (true);

create policy horarios_vac_pedidos_borrar
    on public.horarios_vacaciones_pedidos
    for delete to anon, authenticated
    using (true);

-- ── Comprobar que quedó bien ──────────────────────────────────────────
-- Tienen que salir las cuatro políticas:
--   select policyname, cmd, roles
--     from pg_policies
--    where tablename = 'horarios_vacaciones_pedidos';
