'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Zap, 
  ShieldCheck, 
  HardDrive, 
  Code2, 
  ArrowRight, 
  Lock, 
  Globe, 
  Cpu, 
  Terminal, 
  Sparkles,
  FileCheck,
  CheckCircle2,
  Share2
} from 'lucide-react';
import { Header } from '@/components/Header';
import { AdBanner } from '@/components/AdBanner';
import { generateRoomId, isValidRoomId } from '@/lib/slug';

export default function LandingPage() {
  const router = useRouter();
  const [inputRoomId, setInputRoomId] = useState('');
  const [error, setError] = useState('');

  const handleCreateRoom = () => {
    const newRoom = generateRoomId();
    router.push(`/${newRoom}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = inputRoomId.trim().replace(/^https?:\/\/[^\/]+\//, '');
    if (!cleanId) {
      setError('Please enter a valid Room ID or link');
      return;
    }
    if (!isValidRoomId(cleanId)) {
      setError('Room ID contains invalid characters');
      return;
    }
    router.push(`/${cleanId}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
      <Header />

      {/* Persistent AdSense Top Banner */}
      <div className="max-w-7xl mx-auto px-4 w-full mt-2">
        <AdBanner type="header-banner" />
      </div>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-12 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Glowing Background Radial Blobs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-500/15 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse-slow"></div>

        <div className="text-center max-w-3xl flex flex-col items-center gap-6 relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 text-xs font-mono tracking-wide shadow-lg">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>100% Peer-to-Peer • Zero Server Logs • Free Forever</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.15]">
            Instant Code & File Sharing.{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              Zero Database Required.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
            Collaborate on code in real-time and transfer high-res images, documents, and archives directly browser-to-browser via encrypted WebRTC DataChannels.
          </p>

          {/* CTA Buttons & Join Room Card */}
          <div className="w-full max-w-md mt-4 flex flex-col gap-4">
            <button
              onClick={handleCreateRoom}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-indigo-700 hover:from-cyan-400 hover:to-indigo-600 text-white font-semibold text-base shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] transition-all duration-200 flex items-center justify-center gap-3 group cursor-pointer"
            >
              <Zap className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" />
              <span>Create New Shared Room</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="relative flex items-center justify-center my-1">
              <div className="border-t border-slate-800 w-full"></div>
              <span className="bg-[#090d16] px-3 text-xs font-mono text-slate-500 uppercase tracking-widest absolute">
                or join existing
              </span>
            </div>

            <form onSubmit={handleJoinRoom} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Enter Room ID or Share Link..."
                value={inputRoomId}
                onChange={(e) => {
                  setInputRoomId(e.target.value);
                  setError('');
                }}
                className="flex-1 bg-slate-900/90 border border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors font-mono"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Join</span>
              </button>
            </form>
            {error && <p className="text-xs text-rose-400 text-left font-mono">{error}</p>}
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full mt-20 relative z-10">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-cyan-500/40 transition-all duration-300 group">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 w-fit mb-4 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6 stroke-[1.75]" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Zero Database & Zero Storage</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              No databases, cloud buckets, or servers retain your code or files. Data exists only in active browser memory and vanishes when tabs close.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/40 transition-all duration-300 group">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit mb-4 group-hover:scale-110 transition-transform">
              <HardDrive className="w-6 h-6 stroke-[1.75]" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">P2P File & Image Stream</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Send images, documents, PDFs, and archives of any size directly between peers with live progress tracking and zero server bottleneck.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-emerald-500/40 transition-all duration-300 group">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit mb-4 group-hover:scale-110 transition-transform">
              <Code2 className="w-6 h-6 stroke-[1.75]" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Live Code Editor</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              CodeMirror-powered syntax highlighting for JS, TS, Python, HTML, CSS, JSON & Markdown with instant bi-directional typing sync.
            </p>
          </div>
        </div>

        {/* Sidebar Ad Placeholder for layout completeness */}
        <div className="w-full max-w-4xl mt-12">
          <AdBanner type="sidebar" />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 px-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400" />
            <span className="font-bold text-slate-300">BeamShare</span>
            <span>•</span>
            <span>Powered by WebRTC & Socket.io</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">Hostinger & VPS Ready</span>
            <span>•</span>
            <span>100% Free & Open Architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
