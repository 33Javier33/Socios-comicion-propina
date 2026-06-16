-- Agregar columnas de datos de socios a la tabla socios — proyecto teemahksasdougehrcly (SOC)
-- Ejecutar en Supabase SQL Editor: https://supabase.com/dashboard/project/teemahksasdougehrcly/sql/new

ALTER TABLE socios
  ADD COLUMN IF NOT EXISTS nombre TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS apellido TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS area TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS contrato TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS fecha_ingreso TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fecha_inicio_puntos TEXT DEFAULT NULL;
