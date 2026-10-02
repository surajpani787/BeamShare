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
  private broadcastChannel: BroadcastChannel | null = null;
  private callbacks: WebRTCCallbacks;
  private currentCode: string = '';
  private currentLanguage: string = 'javascript';
  private activeIncomingTransfers: Map<string, FileTransferState> = new Map();

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  public init(roomId: string, customPeerServerHost?: string): Promise<string> {
    this.roomId = roomId;

    return new Promise((resolve, reject) => {
      // Clean numeric peer ID
      const randomSuffix = Math.floor(100 + Math.random() * 900).toString();
      const fullPeerId = `peer-${roomId}-${randomSuffix}`;

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

          // Announce join to same-system tabs
          this.broadcastChannel.postMessage({
            action: 'TAB_JOIN',
            senderId: fullPeerId
          });
        } catch (e) {
          console.warn('BroadcastChannel error:', e);
        }
      }

      const iceServers: any[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelay',
          credential: 'openrelay'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelay',
          credential: 'openrelay'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelay',
          credential: 'openrelay'
        }
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

      this.peer = new Peer(fullPeerId, config);

      this.peer.on('open', (id) => {
        this.peerId = id;
        this.callbacks.onStatusChange?.('connected', `Your Peer ID: ${id}`);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        // Soft fallback for peer initialization errors
        if (!this.peerId) {
          this.peerId = fullPeerId;
          resolve(fullPeerId);
        }
      });
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
    try {
      const conn = this.peer.connect(targetPeerId, { reliable: true });
      this.setupConnection(conn);
    } catch (err) {
      console.error(`Error connecting to ${targetPeerId}:`, err);
      this.pendingConnections.delete(targetPeerId);
    }
  }

  private setupConnection(conn: DataConnection) {
    // Avoid creating duplicate connections if we already have an open one
    if (this.connections.has(conn.peer)) {
      const existing = this.connections.get(conn.peer);
      if (existing && existing.open) {
        return;
      }
    }

    conn.on('open', () => {
      this.pendingConnections.delete(conn.peer);
      this.connections.set(conn.peer, conn);
      this.callbacks.onPeerConnect?.(conn.peer, this.getTotalPeerCount());

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
      this.pendingConnections.delete(conn.peer);
      this.connections.delete(conn.peer);
      this.callbacks.onPeerDisconnect?.(conn.peer, this.getTotalPeerCount());
    });

    conn.on('error', (err) => {
      console.error(`Connection error with ${conn.peer}:`, err);
      this.pendingConnections.delete(conn.peer);
      this.connections.delete(conn.peer);
      this.callbacks.onPeerDisconnect?.(conn.peer, this.getTotalPeerCount());
    });
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
      if (conn.open) conn.send(payload);
    });

    // 2. Broadcast to same-system tabs
    this.broadcastChannel?.postMessage({
      action: 'DATA_STREAM',
      senderId: this.peerId,
      payload
    });
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

    // 1. Send FILE_START to WebRTC peers & same-system tabs
    this.connections.forEach((conn) => {
      if (conn.open) conn.send(startPayload);
    });
    this.broadcastChannel?.postMessage({
      action: 'DATA_STREAM',
      senderId: this.peerId,
      payload: startPayload
    });

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
        chunkData: base64Chunk
      };

      this.connections.forEach((conn) => {
        if (conn.open) conn.send(chunkPayload);
      });

      this.broadcastChannel?.postMessage({
        action: 'DATA_STREAM',
        senderId: this.peerId,
        payload: chunkPayload
      });

      const currentProgress = Math.min(100, Math.round(((i + 1) / totalChunks) * 100));
      onProgress?.(currentProgress);

      if (i % 8 === 0) {
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

    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    this.localTabPeers.clear();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
