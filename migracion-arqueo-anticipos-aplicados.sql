-- ════════════════════════════════════════════════════════════════════
-- QUE EL ARQUEO NO VUELVA A PERDER LA RESTA DE UN ANTICIPO
--
-- ANTES DE PEGAR ESTO: haz el respaldo del proyecto de socios (SOC).
--
-- Qué resuelve
-- ------------
-- Al registrar un anticipo pasan tres cosas:
--
--   1. se restan los billetes del conteo de arqueo,
--   2. el anticipo entra en la tabla `anticipos`  → «ANTICIPOS (Nube)»,
--   3. el desglose de billetes entra en `retiros_anticipos`.
--
-- Las dos últimas son hechos propios en la nube y no se pisan. La
-- primera no: el conteo es UNA sola fila (`arqueo_estado`, periodo
-- 'actual') que se guarda entera, así que el último dispositivo que
-- escribe manda. Si un equipo con el conteo viejo guarda después del
-- que registró el anticipo, la resta desaparece — y el arqueo queda
-- con un sobrante igual al anticipo, porque los billetes siguen
-- contados y además se suman como anticipo.
--
-- El 22/10 se perdieron así $266.000 de $1.026.000: los tres registros
-- estaban completos y solo faltaba la resta en el conteo.
--
-- La columna
-- ----------
-- `anticipos_aplicados` guarda las firmas (folios ATC-…) de los
-- desgloses que YA están restados de este conteo. Va en la MISMA fila
-- que el conteo, y a propósito: las dos cosas se escriben juntas, así
-- que no pueden quedar en desacuerdo. Si alguien pisa el conteo con
-- uno viejo, también pisa la lista con la vieja, y la app ve que
-- faltan firmas y vuelve a restar lo que corresponde. Se arregla sola.
--
-- Guardar la lista aparte (en el teléfono, o en otra fila) no serviría:
-- volvería a haber dos cosas que pueden desincronizarse, que es el
-- problema que se está arreglando.
-- ════════════════════════════════════════════════════════════════════

alter table public.arqueo_estado
    add column if not exists anticipos_aplicados jsonb not null default '[]'::jsonb;

-- ── 2. Sembrar la lista con lo que YA está descontado ──────────────
-- La columna nace vacía, y una lista vacía significa "no se ha restado
-- ninguno". Dejarla así haría que la app restara del conteo TODOS los
-- anticipos del período, cuando la mayoría ya estaban restados: el
-- conteo se iría muy abajo de golpe.
--
-- No hay forma de saber desde la base cuáles de las restas sobrevivieron
-- y cuáles se perdieron, así que se parte del supuesto seguro: todos
-- están aplicados. Equivocarse hacia "ya estaba restado" deja el conteo
-- como está hoy; equivocarse hacia "falta restarlo" lo descuadra.
--
-- Lo que de verdad falte se quita a mano con el paso 3.
with p as (
    select case when extract(day from current_date) >= 15
                then date_trunc('month', current_date)::date + 14
                else (date_trunc('month', current_date) - interval '1 month')::date + 14
           end as inicio
), q as (
    select inicio, (inicio + interval '1 month' - interval '1 day')::date as fin from p
)
update public.arqueo_estado ae
   set anticipos_aplicados = coalesce((
           select jsonb_agg(r.firma)
             from public.retiros_anticipos r, q
            where r.firma is not null
              and r.fecha >= q.inicio
              and r.fecha <= q.fin
       ), '[]'::jsonb)
 where coalesce(jsonb_array_length(ae.anticipos_aplicados), 0) = 0;

-- ── 3. (Opcional) Marcar como NO descontados los de un día ─────────
-- Para recuperar una resta que sí se perdió. Al quitar esas firmas de la
-- lista, la app las ve como pendientes y resta esos billetes del conteo
-- la próxima vez que se abra el arqueo. Cambia la fecha antes de correr.
--
-- update public.arqueo_estado
--    set anticipos_aplicados = (
--        select coalesce(jsonb_agg(f), '[]'::jsonb)
--          from jsonb_array_elements_text(anticipos_aplicados) as f
--         where f not in (select firma from public.retiros_anticipos
--                          where fecha = '2026-10-22' and firma is not null)
--    );

-- ── Para comprobar que quedó ───────────────────────────────────────
-- select periodo, jsonb_array_length(anticipos_aplicados) as aplicados
--   from public.arqueo_estado;
