/**
 * BeamShare Standalone Signaling Server
 * -------------------------------------------------------------
 * 100% Zero-Database, Zero-Storage WebRTC Signaling Server.
 * Transmits ONLY peer connection handshakes & room metadata.
 * NO code, text, or file payloads ever touch this server.
 * 
 * Hostinger Compatible: Can run via PM2, custom Next.js server, or standalone Node.js process.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

// Health check endpoint for Hostinger / Nginx uptime monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'BeamShare Signaling Server', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000
});

// Volatile in-memory room tracking (socket.id <-> roomId, peerId)
const rooms = new Map(); // roomId -> Set of socket details { socketId, peerId }
const socketToRoom = new Map(); // socketId -> { roomId, peerId }

io.on('connection', (socket) => {
  // User joins a collaboration room
  socket.on('join-room', ({ roomId, peerId }) => {
    if (!roomId || !peerId) return;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    const roomPeers = rooms.get(roomId);
    roomPeers.set(socket.id, peerId);
    socketToRoom.set(socket.id, { roomId, peerId });

    // Send current list of connected peers to the joining peer
    const existingPeers = Array.from(roomPeers.values()).filter(id => id !== peerId);
    socket.emit('room-peers', {
      peers: existingPeers,
      totalCount: roomPeers.size
    });

    // Notify existing peers that a new peer joined
    socket.to(roomId).emit('peer-joined', {
      peerId,
      totalCount: roomPeers.size
    });
  });

  // Relay WebRTC signaling data (offer, answer, ICE candidates) between peers
  socket.on('signal', ({ targetId, signalData, senderId }) => {
    // Find target socket
    const roomInfo = socketToRoom.get(socket.id);
    if (!roomInfo) return;

    const roomPeers = rooms.get(roomInfo.roomId);
    if (!roomPeers) return;

    for (const [sId, pId] of roomPeers.entries()) {
      if (pId === targetId) {
        io.to(sId).emit('signal', {
          senderId: senderId || roomInfo.peerId,
          signalData
        });
        break;
      }
    }
  });

  // Check if room has an active host/peers (Zero-Database)
  socket.on('check-room', ({ roomId }) => {
    const roomPeers = rooms.get(roomId);
    const count = roomPeers ? roomPeers.size : 0;
    socket.emit('room-status-result', {
      roomId,
      isFirst: count === 0,
      count
    });
  });

  // Requester sends connection request to active room peers/host
  socket.on('request-access', ({ roomId, peerId, displayName }) => {
    if (!roomId || !peerId) return;
    socket.to(roomId).emit('incoming-access-request', {
      requesterSocketId: socket.id,
      peerId,
      displayName: displayName || peerId
    });
  });

  // Host approves connection request
  socket.on('accept-access', ({ requesterSocketId, roomId }) => {
    io.to(requesterSocketId).emit('access-granted', { roomId });
  });

  // Host declines connection request
  socket.on('reject-access', ({ requesterSocketId, reason }) => {
    io.to(requesterSocketId).emit('access-denied', {
      reason: reason || 'Connection request was declined by the host.'
    });
  });

  // Requester cancels their pending request
  socket.on('cancel-access-request', ({ roomId, peerId }) => {
    socket.to(roomId).emit('access-request-cancelled', {
      requesterSocketId: socket.id,
      peerId
    });
  });

  // Request room status
  socket.on('get-room-status', ({ roomId }) => {
    const roomPeers = rooms.get(roomId);
    socket.emit('room-status', {
      count: roomPeers ? roomPeers.size : 0
    });
  });

  // Handle peer disconnect
  socket.on('disconnect', () => {
    const info = socketToRoom.get(socket.id);
    if (info) {
      const { roomId, peerId } = info;
      const roomPeers = rooms.get(roomId);
      if (roomPeers) {
        roomPeers.delete(socket.id);
        if (roomPeers.size === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('peer-left', {
            peerId,
            totalCount: roomPeers.size
          });
        }
      }
      socketToRoom.delete(socket.id);
    }
  });
});

const PORT = process.env.SIGNALING_PORT || process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`⚡ BeamShare Signaling Server running on port ${PORT}`);
});
