'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { Header } from '@/components/Header';
import { CodeEditor } from '@/components/CodeEditor';
import { FileSharing } from '@/components/FileSharing';
import { PeerList } from '@/components/PeerList';
import { AdBanner } from '@/components/AdBanner';
import { P2PManager, FileTransferState } from '@/lib/webrtc-peer';
import { isValidRoomId } from '@/lib/slug';
import { Code2, HardDrive, Columns } from 'lucide-react';

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const unwrappedParams = use(params);
  const roomId = unwrappedParams.roomId;
  const router = useRouter();

  const [myPeerId, setMyPeerId] = useState<string>('');
  const [peers, setPeers] = useState<string[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'alone' | 'error'>('connecting');
  const [statusDetails, setStatusDetails] = useState<string>('Initializing P2P node...');
  
  // Workspace Tab State ('editor' by default for full screen code view)
  const [activeTab, setActiveTab] = useState<'editor' | 'files' | 'split'>('editor');

  // Workspace State
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('javascript');
  const [transfers, setTransfers] = useState<FileTransferState[]>([]);

  const p2pRef = useRef<P2PManager | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!roomId || !isValidRoomId(roomId)) {
      router.push('/');
      return;
    }

    let isMounted = true;

    // Check if this instance is the host creator
    const isHost = typeof window !== 'undefined' && 
      (new URLSearchParams(window.location.search).get('host') === '1' ||
       new URLSearchParams(window.location.search).get('create') === '1');

    // Determine signaling server URL (auto-detects production reverse proxy vs local development)
    const getSignalingUrl = () => {
      if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
        return process.env.NEXT_PUBLIC_SIGNALING_URL;
      }
      if (typeof window !== 'undefined') {
        const isLocalhost =
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';
        if (isLocalhost) {
          return `${window.location.protocol}//${window.location.hostname}:3001`;
        }
        return window.location.origin;
      }
      return 'http://localhost:3001';
    };

    const signalingUrl = getSignalingUrl();

    // Initialize P2P WebRTC Manager
    const manager = new P2PManager({
      onPeerConnect: (peerId, count) => {
        if (!isMounted) return;
        setPeers((prev) => Array.from(new Set([...prev, peerId])));
        setStatus('connected');
      },
      onPeerDisconnect: (peerId, count) => {
        if (!isMounted) return;
        setPeers((prev) => prev.filter((p) => p !== peerId));
        if (count === 0) setStatus('alone');
      },
      onCodeChange: (newCode, newLang, senderId) => {
        if (!isMounted) return;
        setCode(newCode);
        if (newLang) setLanguage(newLang);
      },
      onFileTransferStart: (transfer) => {
        if (!isMounted) return;
        setTransfers((prev) => [transfer, ...prev.filter((t) => t.id !== transfer.id)]);
      },
      onFileTransferProgress: (transferId, progress, receivedChunks) => {
        if (!isMounted) return;
        setTransfers((prev) =>
          prev.map((t) => (t.id === transferId ? { ...t, progress, receivedChunks } : t))
        );
      },
      onFileTransferComplete: (transferId, blobUrl, previewUrl) => {
        if (!isMounted) return;
        setTransfers((prev) =>
          prev.map((t) =>
            t.id === transferId
              ? { ...t, status: 'completed', progress: 100, blobUrl, previewUrl }
              : t
          )
        );
      },
      onStatusChange: (newStatus, details) => {
        if (!isMounted) return;
        if (details) setStatusDetails(details);
      }
    });

    p2pRef.current = manager;

    // Connect to PeerJS (deterministic host/guest) & Signaling socket
    manager
      .init(roomId, isHost)
      .then((assignedPeerId) => {
        if (!isMounted) return;
        setMyPeerId(assignedPeerId);
        setStatus('alone');

        // Connect to Socket.io signaling server for dual-mesh discovery
        const socket = io(signalingUrl, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 10,
          timeout: 10000
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          setStatusDetails('Connected to signaling server');
          socket.emit('join-room', { roomId, peerId: assignedPeerId });
        });

        socket.on('connect_error', (err) => {
          console.warn('Signaling socket notice (direct P2P active):', err?.message || err);
          setStatusDetails('Direct P2P mode active');
        });

        // Peer discovery via Socket.io
        socket.on('room-peers', ({ peers: existingPeers }: { peers: string[] }) => {
          existingPeers.forEach((targetPeerId) => {
            manager.connectToPeer(targetPeerId);
          });
        });

        socket.on('peer-joined', ({ peerId: newPeerId }: { peerId: string }) => {
          manager.connectToPeer(newPeerId);
        });

        socket.on('peer-left', ({ peerId: leftPeerId }: { peerId: string }) => {
          setPeers((prev) => prev.filter((p) => p !== leftPeerId));
        });
      })
      .catch((err) => {
        console.error('P2P initialization error:', err);
        if (isMounted) {
          setStatus('error');
          setStatusDetails('Could not establish WebRTC node.');
        }
      });

    return () => {
      isMounted = false;
      manager.disconnect();
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [roomId, router]);

  // Code Changes Broadcast
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (p2pRef.current) {
      p2pRef.current.broadcastCode(newCode, language);
    }
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    if (p2pRef.current) {
      p2pRef.current.broadcastCode(code, newLang);
    }
  };

  // File Transfer Broadcast
  const handleSendFile = async (file: File) => {
    if (!p2pRef.current) return;

    const transferId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const blobUrl = URL.createObjectURL(file);
    const previewUrl = file.type.startsWith('image/') ? blobUrl : undefined;

    const initialTransfer: FileTransferState = {
      id: transferId,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      totalChunks: Math.ceil(file.size / (32 * 1024)),
      senderId: myPeerId,
      timestamp: Date.now(),
      receivedChunks: 0,
      progress: 0,
      status: 'transferring',
      blobUrl,
      previewUrl
    };

    setTransfers((prev) => [initialTransfer, ...prev]);

    try {
      await p2pRef.current.broadcastFile(file, transferId, (progress) => {
        setTransfers((prev) =>
          prev.map((t) =>
            t.id === transferId
              ? {
                  ...t,
                  progress,
                  status: progress === 100 ? 'completed' : 'transferring',
                  blobUrl,
                  previewUrl
                }
              : t
          )
        );
      });
    } catch (err) {
      console.error('File send error:', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 relative">
      {/* Header */}
      <Header
        roomId={roomId}
        peerCount={peers.length}
        status={status}
        statusDetails={statusDetails}
      />

      {/* Top AdSense Banner */}
      <div className="max-w-7xl mx-auto px-4 w-full mt-2">
        <AdBanner type="header-banner" />
      </div>

      {/* Peer Mesh Status Bar & Workspace Mode Selector */}
      <div className="max-w-7xl mx-auto px-4 w-full my-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Active Connected Peer Badges */}
        <PeerList myPeerId={myPeerId} peers={peers} />

        {/* Tab Switcher Controls (Full Screen Code vs P2P Files vs Split View) */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Code Workspace</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer relative ${
              activeTab === 'files'
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Files & Media</span>
            {transfers.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-mono rounded-full bg-cyan-400 text-slate-950 font-bold">
                {transfers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('split')}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'split'
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Side-by-side split screen view"
          >
            <Columns className="w-4 h-4" />
            <span>Split View</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Display */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-2 flex flex-col">
        {activeTab === 'editor' && (
          <div className="w-full flex-1 flex flex-col min-h-[550px]">
            <CodeEditor
              code={code}
              language={language}
              onChange={handleCodeChange}
              onLanguageChange={handleLanguageChange}
            />
          </div>
        )}

        {activeTab === 'files' && (
          <div className="w-full flex-1 flex flex-col min-h-[550px]">
            <FileSharing
              transfers={transfers}
              onSendFile={handleSendFile}
              peerCount={peers.length}
            />
          </div>
        )}

        {activeTab === 'split' && (
          <div className="w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[550px]">
            <div className="lg:col-span-7 flex flex-col">
              <CodeEditor
                code={code}
                language={language}
                onChange={handleCodeChange}
                onLanguageChange={handleLanguageChange}
              />
            </div>
            <div className="lg:col-span-5 flex flex-col">
              <FileSharing
                transfers={transfers}
                onSendFile={handleSendFile}
                peerCount={peers.length}
              />
            </div>
          </div>
        )}
      </main>

      {/* Persistent AdSense Footer Banner */}
      <div className="max-w-7xl mx-auto px-4 w-full mb-3">
        <AdBanner type="footer-banner" />
      </div>
    </div>
  );
}
