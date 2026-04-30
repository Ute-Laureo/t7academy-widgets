// T7 Academy — Bettermode Members → Supabase Sync
// Runs via GitHub Actions every night

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// STEP 1: Read members.csv from repo root
let raw;
try {
  raw = readFileSync('members.csv', 'utf8');
} catch (e) {
  console.error('❌ Could not read members.csv — make sure it exists in the repo root');
  process.exit(1);
}

// STEP 2: Parse CSV
const records = parse(raw, {
  columns: true,
  skip_empty_lines: true,
});

console.log(`📋 Found ${records.length} members in CSV`);

// STEP 3: Map CSV columns to Supabase table columns
const members = records.map(r => ({
  bm_id:       r.id,
  name:        r.name,
  bm_username: r.username,
  email:       r.email,
  role:        r.role,
  bm_joined_at: r.createdAt || null,
}));

// STEP 4: Upsert into Supabase
const { error } = await supabase
  .from('members')
  .upsert(members, { onConflict: 'bm_id' });

if (error) {
  console.error('❌ Supabase error:', error.message);
  process.exit(1);
} else {
  console.log(`✅ Successfully synced ${members.length} members to Supabase`);
}
