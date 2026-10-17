-- ════════════════════════════════════════════════════════════════════
-- AVISOS DE TURNO QUE LLEGAN CON LA APP CERRADA
--
-- ANTES DE PEGAR ESTO: haz el respaldo del proyecto de socios (SOC).
--
-- Qué resuelve
-- ------------
-- Hoy los avisos de Horarios los dispara la propia página: un
-- temporizador mientras la app está abierta, y `periodicSync` cuando el
-- navegador quiere (en iPhone no existe, en Android casi nunca corre).
-- Con la app cerrada no llega nada, y al abrirla aparecía de golpe lo
-- que ya había vencido.
--
-- Lo único que llega con la app cerrada es Web Push. La pieza que
-- faltaba del lado del servidor es ésta: una tabla con los avisos
-- programados y una tarea que, cada pocos minutos, manda los que ya
-- vencieron usando la Edge Function `push-notify` que ya existe y que
-- hoy le avisa al administrador.
--
-- Por qué la app escribe el plan y no se calcula acá
-- --------------------------------------------------
-- El turno de un socio en una fecha sale de la rotación de su grupo más
-- sus excepciones, y esa lógica vive en `index2.html`
-- (`turnoDeSocioEnFecha`). Rehacerla en SQL sería una segunda copia de
-- una regla delicada, y en esta misma app ya pasó tres veces que dos
-- copias de la misma regla terminaran diciendo cosas distintas. Así que
-- la app publica el plan de los próximos 7 días y acá solo se envía.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. La tabla de avisos programados ──────────────────────────────
create table if not exists public.horarios_avisos (
    id          uuid primary key default gen_random_uuid(),
    socio_id    text        not null,
    -- La llave es «AAAA-MM-DD|tipo» y la pone la app. Con el unique de
    -- abajo, volver a abrir la app actualiza el aviso en vez de duplicarlo.
    llave       text        not null,
    cuando      timestamptz not null,
    titulo      text        not null,
    cuerpo      text        not null default '',
    enviado_en  timestamptz,
    creado_en   timestamptz not null default now(),
    constraint horarios_avisos_socio_llave unique (socio_id, llave)
);

create index if not exists horarios_avisos_pendientes
    on public.horarios_avisos (cuando)
    where enviado_en is null;

alter table public.horarios_avisos enable row level security;

-- La app entra con la clave anónima, igual que el resto de Horarios.
-- Cada socio solo escribe lo suyo no se puede exigir acá porque la app
-- no usa Supabase Auth; queda al mismo nivel que `horarios_excepciones`.
drop policy if exists horarios_avisos_todos on public.horarios_avisos;
create policy horarios_avisos_todos on public.horarios_avisos
    for all using (true) with check (true);

-- ── 2. El envío ────────────────────────────────────────────────────
-- Llama a `push-notify` (la misma que usa el admin) por cada aviso
-- vencido y lo marca. `pg_net` ya está en uso en este proyecto para los
-- triggers de push del administrador.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.horarios_enviar_avisos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    a         record;
    enviados  integer := 0;
    v_url     text;
    v_key     text;
begin
    -- Mismos valores que usan los triggers de push ya existentes.
    -- Si en tu proyecto están guardados con otro nombre, ajústalos acá.
    v_url := current_setting('app.settings.supabase_url', true);
    v_key := current_setting('app.settings.service_role_key', true);
    if v_url is null or v_key is null then
        raise notice 'Faltan app.settings.supabase_url / service_role_key';
        return 0;
    end if;

    for a in
        select * from public.horarios_avisos
        where enviado_en is null
          and cuando <= now()
          -- Un aviso de hace más de 2 horas ya no sirve: el turno
          -- empezó. Se marca sin mandarlo, para no despertar al socio
          -- con un recordatorio inútil.
          and cuando > now() - interval '2 hours'
        order by cuando
        limit 200
    loop
        perform net.http_post(
            url     := v_url || '/functions/v1/push-notify',
            headers := jsonb_build_object(
                'Content-Type',  'application/json',
                'Authorization', 'Bearer ' || v_key
            ),
            body    := jsonb_build_object(
                'socio_id', a.socio_id,
                'title',    a.titulo,
                'body',     a.cuerpo,
                'url',      '/index2.html'
            )
        );
        update public.horarios_avisos set enviado_en = now() where id = a.id;
        enviados := enviados + 1;
    end loop;

    -- Los vencidos hace rato se cierran sin enviar.
    update public.horarios_avisos
       set enviado_en = now()
     where enviado_en is null
       and cuando <= now() - interval '2 hours';

    -- Y lo viejo se borra, que esta tabla no es un historial.
    delete from public.horarios_avisos where cuando < now() - interval '15 days';

    return enviados;
end;
$$;

-- ── 3. Cada 5 minutos ──────────────────────────────────────────────
-- El aviso «entras en 3 horas» puede salir hasta 5 minutos tarde, que
-- para un recordatorio de 3 horas no cambia nada.
select cron.unschedule('horarios-avisos')
 where exists (select 1 from cron.job where jobname = 'horarios-avisos');

select cron.schedule('horarios-avisos', '*/5 * * * *',
                     $$select public.horarios_enviar_avisos();$$);

-- ── Para comprobar que quedó andando ───────────────────────────────
-- select * from cron.job where jobname = 'horarios-avisos';
-- select * from public.horarios_avisos order by cuando desc limit 20;
-- select public.horarios_enviar_avisos();   -- fuerza un envío ahora
