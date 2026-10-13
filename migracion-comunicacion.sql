-- ══════════════════════════════════════════════════════════════════════
-- COMUNICACIÓN CON ÁREAS  (index3.html)
--
-- Un canal para que los supervisores de área —Máquinas, Bóveda y las que
-- se agreguen— avisen de la gente que entra al Fondo Solidario. Lo que
-- mandan llega a socios-comicion, a la sección «Nuevos ingresos», donde
-- la administración lo revisa y lo aprueba o lo rechaza.
--
-- Cómo aplicarla: Supabase → SQL Editor → pegar esto → Run.
--   https://supabase.com/dashboard/project/teemahksasdougehrcly/sql/new
--
-- Es aditiva: crea dos tablas nuevas y una fila de configuración. No toca
-- nada de lo que ya existe.
--
-- ⚠️ ANTES DE EJECUTAR: respalda la base. Esto no borra nada, pero la
-- regla es la regla.
-- ══════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════
-- 1. QUIÉN ENTRA Y CON QUÉ CLAVE
--
-- Un PIN por área. Guardado SOLO como hash: ni la app ni nadie con la
-- clave pública puede leerlo.
--
-- Esto es a propósito distinto de `horarios_pins` y de la tabla vieja
-- `credenciales`, que guardan el PIN en texto plano y están abiertas al
-- rol anon: ahí cualquiera con la clave pública —que está en el código,
-- y el repo es público— se los lleva todos. Esta tabla queda CERRADA:
-- solo la Edge Function, que corre con service_role, la toca.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.comunicacion_pins (
    area           text primary key,
    pin_hash       text not null,          -- sha256(pin + ':' + area)
    creado_en      timestamptz not null default now(),
    actualizado_en timestamptz not null default now(),
    -- Para el aviso de «PIN sin estrenar»: se marca al fijarlo y se borra
    -- la primera vez que el supervisor entra con él.
    sin_estrenar   boolean not null default true
);

comment on table public.comunicacion_pins is
    'PIN de acceso por área a index3.html (Comunicación). Solo el hash; tabla cerrada a anon.';

alter table public.comunicacion_pins enable row level security;
-- Sin políticas a propósito: con RLS activo y cero políticas, el rol anon
-- no puede leer ni escribir NADA. La Edge Function usa service_role, que
-- se salta RLS. Es exactamente lo que se quiere.
revoke all on public.comunicacion_pins from anon;


-- ══════════════════════════════════════════════════════════════════════
-- 2. LO QUE MANDAN LOS SUPERVISORES
--
-- Un aviso = una persona que entra al fondo. La administración lo revisa
-- en socios-comicion y decide.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.nuevos_ingresos (
    id             text primary key,
    -- Quién lo mandó
    area           text not null,
    enviado_por    text,                   -- nombre que escribió el supervisor
    creado_en      timestamptz not null default now(),

    -- La persona que entra
    nombre         text not null,
    apellido       text,
    rut            text,
    correo         text,
    telefono       text,
    area_socio     text,                   -- el área donde va a trabajar
    contrato       text,                   -- Planta / Part-Time
    fecha_ingreso  date,
    observacion    text,

    -- Cómo quedó
    -- 'pendiente' → recién llegado, nadie lo ha visto
    -- 'aprobado'  → la administración lo creó como socio
    -- 'rechazado' → no corresponde; queda el motivo
    estado         text not null default 'pendiente',
    motivo         text,
    resuelto_en    timestamptz,
    resuelto_por   text,
    socio_id       text                    -- el socio creado, si se aprobó
);

create index if not exists nuevos_ingresos_estado on public.nuevos_ingresos (estado, creado_en desc);
create index if not exists nuevos_ingresos_area   on public.nuevos_ingresos (area);

comment on table public.nuevos_ingresos is
    'Avisos de ingreso al Fondo Solidario enviados por los supervisores de área desde index3.html.';

alter table public.nuevos_ingresos enable row level security;

drop policy if exists nuevos_ing_leer       on public.nuevos_ingresos;
drop policy if exists nuevos_ing_insertar   on public.nuevos_ingresos;
drop policy if exists nuevos_ing_actualizar on public.nuevos_ingresos;

-- Leer e insertar sí: la app de área necesita mandar y ver lo suyo, y la
-- administración necesita verlo todo.
--
-- NO se da `delete` a nadie: un aviso no se borra, se rechaza con motivo.
-- Así queda el rastro de lo que se decidió y por qué.
create policy nuevos_ing_leer       on public.nuevos_ingresos
    for select to anon, authenticated using (true);
create policy nuevos_ing_insertar   on public.nuevos_ingresos
    for insert to anon, authenticated with check (estado = 'pendiente');
create policy nuevos_ing_actualizar on public.nuevos_ingresos
    for update to anon, authenticated using (true) with check (true);


-- ══════════════════════════════════════════════════════════════════════
-- 3. LA CLAVE DE ADMINISTRACIÓN
--
-- Es la que se pide en socios-comicion para fijar o quitar los PIN de
-- área. NO va en el código: en diario.propi quedó escrita en
-- `js/diario-pins.js`, en un repositorio público, así que cualquiera
-- puede leerla y ponerle o quitarle el PIN a quien quiera. Acá se guarda
-- solo el hash y la clave la escribe la persona cada vez.
--
-- ⚠️ CAMBIA 'CAMBIA-ESTA-CLAVE' POR LA TUYA ANTES DE EJECUTAR.
--    Elige algo largo, que no uses en otra parte, y no la escribas en
--    ningún archivo del repositorio.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.config_seguridad (
    clave      text primary key,
    valor      text not null,
    creado_en  timestamptz not null default now()
);
alter table public.config_seguridad enable row level security;
revoke all on public.config_seguridad from anon;   -- cerrada, como los PIN

insert into public.config_seguridad (clave, valor)
values ('comunicacion_admin_hash', encode(digest('CAMBIA-ESTA-CLAVE', 'sha256'), 'hex'))
on conflict (clave) do update set valor = excluded.valor;
-- Si `digest` no existe:  create extension if not exists pgcrypto;  y repite.


-- ══════════════════════════════════════════════════════════════════════
-- COMPROBAR QUE QUEDÓ
-- ══════════════════════════════════════════════════════════════════════
--   select count(*) from public.nuevos_ingresos;
--   select area, sin_estrenar from public.comunicacion_pins;
--   select policyname, cmd from pg_policies where tablename = 'nuevos_ingresos';
--
-- Y que las cerradas están de verdad cerradas (deben dar 0 filas o error
-- de permiso al consultarlas con la clave pública desde el navegador):
--   select * from public.comunicacion_pins;
