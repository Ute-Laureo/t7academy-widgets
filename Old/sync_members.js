// T7 Academy — Bettermode Members → Supabase Sync
// Runs via GitHub Actions every night

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const raw = readFileSync('members.csv', 'utf8');
const lines = raw.trim().split('\n');
const headers = lines[0].split(',');
const records = [];

for (let i = 1; i < lines.length; i++) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  let bracketDepth = 0;
  for (const ch of lines[i]) {
    if (ch === '"' && bracketDepth === 0) { inQuotes = !inQuotes; }
    else if (ch === '[') { bracketDepth++; current += ch; }
    else if (ch === ']') { bracketDepth--; current += ch; }
    else if (ch === ',' && !inQuotes && bracketDepth === 0) { fields.push(current.replace(/^"|"$/g, '')); current = ''; }
    else { current += ch; }
  }
  fields.push(current.replace(/^"|"$/g, ''));
  const obj = {};
  headers.forEach((h, idx) => { obj[h.trim()] = fields[idx] ?? null; });
  records.push(obj);
}

console.log(`Found ${records.length} members in CSV`);

// STEP 1: Upsert into members table
const members = records.map(r => ({
  bm_id:        r.id,
  name:         r.name,
  bm_username:  r.username,
  email:        r.email,
  role:         r.role,
  bm_joined_at: r.createdAt ? new Date(r.createdAt).getTime() : null,
}));

const { error: membersError } = await supabase
  .from('members')
  .upsert(members, { onConflict: 'bm_id' });

if (membersError) {
  console.error('❌ Members sync error:', membersError.message);
  process.exit(1);
}
console.log(`✅ Synced ${members.length} members`);

// STEP 2: Update player_name in players table when name changes
const emailToName = {};
records.forEach(r => { if (r.email && r.name) emailToName[r.email] = r.name; });

let playersUpdated = 0;
for (const [email, name] of Object.entries(emailToName)) {
  const { error } = await supabase
    .from('players')
    .update({ player_name: name })
    .eq('player_email', email);
  if (!error) playersUpdated++;
}
console.log(`✅ Updated player names for ${playersUpdated} players`);
