-- ═══════════════════════════════════════════════════════════════════════
-- Publicar `anticipos` en Realtime — proyecto SOC (teemahksasdougehrcly)
--
-- OPCIONAL. La app ya se actualiza entre dispositivos sin esto, porque
-- además del canal `postgres_changes` emite un aviso propio (broadcast) al
-- guardar, y ese no depende de ninguna configuración en la base.
--
-- Aplicar esto agrega una segunda vía, la nativa, que además cubre los
-- cambios hechos FUERA de la app (por ejemplo, editando la fila a mano en
-- el panel de Supabase): con la publicación activa, ese cambio también
-- refresca las pantallas abiertas.
--
-- Cómo saber si ya está publicada:
--   select schemaname, tablename
--     from pg_publication_tables
--    where pubname = 'supabase_realtime'
--    order by tablename;
--
-- Si `anticipos` NO aparece en esa lista, aplicar:
-- ═══════════════════════════════════════════════════════════════════════

alter publication supabase_realtime add table public.anticipos;

-- Para que los eventos de UPDATE y DELETE lleguen con los datos de la fila
-- anterior (y no solo con la clave primaria):
alter table public.anticipos replica identity full;

-- Comprobación:
--   select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' and tablename = 'anticipos';
--   → debe devolver una fila.
--
-- Nota: publicar una tabla en Realtime NO cambia quién puede leerla. Los
-- permisos siguen dependiendo de RLS, así que esto no abre nada.
