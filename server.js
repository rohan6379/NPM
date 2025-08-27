const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store connected clients
const connectedClients = new Map();

// Serve the dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.get('/api/clients', (req, res) => {
  const clients = Array.from(connectedClients.values()).map(client => ({
    id: client.id,
    hostname: client.hostname,
    ip: client.ip,
    connected: client.connected,
    lastSeen: client.lastSeen
  }));
  res.json(clients);
});

// Power management endpoints
app.post('/api/shutdown/:clientId', (req, res) => {
  const { clientId } = req.params;
  const { delay = 0 } = req.body;

  const client = connectedClients.get(clientId);
  if (!client || !client.connected) {
    return res.status(404).json({ error: 'Client not found or not connected' });
  }

  client.socket.emit('shutdown', { delay });
  res.json({ message: `Shutdown command sent to ${client.hostname}` });
});

app.post('/api/reboot/:clientId', (req, res) => {
  const { clientId } = req.params;
  const { delay = 0 } = req.body;

  const client = connectedClients.get(clientId);
  if (!client || !client.connected) {
    return res.status(404).json({ error: 'Client not found or not connected' });
  }

  client.socket.emit('reboot', { delay });
  res.json({ message: `Reboot command sent to ${client.hostname}` });
});

app.post('/api/cancel/:clientId', (req, res) => {
  const { clientId } = req.params;

  const client = connectedClients.get(clientId);
  if (!client || !client.connected) {
    return res.status(404).json({ error: 'Client not found or not connected' });
  }

  client.socket.emit('cancel');
  res.json({ message: `Cancel command sent to ${client.hostname}` });
});

app.post('/api/broadcast', (req, res) => {
  const { message, clientIds } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  let targetClients = [];

  if (clientIds && clientIds.length > 0) {
    // Broadcast to specific clients
    targetClients = clientIds.map(id => connectedClients.get(id)).filter(Boolean);
  } else {
    // Broadcast to all connected clients
    targetClients = Array.from(connectedClients.values()).filter(client => client.connected);
  }

  targetClients.forEach(client => {
    client.socket.emit('broadcast', { message });
  });

  res.json({
    message: `Broadcast sent to ${targetClients.length} client(s)`,
    targets: targetClients.map(c => c.hostname)
  });
});

// Clear offline devices endpoint
app.post('/api/clear-offline', (req, res) => {
  const offlineClients = Array.from(connectedClients.values()).filter(client => !client.connected);
  const offlineCount = offlineClients.length;

  if (offlineCount === 0) {
    return res.json({ message: 'No offline devices to clear' });
  }

  // Remove offline clients from the map
  offlineClients.forEach(client => {
    connectedClients.delete(client.id);
  });

  console.log(`Cleared ${offlineCount} offline client(s)`);

  // Broadcast updated client list to all dashboards
  io.emit('clientsUpdated', Array.from(connectedClients.values()).map(client => ({
    id: client.id,
    hostname: client.hostname,
    ip: client.ip,
    connected: client.connected,
    lastSeen: client.lastSeen
  })));

  res.json({
    message: `Successfully cleared ${offlineCount} offline device(s)`,
    clearedCount: offlineCount
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('register', (data) => {
    const clientId = uuidv4();
    const clientInfo = {
      id: clientId,
      socket: socket,
      hostname: data.hostname,
      ip: data.ip || socket.handshake.address,
      connected: true,
      lastSeen: new Date(),
      socketId: socket.id
    };

    connectedClients.set(clientId, clientInfo);
    socket.clientId = clientId;

    console.log(`Client registered: ${data.hostname} (${clientId})`);

    // Send client ID back
    socket.emit('registered', { clientId });

    // Broadcast updated client list to dashboard
    io.emit('clientsUpdated', Array.from(connectedClients.values()).map(client => ({
      id: client.id,
      hostname: client.hostname,
      ip: client.ip,
      connected: client.connected,
      lastSeen: client.lastSeen
    })));
  });

  socket.on('heartbeat', () => {
    if (socket.clientId) {
      const client = connectedClients.get(socket.clientId);
      if (client) {
        client.lastSeen = new Date();
      }
    }
  });

  socket.on('commandResult', (data) => {
    console.log(`Command result from ${socket.clientId}:`, data);
    // Broadcast result to dashboard
    io.emit('commandResult', {
      clientId: socket.clientId,
      ...data
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    if (socket.clientId) {
      const client = connectedClients.get(socket.clientId);
      if (client) {
        client.connected = false;
        client.lastSeen = new Date();
      }

      // Broadcast updated client list
      io.emit('clientsUpdated', Array.from(connectedClients.values()).map(client => ({
        id: client.id,
        hostname: client.hostname,
        ip: client.ip,
        connected: client.connected,
        lastSeen: client.lastSeen
      })));
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Dashboard available at http://localhost:${PORT}`);
});