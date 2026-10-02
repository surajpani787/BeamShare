'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Zap, 
  Copy, 
  Check, 
  Users, 
  PlusCircle, 
  ShieldCheck, 
  Share2,
  Lock,
  Radio,
  ExternalLink
} from 'lucide-react';
import { generateRoomId } from '@/lib/slug';

interface HeaderProps {
  roomId?: string;
  peerCount?: number;
  status?: 'connecting' | 'connected' | 'alone' | 'error';
  statusDetails?: string;
}

export const Header: React.FC<HeaderProps> = ({
  roomId,
  peerCount = 0,
  status = 'alone',
  statusDetails
}) => {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNewRoom = () => {
    const newRoom = generateRoomId();
    if (typeof window !== 'undefined') {
      window.location.href = `/${newRoom}`;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-xl px-4 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand & Security */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-violet-600 shadow-[0_0_20px_rgba(6,182,212,0.35)] group-hover:scale-105 transition-all duration-300">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
                BeamShare
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-950/70 text-cyan-300 border border-cyan-800/50">
                P2P • ZERO-DB
              </span>
            </div>
          </Link>

          <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-slate-400 font-mono bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>End-to-End Encrypted</span>
          </div>
        </div>

        {/* Center Room Status Bar (Inside Room) */}
        {mounted && roomId && (
          <div className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-slate-900/90 border border-slate-800 shadow-inner">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="hidden sm:inline text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Room:</span>
              <span className="font-mono font-bold text-xs text-cyan-300 tracking-wide">
                #{roomId}
              </span>
            </div>

            <div className="h-3.5 w-[1px] bg-slate-800"></div>

            {/* Peer Connection Status Indicator */}
            {status === 'connecting' ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                <Radio className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting...</span>
              </div>
            ) : peerCount > 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Users className="w-3.5 h-3.5" />
                <span>{peerCount} {peerCount === 1 ? 'Peer Connected' : 'Peers Connected'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span>Waiting for peer...</span>
              </div>
            )}
          </div>
        )}

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2.5">
          {mounted && roomId && (
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold transition-all duration-200 cursor-pointer shadow-md ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]'
              }`}
              title="Copy room link to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleNewRoom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition-all border border-slate-700/80 hover:border-slate-600 cursor-pointer shadow-sm"
            title="Create a new clean collaboration room"
          >
            <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">New Room</span>
          </button>
        </div>
      </div>
    </header>
  );
};
