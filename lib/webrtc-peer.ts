import { Peer, DataConnection } from 'peerjs';

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  senderId: string;
  timestamp: number;
}

export interface FileTransferState extends FileMetadata {
  receivedChunks: number;
  progress: number;
  status: 'transferring' | 'completed' | 'failed';
  blobUrl?: string;
  chunks?: ArrayBuffer[];
  previewUrl?: string;
}

export interface WebRTCCallbacks {
  onPeerConnect?: (peerId: string, count: number) => void;
  onPeerDisconnect?: (peerId: string, count: number) => void;
  onCodeChange?: (code: string, language?: string, senderId?: string) => void;
  onFileTransferStart?: (file: FileTransferState) => void;
  onFileTransferProgress?: (transferId: string, progress: number, receivedChunks: number) => void;
  onFileTransferComplete?: (transferId: string, blobUrl: string, previewUrl?: string) => void;
  onStatusChange?: (status: string, details?: string) => void;
}

const CHUNK_SIZE = 32 * 1024; // 32 KB per chunk for ultra-reliable streaming

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof window !== 'undefined' ? window.btoa(binary) : '';
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = typeof window !== 'undefined' ? window.atob(base64) : '';
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export class P2PManager {
  private peer: Peer | null = null;
  public peerId: string = '';
  public roomId: string = '';
  private connections: Map<string, DataConnection> = new Map();
  private pendingConnections: Set<string> = new Set();
  private localTabPeers: Set<string> = new Set();
  private socketPeers: Set<string> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private callbacks: WebRTCCallbacks;
  private currentCode: string = '';
  private currentLanguage: string = 'javascript';
  private activeIncomingTransfers: Map<string, FileTransferState> = new Map();
  private processedRelayMessages: Set<string> = new Set();
  private socket: any = null;

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  public setSocket(socket: any) {
    this.socket = socket;
  }

  public handleSocketPeers(peers: string[]) {
    peers.forEach((id) => {
      if (id && id !== this.peerId) {
        this.socketPeers.add(id);
      }
    });
    this.callbacks.onPeerConnect?.('network', this.getTotalPeerCount());
  }

  public handleSocketPeerJoined(peerId: string) {
    if (peerId && peerId !== this.peerId) {
      this.socketPeers.add(peerId);
      this.callbacks.onPeerConnect?.(peerId, this.getTotalPeerCount());
    }
  }

  public handleSocketPeerLeft(peerId: string) {
    this.socketPeers.delete(peerId);
    this.callbacks.onPeerDisconnect?.(peerId, this.getTotalPeerCount());
  }

  public init(roomId: string, isHostHint?: boolean, customPeerServerHost?: string): Promise<string> {
    this.roomId = roomId;

    return new Promise((resolve) => {
      // Deterministic Host ID: peer-{roomId}-host
      // Guest ID: peer-{roomId}-{randomSuffix}
      const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
      const hostPeerId = `peer-${roomId}-host`;
      const guestPeerId = `peer-${roomId}-${randomSuffix}`;
      
      // If host hint is explicitly true or undefined (first visitor), attempt host ID first
      const shouldAttemptHost = isHostHint !== false;
      const initialId = shouldAttemptHost ? hostPeerId : guestPeerId;

      // Initialize Same-System Tab Sync via BroadcastChannel API
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel(`beamshare-room-${roomId}`);
          this.broadcastChannel.onmessage = (event) => {
            const { action, payload, senderId } = event.data || {};
            if (!senderId || senderId === this.peerId) return;

            if (action === 'TAB_JOIN') {
              this.localTabPeers.add(senderId);
              this.callbacks.onPeerConnect?.(senderId, this.getTotalPeerCount());
              // Reply to joining tab with our presence and current code state
              this.broadcastChannel?.postMessage({
                action: 'TAB_PRESENT',
                senderId: this.peerId,
                payload: { code: this.currentCode, language: this.currentLanguage }
              });
            } else if (action === 'TAB_PRESENT') {
              this.localTabPeers.add(senderId);
              this.callbacks.onPeerConnect?.(senderId, this.getTotalPeerCount());
              if (payload?.code) {
                this.currentCode = payload.code;
                if (payload.language) this.currentLanguage = payload.language;
                this.callbacks.onCodeChange?.(payload.code, payload.language, senderId);
              }
            } else if (action === 'TAB_LEAVE') {
              this.localTabPeers.delete(senderId);
              this.callbacks.onPeerDisconnect?.(senderId, this.getTotalPeerCount());
            } else if (action === 'DATA_STREAM') {
              this.handleIncomingData(payload, senderId);
            }
          };

          this.broadcastChannel.postMessage({
            action: 'TAB_JOIN',
            senderId: initialId
          });
        } catch (e) {
          console.warn('BroadcastChannel notice:', e);
        }
      }

      // High-availability public STUN servers for WebRTC NAT traversal
      const iceServers: any[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.services.mozilla.com' }
      ];

      // Support custom TURN credentials via environment variables if provided
      if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_TURN_URL) {
        iceServers.unshift({
          urls: process.env.NEXT_PUBLIC_TURN_URL,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || ''
        });
      }

      const config: any = {
        debug: 1,
        config: {
          iceServers
        }
      };

      if (customPeerServerHost) {
        try {
          const url = new URL(customPeerServerHost);
          config.host = url.hostname;
          config.port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
          config.path = '/peerjs';
          config.secure = url.protocol === 'https:';
        } catch (e) {
          console.warn('Invalid custom peer server URL');
        }
      }

      const connectGuestToHost = () => {
        let attempts = 0;
        const tryConnect = () => {
          if (this.connections.has(hostPeerId) || attempts >= 8) return;
          attempts++;
          this.connectToPeer(hostPeerId);
          setTimeout(tryConnect, 2000);
        };
        setTimeout(tryConnect, 400);
      };

      const startPeer = (assignedId: string, isHostAttempt: boolean) => {
        try {
          const peer = new Peer(assignedId, config);
          this.peer = peer;

          peer.on('open', (id) => {
            this.peerId = id;
            this.callbacks.onStatusChange?.('connected', `Your Peer ID: ${id}`);
            if (id !== hostPeerId) {
              connectGuestToHost();
            }
            resolve(id);
          });

          peer.on('connection', (conn) => {
            this.setupConnection(conn);
          });

          peer.on('error', (err: any) => {
            console.warn('PeerJS node event:', err?.type || err?.message || err);

            // If host ID was already claimed by room creator, smoothly switch to guest ID and connect to host!
            if (isHostAttempt && err?.type === 'unavailable-id') {
              try {
                peer.destroy();
              } catch {}
              startPeer(guestPeerId, false);
              return;
            }

            if (!this.peerId) {
              this.peerId = assignedId;
              if (assignedId !== hostPeerId) {
                connectGuestToHost();
              }
              resolve(assignedId);
            }
          });
        } catch (e) {
          console.error('Peer initialization exception:', e);
          this.peerId = assignedId;
          resolve(assignedId);
        }
      };

      startPeer(initialId, shouldAttemptHost);
    });
  }

  public connectToPeer(targetPeerId: string) {
    if (
      !this.peer ||
      this.connections.has(targetPeerId) ||
      this.pendingConnections.has(targetPeerId) ||
      targetPeerId === this.peerId
    ) {
      return;
    }

    this.pendingConnections.add(targetPeerId);

    // Timeout safety: remove from pending after 5s so reconnect retries are never locked out
    const pendingTimer = setTimeout(() => {
      this.pendingConnections.delete(targetPeerId);
    }, 5000);

    try {
      const conn = this.peer.connect(targetPeerId, { reliable: true });
      this.setupConnection(conn, pendingTimer);
    } catch (err) {
      clearTimeout(pendingTimer);
      console.error(`Error connecting to peer ${targetPeerId}:`, err);
      this.pendingConnections.delete(targetPeerId);
    }
  }

  private setupConnection(conn: DataConnection, pendingTimer?: any) {
    if (this.connections.has(conn.peer)) {
      const existing = this.connections.get(conn.peer);
      if (existing && existing.open) {
        if (pendingTimer) clearTimeout(pendingTimer);
        this.pendingConnections.delete(conn.peer);
        return;
      }
    }

    conn.on('open', () => {
      if (pendingTimer) clearTimeout(pendingTimer);
      this.pendingConnections.delete(conn.peer);
      this.connections.set(conn.peer, conn);
      this.callbacks.onPeerConnect?.(conn.peer, this.getTotalPeerCount());

      // If we have current workspace code, immediately sync it with the newly connected peer!
      if (this.currentCode) {
        conn.send({
          type: 'CODE_SYNC',
          code: this.currentCode,
          language: this.currentLanguage,
          senderId: this.peerId
        });
      } else {
        conn.send({ type: 'REQUEST_INITIAL_CODE' });
      }
    });

    conn.on('data', (data: any) => {
      this.handleIncomingData(data, conn.peer);
    });

    conn.on('close', () => {
      if (pendingTimer) clearTimeout(pendingTimer);
      this.pendingConnections.delete(conn.peer);
      this.connections.delete(conn.peer);
      this.callbacks.onPeerDisconnect?.(conn.peer, this.getTotalPeerCount());
    });

    conn.on('error', (err) => {
      if (pendingTimer) clearTimeout(pendingTimer);
      this.pendingConnections.delete(conn.peer);
      this.connections.delete(conn.peer);
      this.callbacks.onPeerDisconnect?.(conn.peer, this.getTotalPeerCount());
    });
  }

  public handleRelayedData(data: any) {
    if (!data || typeof data !== 'object') return;
    if (data.senderId && data.senderId === this.peerId) return;

    // Deduplication check
    const msgKey =
      data.type === 'FILE_CHUNK'
        ? `${data.transferId}-${data.chunkIndex}`
        : data.type === 'CODE_SYNC'
        ? `code-${data.code?.length}-${data.language}`
        : null;

    if (msgKey) {
      if (this.processedRelayMessages.has(msgKey)) return;
      this.processedRelayMessages.add(msgKey);
      if (this.processedRelayMessages.size > 2000) {
        const first = this.processedRelayMessages.values().next().value;
        if (first) this.processedRelayMessages.delete(first);
      }
    }

    this.handleIncomingData(data, data.senderId || 'relay');
  }

  private handleIncomingData(data: any, fromPeerId: string) {
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'CODE_SYNC':
        this.currentCode = data.code;
        if (data.language) this.currentLanguage = data.language;
        this.callbacks.onCodeChange?.(data.code, data.language, fromPeerId);
        break;

      case 'REQUEST_INITIAL_CODE':
        if (this.currentCode && this.connections.has(fromPeerId)) {
          this.connections.get(fromPeerId)?.send({
            type: 'CODE_SYNC',
            code: this.currentCode,
            language: this.currentLanguage,
            senderId: this.peerId
          });
        }
        break;

      case 'FILE_START': {
        const transfer: FileTransferState = {
          id: data.transferId,
          name: data.name,
          size: data.size,
          type: data.mimeType,
          totalChunks: data.totalChunks,
          senderId: fromPeerId,
          timestamp: Date.now(),
          receivedChunks: 0,
          progress: 0,
          status: 'transferring',
          chunks: []
        };
        this.activeIncomingTransfers.set(data.transferId, transfer);
        this.callbacks.onFileTransferStart?.(transfer);
        break;
      }

      case 'FILE_CHUNK': {
        const transfer = this.activeIncomingTransfers.get(data.transferId);
        if (transfer && transfer.chunks) {
          if (transfer.chunks[data.chunkIndex]) {
            // Already received this chunk (e.g. from both WebRTC and relay)
            return;
          }
          const chunkBuffer = base64ToArrayBuffer(data.chunkData);
          transfer.chunks[data.chunkIndex] = chunkBuffer;
          transfer.receivedChunks += 1;
          transfer.progress = Math.min(100, Math.round((transfer.receivedChunks / transfer.totalChunks) * 100));
          
          this.callbacks.onFileTransferProgress?.(data.transferId, transfer.progress, transfer.receivedChunks);

          if (transfer.receivedChunks >= transfer.totalChunks) {
            // Reassemble Blob
            const blob = new Blob(transfer.chunks, { type: transfer.type });
            const blobUrl = URL.createObjectURL(blob);
            let previewUrl: string | undefined = undefined;

            if (transfer.type.startsWith('image/')) {
              previewUrl = blobUrl;
            }

            transfer.status = 'completed';
            transfer.blobUrl = blobUrl;
            transfer.previewUrl = previewUrl;

            this.callbacks.onFileTransferComplete?.(data.transferId, blobUrl, previewUrl);
          }
        }
        break;
      }
    }
  }

  public broadcastCode(code: string, language: string) {
    this.currentCode = code;
    this.currentLanguage = language;

    const payload = {
      type: 'CODE_SYNC',
      code,
      language,
      senderId: this.peerId
    };

    // 1. Send via WebRTC DataChannels
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch {}
      }
    });

    // 2. Broadcast to same-system tabs
    this.broadcastChannel?.postMessage({
      action: 'DATA_STREAM',
      senderId: this.peerId,
      payload
    });

    // 3. Fallback broadcast via signaling socket relay (guarantees delivery across mobile networks/CGNAT)
    if (this.socket && this.socket.connected) {
      this.socket.emit('relay-message', {
        roomId: this.roomId,
        data: payload
      });
    }
  }

  public async broadcastFile(file: File, existingTransferId?: string, onProgress?: (progress: number) => void): Promise<string> {
    const transferId = existingTransferId || `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const arrayBuffer = await file.arrayBuffer();
    const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);

    const startPayload = {
      type: 'FILE_START',
      transferId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
      senderId: this.peerId
    };

    // 1. Send FILE_START to WebRTC peers & same-system tabs & socket relay
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(startPayload);
        } catch {}
      }
    });

    this.broadcastChannel?.postMessage({
      action: 'DATA_STREAM',
      senderId: this.peerId,
      payload: startPayload
    });

    if (this.socket && this.socket.connected) {
      this.socket.emit('relay-message', {
        roomId: this.roomId,
        data: startPayload
      });
    }

    // 2. Stream Base64 Chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(arrayBuffer.byteLength, start + CHUNK_SIZE);
      const chunkSlice = arrayBuffer.slice(start, end);
      const base64Chunk = arrayBufferToBase64(chunkSlice);

      const chunkPayload = {
        type: 'FILE_CHUNK',
        transferId,
        chunkIndex: i,
        chunkData: base64Chunk,
        senderId: this.peerId
      };

      this.connections.forEach((conn) => {
        if (conn.open) {
          try {
            conn.send(chunkPayload);
          } catch {}
        }
      });

      this.broadcastChannel?.postMessage({
        action: 'DATA_STREAM',
        senderId: this.peerId,
        payload: chunkPayload
      });

      if (this.socket && this.socket.connected) {
        this.socket.emit('relay-message', {
          roomId: this.roomId,
          data: chunkPayload
        });
      }

      const currentProgress = Math.min(100, Math.round(((i + 1) / totalChunks) * 100));
      onProgress?.(currentProgress);

      if (i % 6 === 0) {
        await new Promise((res) => setTimeout(res, 4));
      }
    }

    return transferId;
  }

  public getTotalPeerCount(): number {
    const allPeers = new Set<string>();
    this.connections.forEach((conn, id) => {
      if (conn.open) allPeers.add(id);
    });
    this.localTabPeers.forEach((id) => allPeers.add(id));
    this.socketPeers.forEach((id) => allPeers.add(id));
    return allPeers.size;
  }

  public disconnect() {
    this.pendingConnections.clear();
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        action: 'TAB_LEAVE',
        senderId: this.peerId
      });
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    this.connections.forEach((conn) => {
      try {
        conn.close();
      } catch {}
    });
    this.connections.clear();
    this.localTabPeers.clear();
    this.socketPeers.clear();

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }
  }
}
