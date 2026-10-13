-- ══════════════════════════════════════════════════════════════════════
-- PASO 2b — TU CLAVE DE ADMINISTRACIÓN
--
-- Cambia SOLO la palabra entre comillas de la línea de abajo. Nada más.
-- Esa es la clave que te va a pedir socios-comicion para poner y quitar
-- las claves de las áreas.
--
-- Elige algo largo y que no uses en otra parte. No la escribas en ningún
-- archivo del repositorio: acá solo se guarda su huella, no la clave.
-- Si la pierdes, vuelves a ejecutar este mismo archivo con otra.
--
-- Pegar en:
--   https://supabase.com/dashboard/project/teemahksasdougehrcly/sql/new
-- ══════════════════════════════════════════════════════════════════════

insert into public.config_seguridad (clave, valor)
values ('comunicacion_admin_hash',
        encode(digest('pon-aqui-tu-clave', 'sha256'), 'hex'))
on conflict (clave) do update set valor = excluded.valor;
--                    ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
--            ESTO es lo único que cambias


-- Comprobar que quedó (debe devolver una fila, y NO tu clave):
select clave, left(valor, 12) || '…' as huella
  from public.config_seguridad
 where clave = 'comunicacion_admin_hash';
