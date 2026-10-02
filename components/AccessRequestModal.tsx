'use client';

import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, User, Check, X, Loader2, ArrowLeft, Radio, Lock } from 'lucide-react';
import Link from 'next/link';

export interface IncomingRequest {
  requesterSocketId: string;
  peerId: string;
  displayName: string;
}

interface IncomingRequestToastProps {
  request: IncomingRequest;
  onAccept: (request: IncomingRequest) => void;
  onReject: (request: IncomingRequest) => void;
}

/**
 * Floating prompt displayed on the Room Host's screen when another device knocks to join.
 */
export function IncomingRequestToast({ request, onAccept, onReject }: IncomingRequestToastProps) {
  return (
    <div className="fixed top-20 right-4 sm:right-8 z-50 max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-slate-900/95 border-2 border-cyan-500/50 backdrop-blur-xl rounded-2xl p-4 shadow-2xl shadow-cyan-500/20 text-slate-100 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0 text-cyan-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 uppercase tracking-wider">
              <span>Connection Request</span>
            </div>
            <p className="text-sm font-semibold text-white truncate mt-0.5">
              {request.displayName}
            </p>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              ID: {request.peerId}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300">
          This device wants to join your room for live code & file sharing.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onReject(request)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Decline</span>
          </button>
          <button
            onClick={() => onAccept(request)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Accept & Connect</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface JoinRequestGateProps {
  roomId: string;
  defaultName: string;
  requestState: 'idle' | 'pending' | 'rejected';
  rejectionReason?: string;
  onRequestAccess: (displayName: string) => void;
  onCancelRequest: () => void;
}

/**
 * Gate screen shown to a guest on another device before they are accepted into an active room.
 */
export function JoinRequestGate({
  roomId,
  defaultName,
  requestState,
  rejectionReason,
  onRequestAccess,
  onCancelRequest
}: JoinRequestGateProps) {
  const [displayName, setDisplayName] = useState(defaultName);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] text-slate-100 p-4">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header Badge */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-mono">
            <Lock className="w-3 h-3" />
            <span>Room: {roomId}</span>
          </div>
        </div>

        {requestState === 'idle' && (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-500/10">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-white mb-1">
              Request to Connect
            </h2>
            <p className="text-xs text-slate-400 mb-6 max-w-xs">
              This session is currently active with a host. Send a connection request to join with the same Room ID.
            </p>

            <div className="w-full text-left mb-5">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Your Device / Nickname
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={30}
                  placeholder="e.g. Suraj's Phone"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-cyan-400 focus:outline-none text-sm text-white placeholder-slate-500"
                />
                <User className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <button
              onClick={() => onRequestAccess(displayName || defaultName)}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-cyan-500 via-indigo-500 to-indigo-600 hover:opacity-95 shadow-xl shadow-cyan-500/25 transition-all cursor-pointer"
            >
              Ask to Join Room
            </button>
            <p className="text-[11px] text-slate-500 mt-3">
              100% Zero-Storage • Peer-to-Peer Handshake
            </p>
          </div>
        )}

        {requestState === 'pending' && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="relative w-20 h-20 mb-5 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-ping" />
              <div className="w-16 h-16 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            </div>

            <h2 className="text-lg font-bold text-white mb-1">
              Waiting for Host Approval
            </h2>
            <p className="text-xs text-slate-400 mb-6 max-w-xs">
              We notified the host device on room <span className="text-cyan-300 font-mono">{roomId}</span>. Once approved, you will automatically join.
            </p>

            <button
              onClick={onCancelRequest}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
            >
              Cancel Request
            </button>
          </div>
        )}

        {requestState === 'rejected' && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-500/10">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-bold text-white mb-1">
              Connection Request Declined
            </h2>
            <p className="text-xs text-slate-400 mb-6 max-w-xs">
              {rejectionReason || 'The host declined your request to join this session.'}
            </p>

            <div className="flex items-center gap-3 w-full">
              <Link
                href="/"
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-center text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
              >
                Go Back Home
              </Link>
              <button
                onClick={() => onRequestAccess(displayName || defaultName)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:opacity-95 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
