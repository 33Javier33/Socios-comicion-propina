-- =============================================================================
-- SCHEMA: socios-comicion-propina → Supabase
-- Proyecto: teemahksasdougehrcly
-- Ejecutar UNA SOLA VEZ en:
-- https://supabase.com/dashboard/project/teemahksasdougehrcly/sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS socios (
    id                  TEXT PRIMARY KEY,
    nombre              TEXT,
    apellido            TEXT,
    area                TEXT,
    contrato            TEXT,
    fecha_ingreso       DATE,
    fecha_inicio_puntos DATE,
    puntos              INT DEFAULT 0,
    puntos_activos      BOOLEAN DEFAULT TRUE,
    activo              BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS anticipos (
    id       TEXT PRIMARY KEY,
    socio_id TEXT NOT NULL,
    fecha    DATE,
    monto    NUMERIC(12,2) DEFAULT 0,
    autor    TEXT,
    periodo  TEXT
);

CREATE TABLE IF NOT EXISTS anticipos_historial (
    id            TEXT PRIMARY KEY,
    socio_id      TEXT NOT NULL,
    monto         NUMERIC(12,2) DEFAULT 0,
    fecha         DATE,
    estado        TEXT,
    uuid_ref      TEXT,
    responsable   TEXT,
    periodo       TEXT,
    fecha_archivo TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS extras (
    id       TEXT PRIMARY KEY,
    socio_id TEXT NOT NULL,
    fecha    DATE,
    tipo     TEXT,
    monto    NUMERIC(12,2) DEFAULT 0,
    periodo  TEXT
);

CREATE TABLE IF NOT EXISTS saldos_socio (
    id         TEXT PRIMARY KEY,
    nombre     TEXT,
    monto      NUMERIC(12,2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dias_pt (
    id       TEXT PRIMARY KEY,
    socio_id TEXT NOT NULL,
    periodo  TEXT NOT NULL,
    dias     JSONB,
    UNIQUE(socio_id, periodo)
);

CREATE TABLE IF NOT EXISTS chat_mensajes (
    id           TEXT PRIMARY KEY,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    autor        TEXT,
    socio_id     TEXT,
    mensaje      TEXT,
    destinatario TEXT,
    estado       TEXT DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS historial_conexiones (
    id         TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    usuario    TEXT,
    area       TEXT,
    ip         TEXT,
    device_id  TEXT,
    lat        TEXT,
    lng        TEXT
);

CREATE TABLE IF NOT EXISTS auditoria (
    id         TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    usuario    TEXT,
    area       TEXT,
    accion     TEXT,
    detalle    TEXT
);

CREATE TABLE IF NOT EXISTS credenciales (
    id        TEXT PRIMARY KEY,
    socio_id  TEXT UNIQUE NOT NULL,
    pin       TEXT,
    device_id TEXT,
    rut       TEXT
);

CREATE TABLE IF NOT EXISTS retiros_anticipos (
    id         TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    socio_id   TEXT,
    monto      NUMERIC(12,2),
    autor      TEXT,
    periodo    TEXT
);

CREATE TABLE IF NOT EXISTS materiales (
    id         TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    nombre     TEXT,
    cantidad   TEXT,
    autor      TEXT
);

CREATE TABLE IF NOT EXISTS canjes (
    id          TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    socio_id    TEXT,
    puntos      INT,
    descripcion TEXT
);

-- Habilitar Row Level Security
ALTER TABLE socios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE anticipos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE anticipos_historial  ENABLE ROW LEVEL SECURITY;
ALTER TABLE extras               ENABLE ROW LEVEL SECURITY;
ALTER TABLE saldos_socio         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dias_pt              ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_mensajes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_conexiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria            ENABLE ROW LEVEL SECURITY;
ALTER TABLE credenciales         ENABLE ROW LEVEL SECURITY;
ALTER TABLE retiros_anticipos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE canjes               ENABLE ROW LEVEL SECURITY;

-- Políticas: acceso completo para anon
CREATE POLICY "anon_all_socios"               ON socios               FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_anticipos"            ON anticipos            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_anticipos_historial"  ON anticipos_historial  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_extras"               ON extras               FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_saldos_socio"         ON saldos_socio         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_dias_pt"              ON dias_pt              FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_chat_mensajes"        ON chat_mensajes        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_historial_conexiones" ON historial_conexiones FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_auditoria"            ON auditoria            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_credenciales"         ON credenciales         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_retiros_anticipos"    ON retiros_anticipos    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_materiales"           ON materiales           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_canjes"               ON canjes               FOR ALL TO anon USING (true) WITH CHECK (true);
