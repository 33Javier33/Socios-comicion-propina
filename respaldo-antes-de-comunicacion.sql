-- ══════════════════════════════════════════════════════════════════════
-- RESPALDO ANTES DE APLICAR «COMUNICACIÓN CON ÁREAS»
--
-- Qué hace: copia las tablas importantes a un esquema aparte,
-- `respaldo_comunicacion`, dentro de la misma base. No toca ni una fila
-- de lo original: solo lee y copia.
--
-- Por qué estas tablas y no todas:
--   · `socios` es la única que la función nueva llega a ESCRIBIR — cuando
--     la administración aprueba un aviso, crea el socio ahí.
--   · Las de dinero van igual, porque si algo saliera mal con `socios`
--     conviene tener la foto completa del mismo momento para compararlas.
--
-- La migración de Comunicación es ADITIVA: crea tablas nuevas y no
-- modifica ninguna de estas. Aun así, el respaldo va primero.
--
-- Dónde pegarlo:
--   https://supabase.com/dashboard/project/teemahksasdougehrcly/sql/new
-- ══════════════════════════════════════════════════════════════════════

create schema if not exists respaldo_comunicacion;

-- Si ya corriste este archivo antes, las copias viejas se reemplazan.
-- (Se borran solo las COPIAS, dentro del esquema de respaldo. Las tablas
--  de verdad, en `public`, no se tocan en ningún momento.)
drop table if exists respaldo_comunicacion.socios;
drop table if exists respaldo_comunicacion.anticipos;
drop table if exists respaldo_comunicacion.extras;
drop table if exists respaldo_comunicacion.saldos_socio;
drop table if exists respaldo_comunicacion.dias_pt;
drop table if exists respaldo_comunicacion.config_sistema;

create table respaldo_comunicacion.socios         as select * from public.socios;
create table respaldo_comunicacion.anticipos      as select * from public.anticipos;
create table respaldo_comunicacion.extras         as select * from public.extras;
create table respaldo_comunicacion.saldos_socio   as select * from public.saldos_socio;
create table respaldo_comunicacion.dias_pt        as select * from public.dias_pt;
create table respaldo_comunicacion.config_sistema as select * from public.config_sistema;

-- Queda anotado cuándo se tomó.
create table if not exists respaldo_comunicacion._cuando (
    tomado_en timestamptz not null default now(),
    motivo    text
);
insert into respaldo_comunicacion._cuando (motivo)
values ('Antes de aplicar migracion-comunicacion.sql (index3.html)');


-- ══════════════════════════════════════════════════════════════════════
-- COMPROBAR QUE EL RESPALDO QUEDÓ BIEN
--
-- Las dos columnas tienen que dar el MISMO número en cada fila. Si alguna
-- no coincide, no sigas: avísame antes de aplicar la migración.
-- ══════════════════════════════════════════════════════════════════════
select 'socios'         as tabla,
       (select count(*) from public.socios)                     as original,
       (select count(*) from respaldo_comunicacion.socios)      as respaldo
union all select 'anticipos',
       (select count(*) from public.anticipos),
       (select count(*) from respaldo_comunicacion.anticipos)
union all select 'extras',
       (select count(*) from public.extras),
       (select count(*) from respaldo_comunicacion.extras)
union all select 'saldos_socio',
       (select count(*) from public.saldos_socio),
       (select count(*) from respaldo_comunicacion.saldos_socio)
union all select 'dias_pt',
       (select count(*) from public.dias_pt),
       (select count(*) from respaldo_comunicacion.dias_pt)
union all select 'config_sistema',
       (select count(*) from public.config_sistema),
       (select count(*) from respaldo_comunicacion.config_sistema);


-- ══════════════════════════════════════════════════════════════════════
-- SI ALGÚN DÍA HAY QUE VOLVER ATRÁS
--
-- No lo ejecutes ahora. Queda acá anotado para cuando haga falta, y
-- conviene avisarme antes: restaurar PISA lo que haya en ese momento.
--
--   begin;
--     delete from public.socios;
--     insert into public.socios select * from respaldo_comunicacion.socios;
--   commit;
--
-- Y para deshacer lo que agrega Comunicación (tampoco ahora):
--   drop table if exists public.nuevos_ingresos;
--   drop table if exists public.comunicacion_pins;
--   delete from public.config_seguridad where clave = 'comunicacion_admin_hash';
-- ══════════════════════════════════════════════════════════════════════
