-- =====================================================
-- INICIALIZACIÓN COMPLETA BASE DE DATOS RSL SYSTEM
-- PARA PRODUCCIÓN EN RENDER
-- =====================================================
-- INSTRUCCIONES:
-- 1. Conectarse a la BD de Render:
--    psql "postgresql://USER:PASSWORD@HOST/DATABASE"
-- 2. Copiar y pegar TODO este script
-- 3. Verificar que se crearon las tablas: \dt
-- =====================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. TABLA USERS
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  google_id VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- =====================================================
-- 2. TABLA PROJECTS
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- =====================================================
-- 3. TABLA PROJECT_MEMBERS
-- =====================================================
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'viewer',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- =====================================================
-- 4. TABLA PROTOCOLS
-- =====================================================
CREATE TABLE IF NOT EXISTS protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  
  is_matrix JSONB DEFAULT '[]'::jsonb,
  is_not_matrix JSONB DEFAULT '[]'::jsonb,
  
  population TEXT,
  intervention TEXT,
  comparison TEXT,
  outcomes TEXT,
  
  inclusion_criteria JSONB DEFAULT '[]'::jsonb,
  exclusion_criteria JSONB DEFAULT '[]'::jsonb,
  
  databases JSONB DEFAULT '[]'::jsonb,
  search_string TEXT,
  search_queries JSONB DEFAULT '[]'::jsonb,
  
  proposed_title TEXT,
  selected_title TEXT,
  refined_question TEXT,
  key_terms JSONB DEFAULT '{}'::jsonb,
  temporal_range JSONB DEFAULT '{}'::jsonb,
  -- prisma_compliance REMOVED (now in prisma_items table)
  area VARCHAR(200),
  
  search_plan JSONB DEFAULT '{}'::jsonb,
  screening_results JSONB DEFAULT '{}'::jsonb,
  
  fase2_unlocked BOOLEAN DEFAULT FALSE,
  selected_for_full_text JSONB DEFAULT '[]'::jsonb,
  screening_finalized BOOLEAN DEFAULT FALSE,
  prisma_unlocked BOOLEAN DEFAULT FALSE,
  
  prisma_locked BOOLEAN DEFAULT FALSE,
  prisma_completed_at TIMESTAMP WITH TIME ZONE,
  
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_protocols_project ON protocols(project_id);

-- =====================================================
-- 5. TABLA REFERENCES
-- =====================================================
CREATE TABLE IF NOT EXISTS "references" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  authors TEXT,
  year INTEGER,
  journal VARCHAR(500),
  source VARCHAR(255),
  doi VARCHAR(255),
  abstract TEXT,
  keywords TEXT,
  url TEXT,
  
  status VARCHAR(50) DEFAULT 'pending',
  screening_status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  classification_method VARCHAR(50),
  ai_reasoning TEXT,
  exclusion_reason TEXT,
  matched_criteria JSONB DEFAULT '[]'::jsonb,
  
  priority_score DECIMAL(5,4),
  similarity_score DECIMAL(5,4),
  priority_level VARCHAR(20),
  phase VARCHAR(20),
  
  full_text_path TEXT,
  full_text_status VARCHAR(50) DEFAULT 'not_uploaded',
  full_text_evaluation JSONB DEFAULT '{}'::jsonb,
  full_text_extracted BOOLEAN DEFAULT FALSE,
  full_text_data JSONB,
  
  is_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_of UUID REFERENCES "references"(id) ON DELETE SET NULL,
  
  manual_review_status VARCHAR(50),
  manual_review_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_references_project ON "references"(project_id);
CREATE INDEX IF NOT EXISTS idx_references_status ON "references"(status);
CREATE INDEX IF NOT EXISTS idx_references_screening_status ON "references"(screening_status);
CREATE INDEX IF NOT EXISTS idx_references_year ON "references"(year);
CREATE INDEX IF NOT EXISTS idx_references_doi ON "references"(doi);
CREATE INDEX IF NOT EXISTS idx_references_priority ON "references"(priority_level);
CREATE INDEX IF NOT EXISTS idx_references_phase ON "references"(phase);
CREATE INDEX IF NOT EXISTS idx_references_duplicate ON "references"(is_duplicate);

-- =====================================================
-- 6. TABLA PRISMA_ITEMS
-- =====================================================
CREATE TABLE IF NOT EXISTS prisma_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  section VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50) DEFAULT 'manual',
  data_source TEXT,
  automated_content TEXT,
  last_human_edit TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT FALSE,
  ai_validated BOOLEAN DEFAULT FALSE,
  validation_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, item_number)
);

CREATE INDEX IF NOT EXISTS idx_prisma_items_project ON prisma_items(project_id);
CREATE INDEX IF NOT EXISTS idx_prisma_items_section ON prisma_items(section);
CREATE INDEX IF NOT EXISTS idx_prisma_items_completed ON prisma_items(completed);

