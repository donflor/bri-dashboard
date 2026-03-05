import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface InfraMetrics {
  cpu: {
    usagePercent: number;
    loadAvg: [number, number, number];
    cores: number;
  };
  memory: {
    totalMB: number;
    usedMB: number;
    freeMB: number;
    usagePercent: number;
    swapTotalMB: number;
    swapUsedMB: number;
  };
  disk: {
    totalGB: number;
    usedGB: number;
    availGB: number;
    usagePercent: number;
  };
  uptime: number;
  topProcesses: {
    pid: number;
    user: string;
    cpu: number;
    mem: number;
    command: string;
  }[];
  network: {
    rxBytesPerSec: number;
    txBytesPerSec: number;
  };
  docker: {
    name: string;
    image: string;
    status: string;
    cpu: string;
    mem: string;
  }[];
  timestamp: string;
}

async function runCmd(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 5000 });
    return stdout.trim();
  } catch {
    return '';
  }
}

export async function GET() {
  try {
    // Run all commands in parallel
    const [
      loadAvgRaw,
      cpuInfoRaw,
      memRaw,
      diskRaw,
      uptimeRaw,
      topRaw,
      dockerRaw,
      netRxRaw1,
      netTxRaw1,
    ] = await Promise.all([
      runCmd('cat /proc/loadavg'),
      runCmd('nproc'),
      runCmd('free -m'),
      runCmd('df -BG / | tail -1'),
      runCmd('cat /proc/uptime'),
      runCmd('ps aux --sort=-%cpu | head -11 | tail -10'),
      runCmd('docker stats --no-stream --format "{{.Name}}|{{.Image}}|{{.Status}}|{{.CPUPerc}}|{{.MemUsage}}" 2>/dev/null'),
      runCmd('cat /sys/class/net/eth0/statistics/rx_bytes 2>/dev/null'),
      runCmd('cat /sys/class/net/eth0/statistics/tx_bytes 2>/dev/null'),
    ]);

    // Wait 1 second for network rate calculation
    await new Promise(r => setTimeout(r, 1000));
    const [netRxRaw2, netTxRaw2] = await Promise.all([
      runCmd('cat /sys/class/net/eth0/statistics/rx_bytes 2>/dev/null'),
      runCmd('cat /sys/class/net/eth0/statistics/tx_bytes 2>/dev/null'),
    ]);

    // Parse load average
    const loadParts = loadAvgRaw.split(' ');
    const loadAvg: [number, number, number] = [
      parseFloat(loadParts[0]) || 0,
      parseFloat(loadParts[1]) || 0,
      parseFloat(loadParts[2]) || 0,
    ];
    const cores = parseInt(cpuInfoRaw) || 4;
    const cpuUsage = Math.min(100, Math.round((loadAvg[0] / cores) * 100));

    // Parse memory
    const memLines = memRaw.split('\n');
    const memParts = memLines[1]?.split(/\s+/) || [];
    const swapParts = memLines[2]?.split(/\s+/) || [];
    const totalMB = parseInt(memParts[1]) || 0;
    const usedMB = parseInt(memParts[2]) || 0;
    const freeMB = parseInt(memParts[3]) || 0;

    // Parse disk
    const diskParts = diskRaw.split(/\s+/);
    const totalGB = parseInt(diskParts[1]) || 0;
    const usedGB = parseInt(diskParts[2]) || 0;
    const availGB = parseInt(diskParts[3]) || 0;
    const diskPercent = parseInt(diskParts[4]) || 0;

    // Parse uptime
    const uptimeSeconds = Math.floor(parseFloat(uptimeRaw.split(' ')[0]) || 0);

    // Parse top processes
    const topProcesses = topRaw.split('\n').filter(Boolean).map(line => {
      const parts = line.split(/\s+/);
      return {
        pid: parseInt(parts[1]) || 0,
        user: parts[0] || '',
        cpu: parseFloat(parts[2]) || 0,
        mem: parseFloat(parts[3]) || 0,
        command: parts.slice(10).join(' ').slice(0, 80),
      };
    }).slice(0, 8);

    // Parse docker stats
    const docker = dockerRaw.split('\n').filter(Boolean).map(line => {
      const [name, image, status, cpu, mem] = line.split('|');
      return { name: name || '', image: (image || '').split(':')[0], status: status || '', cpu: cpu || '0%', mem: mem || '' };
    });

    // Network rate (bytes per second)
    const rxRate = Math.max(0, (parseInt(netRxRaw2) || 0) - (parseInt(netRxRaw1) || 0));
    const txRate = Math.max(0, (parseInt(netTxRaw2) || 0) - (parseInt(netTxRaw1) || 0));

    const metrics: InfraMetrics = {
      cpu: { usagePercent: cpuUsage, loadAvg, cores },
      memory: {
        totalMB, usedMB, freeMB,
        usagePercent: totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0,
        swapTotalMB: parseInt(swapParts[1]) || 0,
        swapUsedMB: parseInt(swapParts[2]) || 0,
      },
      disk: { totalGB, usedGB, availGB, usagePercent: diskPercent },
      uptime: uptimeSeconds,
      topProcesses,
      network: { rxBytesPerSec: rxRate, txBytesPerSec: txRate },
      docker,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Infra metrics error:', error);
    return NextResponse.json({ error: 'Failed to collect metrics' }, { status: 500 });
  }
}
