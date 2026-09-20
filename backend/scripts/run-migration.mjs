import { supabase } from '../src/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  console.log('Running Migration 02...');
  const sql = fs.readFileSync(path.join(__dirname, '../sql/02_phase2_migration.sql'), 'utf8');

  // Attempt RPC exec_sql or direct postgres RPC
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.log('exec_sql RPC not available or failed:', error.message);
    console.log('Will ensure backend handles missing columns dynamically gracefully or via rest fallback.');
  } else {
    console.log('Migration executed successfully:', data);
  }
}

runMigration().catch(console.error);