-- =====================================================
-- 7. TABLA RQS_ENTRIES (Research Question Schema)
-- =====================================================
CREATE TABLE IF NOT EXISTS rqs_entries (
  id SERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reference_id UUID NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  
  author VARCHAR(500) NOT NULL,
  year INTEGER NOT NULL,
  title TEXT,
  source VARCHAR(300),
  
  study_type VARCHAR(50),
  technology VARCHAR(200),
  context VARCHAR(100),
  
  key_evidence TEXT,
  metrics JSONB DEFAULT '{}',
  
  rq1_relation VARCHAR(20),
  rq2_relation VARCHAR(20),
  rq3_relation VARCHAR(20),
  rq_notes TEXT,
  
  limitations TEXT,
  quality_score VARCHAR(20),
  
  extraction_method VARCHAR(50) DEFAULT 'ai_assisted',
  extracted_by UUID REFERENCES users(id),
  extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  validated BOOLEAN DEFAULT FALSE,
  validated_by UUID REFERENCES users(id),
  validated_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(reference_id),
  CHECK (year > 1900 AND year <= 2100),
  CHECK (study_type IN ('empirical', 'case_study', 'experiment', 'simulation', 'review', 'other')),
  CHECK (context IN ('industrial', 'enterprise', 'academic', 'experimental', 'mixed', 'other')),
  CHECK (rq1_relation IN ('yes', 'no', 'partial', NULL)),
  CHECK (rq2_relation IN ('yes', 'no', 'partial', NULL)),
  CHECK (rq3_relation IN ('yes', 'no', 'partial', NULL)),
  CHECK (quality_score IN ('high', 'medium', 'low', NULL)),
  CHECK (extraction_method IN ('ai_assisted', 'manual', 'hybrid'))
);

CREATE INDEX IF NOT EXISTS idx_rqs_project ON rqs_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_rqs_reference ON rqs_entries(reference_id);
CREATE INDEX IF NOT EXISTS idx_rqs_year ON rqs_entries(year);
CREATE INDEX IF NOT EXISTS idx_rqs_study_type ON rqs_entries(study_type);
CREATE INDEX IF NOT EXISTS idx_rqs_validated ON rqs_entries(validated);

-- =====================================================
-- 8. TABLA ARTICLE_VERSIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS article_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT,
  abstract TEXT,
  introduction TEXT,
  methods TEXT,
  results TEXT,
  discussion TEXT,
  conclusions TEXT,
  references_section TEXT,
  word_count INTEGER DEFAULT 0,
  change_description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_article_versions_project ON article_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_article_versions_number ON article_versions(version_number DESC);

-- =====================================================
-- 9. TABLA ACTIVITY_LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

-- =====================================================
-- 10. TABLA API_USAGE
-- =====================================================
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100),
  endpoint VARCHAR(255),
  tokens_prompt INTEGER DEFAULT 0,
  tokens_completion INTEGER DEFAULT 0,
  tokens_total INTEGER DEFAULT 0,
  request_count INTEGER DEFAULT 1,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_project ON api_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON api_usage(provider);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at DESC);

-- =====================================================
-- 11. TABLA SCREENING_RECORDS
-- =====================================================
CREATE TABLE IF NOT EXISTS screening_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reference_id UUID NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  decision VARCHAR(50) NOT NULL,
  confidence_score DECIMAL(5,4),
  reasoning TEXT,
  
  screening_method VARCHAR(50),
  phase VARCHAR(20),
  
  -- Campos agregados por migración de scoring avanzado
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  stage VARCHAR(50),
  scores JSONB DEFAULT '{}'::jsonb,
  total_score DECIMAL(5,2),
  threshold DECIMAL(5,2),
  exclusion_reasons JSONB DEFAULT '[]'::jsonb,
  comment TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screening_records_project ON screening_records(project_id);
CREATE INDEX IF NOT EXISTS idx_screening_records_reference ON screening_records(reference_id);
CREATE INDEX IF NOT EXISTS idx_screening_records_decision ON screening_records(decision);
CREATE INDEX IF NOT EXISTS idx_screening_records_stage ON screening_records(stage);
CREATE INDEX IF NOT EXISTS idx_screening_records_total_score ON screening_records(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_screening_records_user ON screening_records(user_id);

-- =====================================================
-- TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at 
  BEFORE UPDATE ON projects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_protocols_updated_at ON protocols;
CREATE TRIGGER update_protocols_updated_at 
  BEFORE UPDATE ON protocols 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_references_updated_at ON "references";
CREATE TRIGGER update_references_updated_at 
  BEFORE UPDATE ON "references" 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prisma_items_updated_at ON prisma_items;
CREATE TRIGGER update_prisma_items_updated_at 
  BEFORE UPDATE ON prisma_items 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_screening_records_updated_at ON screening_records;
CREATE TRIGGER update_screening_records_updated_at 
  BEFORE UPDATE ON screening_records 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger específico para RQS
CREATE OR REPLACE FUNCTION update_rqs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rqs_updated_at_trigger ON rqs_entries;
CREATE TRIGGER rqs_updated_at_trigger
  BEFORE UPDATE ON rqs_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_rqs_updated_at();

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Listar todas las tablas creadas
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =====================================================
-- MENSAJE FINAL
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Base de datos inicializada correctamente';
  RAISE NOTICE '📊 Tablas creadas: 11';
  RAISE NOTICE '🔑 Índices y triggers configurados';
  RAISE NOTICE '🚀 Sistema RSL listo para producción';
END $$;
