-- ============================================================
-- ENDURECIMIENTO DE SEGURIDAD — PROYECTO SOC (teemahksasdougehrcly)
-- FASE 1a: BASE (ya aplicada). Solo agrega infraestructura.
-- No modifica RLS existente => la app sigue funcionando igual.
--
-- IMPORTANTE: el secreto de servicio NO va en este archivo. Se guarda
-- HASHEADO en config_seguridad mediante un INSERT manual del administrador.
-- ============================================================

-- 1) Secretos del sistema (hash sha256). Sin acceso para anon.
create table if not exists public.config_seguridad (
  clave text primary key,
  valor text not null,
  updated_at timestamptz not null default now()
);
alter table public.config_seguridad enable row level security;
revoke all on public.config_seguridad from anon, authenticated;

-- 2) Registro de intentos, para bloquear fuerza bruta.
create table if not exists public.rpc_intentos (
  id bigserial primary key,
  origen text not null default 'anon',
  ok boolean not null default false,
  creado_en timestamptz not null default now()
);
create index if not exists rpc_intentos_creado_idx on public.rpc_intentos (creado_en desc);
alter table public.rpc_intentos enable row level security;
revoke all on public.rpc_intentos from anon, authenticated;

-- 3) Helpers internos.
create or replace function public._sec_hash(p_texto text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(coalesce(p_texto,''), 'UTF8')), 'hex');
$$;

-- Valida el secreto de servicio. 5 fallos en 15 min => bloqueado.
create or replace function public._sec_validar(p_secreto text)
returns void language plpgsql security definer set search_path = public as $$
declare v_hash text; v_fallos int;
begin
  select count(*) into v_fallos from public.rpc_intentos
   where ok = false and creado_en > now() - interval '15 minutes';
  if v_fallos >= 5 then
    raise exception 'Bloqueado temporalmente por intentos fallidos. Espera 15 minutos.';
  end if;
  select valor into v_hash from public.config_seguridad where clave = 'secreto_servicio';
  if v_hash is null or public._sec_hash(p_secreto) is distinct from v_hash then
    insert into public.rpc_intentos (ok) values (false);
    raise exception 'Credenciales invalidas';
  end if;
  delete from public.rpc_intentos where creado_en < now() - interval '1 hour';
  insert into public.rpc_intentos (ok) values (true);
end; $$;

revoke all on function public._sec_hash(text) from public, anon, authenticated;
revoke all on function public._sec_validar(text) from public, anon, authenticated;

-- 4) RPC de autenticación: verifican el PIN EN EL SERVIDOR.
--    Permiten cerrar responsable_creds / config_sistema al rol anon
--    sin romper el login (los PIN nunca viajan al navegador).
--    Ver funciones aplicadas: rpc_responsables_lista, rpc_verificar_pin_responsable,
--    rpc_verificar_pin_global, rpc_verificar_clave_recup, rpc_config_publica.
--    (Definiciones completas en las migraciones de Supabase.)

-- ============================================================
-- FASE 1b (PENDIENTE — NO aplicar sin validar la app):
--   a) Bloquear SELECT de anon en: responsable_creds, config_sistema,
--      credenciales, historial_conexiones, horarios_pins.
--   b) Bloquear UPDATE/DELETE de anon en tablas críticas.
--   c) Habilitar RLS en las que hoy la tienen DESACTIVADA:
--      arqueo_backups, arqueo_cierres, arqueo_estado, certificados,
--      cierres_mes, cierres_mes_historial, retiros_anticipos.
--   d) Mover a RPC los borrados masivos (reiniciar anticipos/ausencias,
--      archivar periodo, cierre de mes, eliminar socio, cambiar config/PINs).
-- ============================================================
