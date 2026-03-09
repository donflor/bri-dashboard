import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const reportPath = join('/root/.openclaw/workspace/data', 'lgm-report.json');
    const raw = await readFile(reportPath, 'utf-8');
    const report = JSON.parse(raw);
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({
      timestamp: null,
      stats: { found: 0, scraped: 0, crm: 0, instantly: 0, dupes: 0, errors: 0, byCategory: {}, byScore: {}, byMetro: {} },
      target: 2200,
      elapsed: 0,
      mode: 'unknown',
    });
  }
}
