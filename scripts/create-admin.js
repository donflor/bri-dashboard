#!/usr/bin/env node
/**
 * Create admin users for Bri Dashboard
 * Usage: node scripts/create-admin.js <email> <password> <name>
 */

const bcrypt = require('bcryptjs');

const SUPABASE_URL = 'https://ewsahqwtupghisvbekvf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3c2FocXd0dXBnaGlzdmJla3ZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEzMjE3MSwiZXhwIjoyMDc4NzA4MTcxfQ.RCxzAy-9NVJZIgDvEC3CZzodQrF-yFzA5qSv2BomWtc';

async function createAdmin(email, password, name) {
  console.log(`Creating admin user: ${email}`);
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);
  
  // Create user via Supabase REST API
  const response = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_users`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name: name,
      role: 'admin',
    }),
  });
  
  if (response.ok) {
    const data = await response.json();
    console.log('✓ Admin user created:', data[0]?.email);
    return true;
  } else {
    const error = await response.text();
    console.error('✗ Failed to create user:', error);
    return false;
  }
}

// Main
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node scripts/create-admin.js <email> <password> <name>');
  process.exit(1);
}

createAdmin(args[0], args[1], args[2]);
