-- ══════════════════════════════════════════════════════════════════════
-- CUMPLEAÑOS Y SU DÍA LIBRE  (app de Horarios, index2.html)
--
-- Dos cosas, las dos aditivas:
--   1) la fecha de nacimiento del socio,
--   2) el turno «Cumpleaños», que es el día libre que se marca en el
--      calendario el día que cumple.
--
-- Cómo aplicarla: Supabase → SQL Editor → pegar esto → Run.
-- No toca ninguna columna ni fila que ya exista, así que las apps
-- hermanas (socios-comicion, diario.propi, propi.solicitada) siguen
-- funcionando igual con o sin esto.
-- ══════════════════════════════════════════════════════════════════════

-- 1. La fecha de nacimiento. Va en `socios` porque es un dato de la
--    persona, no del horario: así mañana cualquier app puede usarlo.
--    Queda NULL para todos hasta que el supervisor la vaya cargando.
alter table public.socios
    add column if not exists fecha_nacimiento date;

comment on column public.socios.fecha_nacimiento is
    'Fecha de nacimiento. La app de Horarios la usa para el día libre de cumpleaños.';

-- 2. El turno del día libre de cumpleaños.
--    Es un turno libre más, con su propio id para poder distinguirlo de
--    un LIBRE de ciclo y de un LXF: en el calendario sale con su 🎂 y se
--    puede contar aparte.
insert into public.horarios_turnos (id, nombre, color, es_libre, orden)
values ('t_cumple', 'Cumpleaños', '#f472b6', true, 90)
on conflict (id) do nothing;
