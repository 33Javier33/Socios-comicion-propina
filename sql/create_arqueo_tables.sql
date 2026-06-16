-- Tablas para Arqueo de Caja — proyecto teemahksasdougehrcly (SOC)
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS retiros_anticipos (
  firma TEXT PRIMARY KEY,
  nombre TEXT DEFAULT '',
  monto NUMERIC DEFAULT 0,
  billetes JSONB DEFAULT '{}',
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  responsable TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS arqueo_estado (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  conteo_actual JSONB DEFAULT '{}',
  movimiento_display JSONB DEFAULT '{}',
  total_retirado NUMERIC DEFAULT 0,
  total_contado NUMERIC DEFAULT 0,
  total_esperado NUMERIC DEFAULT 0,
  total_anticipos NUMERIC DEFAULT 0,
  diferencia NUMERIC DEFAULT 0,
  divisor_planta NUMERIC DEFAULT 1,
  divisor_pt NUMERIC DEFAULT 1
);

CREATE TABLE IF NOT EXISTS arqueo_cierres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  total_contado NUMERIC DEFAULT 0,
  diferencia NUMERIC DEFAULT 0,
  total_retirado NUMERIC DEFAULT 0,
  conteo_actual JSONB DEFAULT '{}',
  movimiento_display JSONB DEFAULT '{}',
  divisor_planta NUMERIC DEFAULT 1,
  divisor_pt NUMERIC DEFAULT 1
);

ALTER TABLE retiros_anticipos DISABLE ROW LEVEL SECURITY;
ALTER TABLE arqueo_estado DISABLE ROW LEVEL SECURITY;
ALTER TABLE arqueo_cierres DISABLE ROW LEVEL SECURITY;
