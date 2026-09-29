'use client';

import React from 'react';
import { Users, Shield, Cpu } from 'lucide-react';

interface PeerListProps {
  myPeerId: string;
  peers: string[];
}

export const PeerList: React.FC<PeerListProps> = ({ myPeerId, peers }) => {
  // Format clean human-readable peer identifier (e.g., Peer #2 or Peer 411)
  const formatPeerLabel = (fullId: string, index: number) => {
    const parts = fullId.split('-');
    const suffix = parts[parts.length - 1];
    return `Peer #${index + 1} (${suffix})`;
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1 px-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono pl-0.5">
        <Users className="w-3.5 h-3.5 text-cyan-400" />
        <span>Mesh:</span>
      </div>

      {/* Current User Badge */}
      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 text-[11px] font-mono whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
        <span>You (Host)</span>
      </div>

      {/* Connected Peers */}
      {peers.map((peerId, idx) => (
        <div
          key={peerId}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[11px] font-mono whitespace-nowrap animate-fade-in"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>{formatPeerLabel(peerId, idx)}</span>
        </div>
      ))}

      {peers.length === 0 && (
        <span className="text-[11px] text-slate-500 font-mono italic pr-1">
          (Waiting for peer to join...)
        </span>
      )}
    </div>
  );
};
