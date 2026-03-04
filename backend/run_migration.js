require('dotenv').config({ path: '/Users/mac/Proyectos/Tesis_RSL/backend/.env' });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  try {
    const sql = fs.readFileSync('/Users/mac/Proyectos/Tesis_RSL/backend/migrations/add-research-questions.sql', 'utf8');
    await pool.query(sql);
    console.log("Migration executed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pool.end();
  }
}

runMigration();
