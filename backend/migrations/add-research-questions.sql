-- Migration to add research_questions to protocols table
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS research_questions JSONB DEFAULT '[]'::jsonb;
