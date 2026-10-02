'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, X, Smartphone, Wifi, ShieldCheck, ExternalLink } from 'lucide-react';

interface ConnectPhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export const ConnectPhoneModal: React.FC<ConnectPhoneModalProps> = ({
  isOpen,
  onClose,
  roomId
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [mobileUrl, setMobileUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isLocalNetwork, setIsLocalNetwork] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function buildUrl() {
      if (typeof window === 'undefined') return;

      const isLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      let targetOrigin = window.location.origin;

      if (isLocalhost) {
        try {
          const res = await fetch('/api/network-ip');
          const data = await res.json();
          if (data?.ip && data.ip !== 'localhost') {
            const port = window.location.port ? `:${window.location.port}` : '';
            targetOrigin = `${window.location.protocol}//${data.ip}${port}`;
            if (isMounted) setIsLocalNetwork(true);
          }
        } catch (e) {
          console.warn('Could not determine LAN IP:', e);
        }
      }

      // Ensure room URL is clean without ?host=1 or ?create=1
      const finalUrl = `${targetOrigin}/${roomId}`;
      if (isMounted) {
        setMobileUrl(finalUrl);
        try {
          const qrCodeUrl = await QRCode.toDataURL(finalUrl, {
            width: 320,
            margin: 2,
            color: {
              dark: '#030712',
              light: '#ffffff'
            },
            errorCorrectionLevel: 'M'
          });
          setQrDataUrl(qrCodeUrl);
        } catch (err) {
          console.error('QR code generation error:', err);
        }
      }
    }

    buildUrl();

    return () => {
      isMounted = false;
    };
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!mobileUrl) return;
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col items-center animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 text-center mb-1">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Smartphone className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Connect Phone / Mobile</h2>
        </div>
        <p className="text-xs text-slate-400 text-center mb-5">
          Scan the QR code with your phone camera to instantly join this room.
        </p>

        {/* QR Code Card */}
        <div className="relative p-3 bg-white rounded-2xl shadow-lg border border-slate-700/50 mb-4 flex items-center justify-center min-h-[220px] min-w-[220px]">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan QR Code to join room"
              className="w-52 h-52 object-contain rounded-lg"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
              <QrCode className="w-8 h-8 animate-spin text-cyan-500" />
              <span>Generating QR code...</span>
            </div>
          )}
        </div>

        {/* Mobile URL & Copy Bar */}
        <div className="w-full mb-4">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2 pl-3">
            <span className="font-mono text-xs text-cyan-300 truncate flex-1 select-all">
              {mobileUrl || `http://.../${roomId}`}
            </span>
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Contextual Wi-Fi Tip */}
        <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-left space-y-1.5">
          {isLocalNetwork ? (
            <div className="flex items-start gap-2 text-xs text-amber-300">
              <Wifi className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
              <span>
                <strong>Local Network:</strong> Ensure your phone is connected to the same Wi-Fi network as this computer.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-xs text-emerald-300">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
              <span>
                <strong>Direct Encrypted Peer Mesh:</strong> Transmits browser-to-browser via WebRTC with zero cloud logs.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
