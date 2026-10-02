'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, X, Smartphone, Wifi, ShieldCheck } from 'lucide-react';

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
  const [mounted, setMounted] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [mobileUrl, setMobileUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isLocalNetwork, setIsLocalNetwork] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;

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
            if (isSubscribed) setIsLocalNetwork(true);
          }
        } catch (e) {
          console.warn('Could not determine LAN IP:', e);
        }
      }

      // Ensure room URL is clean without ?host=1 or ?create=1
      const finalUrl = `${targetOrigin}/${roomId}`;
      if (isSubscribed) {
        setMobileUrl(finalUrl);
        try {
          const qrCodeUrl = await QRCode.toDataURL(finalUrl, {
            width: 256,
            margin: 1.5,
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

    // Close on Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isSubscribed = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, roomId, onClose]);

  if (!mounted || !isOpen) return null;

  const handleCopy = () => {
    if (!mobileUrl) return;
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative my-auto w-full max-w-sm bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] p-4 sm:p-5 text-slate-100 flex flex-col items-center animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Smartphone className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-white tracking-tight">Connect Phone</h2>
        </div>
        <p className="text-[11px] text-slate-400 text-center mb-3">
          Scan the QR code with your phone camera to join
        </p>

        {/* QR Code Container */}
        <div className="p-2.5 bg-white rounded-xl shadow-inner border border-slate-300 mb-3 flex items-center justify-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan QR Code to join room"
              className="w-40 h-40 sm:w-44 sm:h-44 object-contain rounded"
            />
          ) : (
            <div className="w-40 h-40 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
              <QrCode className="w-7 h-7 animate-spin text-cyan-500" />
              <span>Generating QR...</span>
            </div>
          )}
        </div>

        {/* Mobile URL & Copy Bar */}
        <div className="w-full mb-3">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1.5 pl-2.5">
            <span className="font-mono text-[11px] text-cyan-300 truncate flex-1 select-all">
              {mobileUrl || `https://.../${roomId}`}
            </span>
            <button
              onClick={handleCopy}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Connection Notice */}
        <div className="w-full bg-slate-900/70 border border-slate-800/80 rounded-xl px-2.5 py-2 text-left">
          {isLocalNetwork ? (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-300">
              <Wifi className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
              <span>
                <strong>Wi-Fi Notice:</strong> Ensure phone is on the same local network.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-1.5 text-[11px] text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
              <span>
                <strong>Encrypted P2P:</strong> Zero-database browser-to-browser sync.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
