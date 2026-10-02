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
import { Code2, HardDrive, Columns, Radio } from 'lucide-react';
import {
  IncomingRequest,
  IncomingRequestToast,
  JoinRequestGate
} from '@/components/AccessRequestModal';

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

  // Zero-Database Host Knocking & Access Approval State
  const [isApproved, setIsApproved] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('host') === '1' || sp.get('create') === '1') return true;
    }
    return false;
  });
  const [requestState, setRequestState] = useState<'checking' | 'idle' | 'pending' | 'rejected'>(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('host') === '1' || sp.get('create') === '1') return 'idle';
    }
    return 'checking';
  });
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);

  const p2pRef = useRef<P2PManager | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!roomId || !isValidRoomId(roomId)) {
      router.push('/');
      return;
    }

    let isMounted = true;

    // Determine signaling server URL (auto-detects production reverse proxy vs local development)
    const getSignalingUrl = () => {
      if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
        return process.env.NEXT_PUBLIC_SIGNALING_URL;
      }
      if (typeof window !== 'undefined') {
        const isLocalhost =
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';
        // In local development, the Node server runs on 3001
        if (isLocalhost) {
          return `${window.location.protocol}//${window.location.hostname}:3001`;
        }
        // In production on a live domain, Socket.IO is proxied through the same domain (e.g. /socket.io/)
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

    // Connect to PeerJS & Signaling socket
    manager
      .init(roomId)
      .then((assignedPeerId) => {
        if (!isMounted) return;
        setMyPeerId(assignedPeerId);
        setStatus('alone');

        // Connect to Socket.io signaling server for peer discovery
        const socket = io(signalingUrl, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 10,
          timeout: 10000
        });

        socketRef.current = socket;

        let checkRoomTimeout: NodeJS.Timeout | null = null;

        const autoAdmitAsHost = () => {
          if (!isMounted) return;
          if (checkRoomTimeout) {
            clearTimeout(checkRoomTimeout);
            checkRoomTimeout = null;
          }
          setIsApproved(true);
          setRequestState('idle');
          socket.emit('join-room', { roomId, peerId: assignedPeerId });
        };

        // If URL has ?host=1, user just created the room: admit immediately with zero delay
        const isUrlHost = typeof window !== 'undefined' && 
          (new URLSearchParams(window.location.search).get('host') === '1' ||
           new URLSearchParams(window.location.search).get('create') === '1');

        if (isUrlHost) {
          autoAdmitAsHost();
        } else {
          // Safety timeout: if signaling server doesn't respond within 1.5s, auto-admit so users are never stuck
          checkRoomTimeout = setTimeout(() => {
            autoAdmitAsHost();
          }, 1500);
        }

        socket.on('connect', () => {
          setStatusDetails('Connected to signaling server');
          if (!isUrlHost) {
            socket.emit('check-room', { roomId });
          } else {
            socket.emit('join-room', { roomId, peerId: assignedPeerId });
          }
        });

        socket.on('room-status-result', ({ isFirst }: { isFirst: boolean; count: number }) => {
          if (!isMounted) return;
          if (checkRoomTimeout) {
            clearTimeout(checkRoomTimeout);
            checkRoomTimeout = null;
          }

          if (isFirst) {
            // First peer in room is the host: auto-admit into workspace
            autoAdmitAsHost();
          } else {
            // Room is already active: require host knocking & approval
            setIsApproved(false);
            setRequestState('idle');
          }
        });

        socket.on('connect_error', (err) => {
          console.warn('Signaling socket connection warning:', err?.message || err);
          setStatusDetails('Connecting to signaling network...');
          // On connection error, auto-admit so users are never trapped on a loading screen
          autoAdmitAsHost();
        });

        // Guest receives approval from host
        socket.on('access-granted', () => {
          if (!isMounted) return;
          setIsApproved(true);
          setRequestState('idle');
          socket.emit('join-room', { roomId, peerId: assignedPeerId });
        });

        // Guest receives rejection from host
        socket.on('access-denied', ({ reason }: { reason?: string }) => {
          if (!isMounted) return;
          setIsApproved(false);
          setRequestState('rejected');
          setRejectionReason(reason || 'The host declined your request to join.');
        });

        // Host receives incoming connection request from another device
        socket.on('incoming-access-request', (req: IncomingRequest) => {
          if (!isMounted) return;
          setIncomingRequests((prev) => [
            ...prev.filter((r) => r.requesterSocketId !== req.requesterSocketId),
            req
          ]);
        });

        // Requester cancelled their connection request
        socket.on('access-request-cancelled', ({ requesterSocketId }: { requesterSocketId: string }) => {
          if (!isMounted) return;
          setIncomingRequests((prev) =>
            prev.filter((r) => r.requesterSocketId !== requesterSocketId)
          );
        });

        // Peer discovery: Only the newly joined peer initiates connections to existing peers in the room.
        // This eliminates WebRTC "glare" (simultaneous connection attempts from both sides).
        socket.on('room-peers', ({ peers: existingPeers }: { peers: string[] }) => {
          if (existingPeers.length > 0) {
            setStatusDetails(`Found ${existingPeers.length} peer(s), connecting...`);
          }
          existingPeers.forEach((targetPeerId) => {
            manager.connectToPeer(targetPeerId);
          });
        });

        // When a new peer joins after us, they will connect to us via 'room-peers'.
        // We do NOT initiate connection here to avoid race conditions.
        socket.on('peer-joined', ({ peerId: newPeerId }: { peerId: string }) => {
          setStatusDetails(`Peer joined room: ${newPeerId}`);
        });

        socket.on('peer-left', ({ peerId: leftPeerId }: { peerId: string }) => {
          setPeers((prev) => prev.filter((p) => p !== leftPeerId));
        });
      })
      .catch((err) => {
        console.error('P2P initialization error:', err);
        if (isMounted) {
          setStatus('error');
          setStatusDetails('Could not establish WebRTC peer connection.');
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

  // Host handles incoming guest knocking (Zero-Database)
  const handleAcceptRequest = (req: IncomingRequest) => {
    if (socketRef.current) {
      socketRef.current.emit('accept-access', {
        requesterSocketId: req.requesterSocketId,
        roomId
      });
    }
    setIncomingRequests((prev) =>
      prev.filter((r) => r.requesterSocketId !== req.requesterSocketId)
    );
  };

  const handleRejectRequest = (req: IncomingRequest) => {
    if (socketRef.current) {
      socketRef.current.emit('reject-access', {
        requesterSocketId: req.requesterSocketId,
        reason: 'Connection request was declined by the host.'
      });
    }
    setIncomingRequests((prev) =>
      prev.filter((r) => r.requesterSocketId !== req.requesterSocketId)
    );
  };

  // Guest actions
  const handleRequestAccess = (displayName: string) => {
    if (socketRef.current && myPeerId) {
      setRequestState('pending');
      socketRef.current.emit('request-access', {
        roomId,
        peerId: myPeerId,
        displayName
      });
    }
  };

  const handleCancelRequest = () => {
    if (socketRef.current && myPeerId) {
      socketRef.current.emit('cancel-access-request', {
        roomId,
        peerId: myPeerId
      });
      setRequestState('idle');
    }
  };

  // If not yet approved by the room host, render the Zero-Storage Request Gate
  if (!isApproved) {
    if (requestState === 'checking') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#090d16] text-slate-100 p-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-400 mb-3 animate-pulse">
            <Radio className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-slate-200">Checking Room Status...</p>
          <p className="text-xs text-slate-500 mt-1">100% Zero-Storage P2P Network</p>
        </div>
      );
    }

    return (
      <JoinRequestGate
        roomId={roomId}
        defaultName={myPeerId ? `Device-${myPeerId.split('-').pop()}` : 'Guest Peer'}
        requestState={requestState}
        rejectionReason={rejectionReason}
        onRequestAccess={handleRequestAccess}
        onCancelRequest={handleCancelRequest}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 relative">
      {/* Floating Incoming Request Notification for Host */}
      {incomingRequests.length > 0 && (
        <IncomingRequestToast
          request={incomingRequests[0]}
          onAccept={handleAcceptRequest}
          onReject={handleRejectRequest}
        />
      )}

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
