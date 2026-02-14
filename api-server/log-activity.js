#!/usr/bin/env node
/**
 * Log activity to the Bri Dashboard API
 * Usage: node log-activity.js <type> <description> [status] [duration_ms]
 * 
 * Types: task, message, subagent, system
 * Status: success, error, pending, info
 */

const API_URL = process.env.DASHBOARD_API_URL || 'http://localhost:3034';
const API_TOKEN = process.env.DASHBOARD_API_TOKEN || 'bri-dashboard-token-2026';

async function logActivity(type, description, status = 'success', duration = null) {
  try {
    const response = await fetch(`${API_URL}/api/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ type, description, status, duration }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✓ Activity logged:', data.item.id);
    } else {
      console.error('✗ Failed to log activity:', response.status);
    }
  } catch (error) {
    console.error('✗ Error logging activity:', error.message);
  }
}

// CLI usage
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node log-activity.js <type> <description> [status] [duration_ms]');
  console.log('Types: task, message, subagent, system');
  console.log('Status: success, error, pending, info');
  process.exit(1);
}

logActivity(args[0], args[1], args[2] || 'success', args[3] ? parseInt(args[3]) : null);
