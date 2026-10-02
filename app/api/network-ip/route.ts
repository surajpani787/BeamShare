import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  const interfaces = os.networkInterfaces();
  let localIp = '';

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Find IPv4 non-internal address (e.g. 192.168.x.x, 10.x.x.x)
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
        break;
      }
    }
    if (localIp) break;
  }

  return NextResponse.json({
    ip: localIp || 'localhost',
    port: process.env.PORT || '3000'
  });
}
