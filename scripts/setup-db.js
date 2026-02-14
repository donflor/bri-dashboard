#!/usr/bin/env node
/**
 * Setup database tables for Bri Dashboard
 * Run: node scripts/setup-db.js
 */

const SUPABASE_URL = 'https://ewsahqwtupghisvbekvf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3c2FocXd0dXBnaGlzdmJla3ZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEzMjE3MSwiZXhwIjoyMDc4NzA4MTcxfQ.RCxzAy-9NVJZIgDvEC3CZzodQrF-yFzA5qSv2BomWtc';

async function setupDatabase() {
  console.log('Setting up Bri Dashboard database...');
  
  // Check if table exists by trying to query it
  const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_users?select=id&limit=1`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  
  if (checkResponse.ok) {
    console.log('✓ dashboard_users table already exists');
    
    // Check for admin users
    const usersResponse = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_users?select=email,role`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    
    const users = await usersResponse.json();
    console.log(`  Found ${users.length} users:`, users.map(u => `${u.email} (${u.role})`).join(', ') || 'none');
    return true;
  }
  
  console.log('Table does not exist. Please create it via Supabase dashboard:');
  console.log(`
-- Run this SQL in Supabase SQL Editor:
CREATE TABLE dashboard_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE dashboard_users ENABLE ROW LEVEL SECURITY;

-- Policy for service role only
CREATE POLICY "Service role full access" ON dashboard_users
  FOR ALL USING (true) WITH CHECK (true);
`);
  
  return false;
}

setupDatabase().catch(console.error);
