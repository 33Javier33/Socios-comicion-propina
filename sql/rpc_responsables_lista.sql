-- ═══════════════════════════════════════════════════════════════════════
-- rpc_responsables_lista()  —  proyecto SOC (teemahksasdougehrcly)
--
-- Devuelve la lista de encargados/responsables SIN exponer ningún PIN.
-- La usa propi.solicitada para llenar el selector "Encargado que te
-- entregó el egreso".
--
-- POR QUÉ ESTA CORRECCIÓN
-- La versión anterior leía SOLO `responsable_creds`, que contiene
-- únicamente a quienes tienen un PIN personal configurado. Por eso en el
-- selector aparecía un solo encargado en vez de los tres que existen.
-- La lista real y completa la administra socios-comicion y vive en
-- `config_sistema` bajo la clave 'responsables', como JSON [{ini, area}].
--
-- Ahora se fusionan las dos fuentes y se eliminan duplicados:
--   · config_sistema['responsables'] → lista completa (la que manda)
--   · responsable_creds              → por si alguien tiene PIN pero no
--                                      figura en la lista de configuración
--
-- Es SECURITY DEFINER a propósito: así el cliente NO necesita permiso de
-- lectura sobre `config_sistema` ni sobre `responsable_creds`, y la RPC
-- sigue funcionando cuando la Fase 1b cierre el SELECT anónimo sobre esas
-- tablas.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.rpc_responsables_lista()
returns table (ini text, area text)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_json jsonb;
begin
    -- El valor se guarda como texto; si no es JSON válido no se cae, se ignora.
    begin
        select c.valor::jsonb
          into v_json
          from public.config_sistema c
         where c.clave = 'responsables'
         limit 1;

        if v_json is null or jsonb_typeof(v_json) <> 'array' then
            v_json := '[]'::jsonb;
        end if;
    exception when others then
        v_json := '[]'::jsonb;
    end;

    return query
    select t.ini, t.area
      from (
        select distinct on (lower(x.ini), lower(x.area)) x.ini, x.area
          from (
                select btrim(e->>'ini')                     as ini,
                       coalesce(btrim(e->>'area'), '')      as area
                  from jsonb_array_elements(v_json) e
                union all
                select btrim(rc.ini::text),
                       coalesce(btrim(rc.area::text), '')
                  from public.responsable_creds rc
               ) x
         where coalesce(x.ini, '') <> ''
         order by lower(x.ini), lower(x.area)
      ) t
     order by lower(t.ini), lower(t.area);
end;
$$;

-- Solo ejecutar; nadie obtiene acceso directo a las tablas de origen.
revoke all on function public.rpc_responsables_lista() from public;
grant execute on function public.rpc_responsables_lista() to anon, authenticated;

-- Comprobación rápida (debería listar los tres responsables):
--   select * from public.rpc_responsables_lista();
