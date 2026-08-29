-- ═══════════════════════════════════════════════════════════════════════
-- Bucket 'documentos' — permitir cualquier tipo de archivo
-- Proyecto SOC (teemahksasdougehrcly)
--
-- La sección Documentación ahora acepta Word, Excel (también con macros),
-- PowerPoint, PDF, imágenes, comprimidos, etc. Si el bucket se creó con
-- `allowed_mime_types` limitado a PDF e imágenes, Supabase Storage rechaza
-- los demás archivos aunque la app los deje seleccionar: la subida falla con
-- un error de "mime type not allowed".
--
-- Cómo saber si hace falta correr esto: al subir un .xlsx la app muestra
--   "El almacenamiento no acepta este tipo de archivo…"
--
-- Primero, revisar cómo está el bucket:
--   select id, public, file_size_limit, allowed_mime_types
--     from storage.buckets where id = 'documentos';
--
-- Si `allowed_mime_types` NO es null, aplicar:
-- ═══════════════════════════════════════════════════════════════════════

update storage.buckets
   set allowed_mime_types = null,          -- null = se acepta cualquier tipo
       file_size_limit    = 20971520       -- 20 MB, igual que el límite de la app
 where id = 'documentos';

-- Comprobación:
--   select id, file_size_limit, allowed_mime_types
--     from storage.buckets where id = 'documentos';
--   → allowed_mime_types debe quedar en null.
--
-- Nota: el bucket sigue siendo PRIVADO. Los archivos se abren con URL firmada
-- (createSignedUrl, 1 hora), así que quitar el filtro de tipos no lo expone.
