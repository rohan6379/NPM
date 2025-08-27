const socket = io();
let clients = [];
let selectedClients = new Set();

// DOM elements
const totalClientsEl = document.getElementById('totalClients');
const onlineClientsEl = document.getElementById('onlineClients');
const offlineClientsEl = document.getElementById('offlineClients');
const clientsListEl = document.getElementById('clientsList');
const logsEl = document.getElementById('logs');
const broadcastMessageEl = document.getElementById('broadcastMessage');
const broadcastAllBtn = document.getElementById('broadcastAll');
const broadcastSelectedBtn = document.getElementById('broadcastSelected');
const clearOfflineBtn = document.getElementById('clearOfflineBtn');

// Socket event listeners
socket.on('connect', () => {
    addLog('Connected to server', 'success');
    loadClients();
});

socket.on('disconnect', () => {
    addLog('Disconnected from server', 'error');
});

socket.on('clientsUpdated', (updatedClients) => {
    clients = updatedClients;
    updateStats();
    renderClients();
    addLog(`Client list updated - ${clients.filter(c => c.connected).length} online`);
});

socket.on('commandResult', (result) => {
    const client = clients.find(c => c.id === result.clientId);
    const hostname = client ? client.hostname : 'Unknown';
    
    if (result.success) {
        addLog(`✅ ${result.command} executed successfully on ${hostname}`, 'success');
    } else {
        addLog(`❌ ${result.command} failed on ${hostname}: ${result.error}`, 'error');
    }
});

// Load initial client data
async function loadClients() {
    try {
        const response = await fetch('/api/clients');
        clients = await response.json();
        updateStats();
        renderClients();
    } catch (error) {
        addLog('Failed to load clients', 'error');
    }
}

// Update statistics
function updateStats() {
    const online = clients.filter(c => c.connected).length;
    const offline = clients.length - online;
    
    totalClientsEl.textContent = clients.length;
    onlineClientsEl.textContent = online;
    offlineClientsEl.textContent = offline;
}

// Render client cards
function renderClients() {
    if (clients.length === 0) {
        clientsListEl.innerHTML = `
            <div class="no-clients">
                <p>No clients connected. Install and run the Windows client on your target machines.</p>
            </div>
        `;
        return;
    }

    clientsListEl.innerHTML = clients.map(client => `
        <div class="client-card ${client.connected ? 'online' : 'offline'} ${selectedClients.has(client.id) ? 'selected' : ''}" 
             data-client-id="${client.id}">
            <div class="client-select">
                <label>
                    <input type="checkbox" ${selectedClients.has(client.id) ? 'checked' : ''} 
                           onchange="toggleClientSelection('${client.id}')">
                    Select for broadcast
                </label>
            </div>
            <div class="client-header">
                <div class="client-info">
                    <h3>🖥️ ${client.hostname}</h3>
                    <p>IP: ${client.ip}</p>
                    <p>Last seen: ${new Date(client.lastSeen).toLocaleString()}</p>
                </div>
                <span class="status-badge ${client.connected ? 'status-online' : 'status-offline'}">
                    ${client.connected ? 'Online' : 'Offline'}
                </span>
            </div>
            <div class="client-actions">
                <button class="btn btn-danger" onclick="shutdownClient('${client.id}')" 
                        ${!client.connected ? 'disabled' : ''}>
                    🔴 Shutdown
                </button>
                <button class="btn btn-warning" onclick="rebootClient('${client.id}')" 
                        ${!client.connected ? 'disabled' : ''}>
                    🔄 Reboot
                </button>
                <button class="btn btn-success" onclick="cancelClient('${client.id}')" 
                        ${!client.connected ? 'disabled' : ''}>
                    ❌ Cancel
                </button>
                <button class="btn btn-primary" onclick="messageClient('${client.id}')" 
                        ${!client.connected ? 'disabled' : ''}>
                    💬 Message
                </button>
            </div>
        </div>
    `).join('');
}

// Toggle client selection
function toggleClientSelection(clientId) {
    if (selectedClients.has(clientId)) {
        selectedClients.delete(clientId);
    } else {
        selectedClients.add(clientId);
    }
    renderClients();
}

// Power management functions
async function shutdownClient(clientId) {
    const delay = prompt('Enter delay in seconds (0 for immediate):');
    if (delay === null) return;
    
    try {
        const response = await fetch(`/api/shutdown/${clientId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delay: parseInt(delay) || 0 })
        });
        
        const result = await response.json();
        addLog(result.message, response.ok ? 'success' : 'error');
    } catch (error) {
        addLog('Failed to send shutdown command', 'error');
    }
}

async function rebootClient(clientId) {
    const delay = prompt('Enter delay in seconds (0 for immediate):');
    if (delay === null) return;
    
    try {
        const response = await fetch(`/api/reboot/${clientId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delay: parseInt(delay) || 0 })
        });
        
        const result = await response.json();
        addLog(result.message, response.ok ? 'success' : 'error');
    } catch (error) {
        addLog('Failed to send reboot command', 'error');
    }
}

async function cancelClient(clientId) {
    try {
        const response = await fetch(`/api/cancel/${clientId}`, {
            method: 'POST'
        });
        
        const result = await response.json();
        addLog(result.message, response.ok ? 'success' : 'error');
    } catch (error) {
        addLog('Failed to send cancel command', 'error');
    }
}

async function messageClient(clientId) {
    const message = prompt('Enter message to send:');
    if (!message) return;
    
    try {
        const response = await fetch('/api/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: message,
                clientIds: [clientId]
            })
        });
        
        const result = await response.json();
        addLog(result.message, response.ok ? 'success' : 'error');
    } catch (error) {
        addLog('Failed to send message', 'error');
    }
}

// Broadcast functions
broadcastAllBtn.addEventListener('click', async () => {
    const message = broadcastMessageEl.value.trim();
    if (!message) {
        alert('Please enter a message to broadcast');
        return;
    }
    
    try {
        const response = await fetch('/api/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        const result = await response.json();
        addLog(result.message, response.ok ? 'success' : 'error');
        broadcastMessageEl.value = '';
    } catch (error) {
        addLog('Failed to broadcast message', 'error');
    }
});

broadcastSelectedBtn.addEventListener('click', async () => {
    const message = broadcastMessageEl.value.trim();
    if (!message) {
        alert('Please enter a message to broadcast');
        return;
    }
    
    if (selectedClients.size === 0) {
        alert('Please select at least one client');
        return;
    }
    
    try {
        const response = await fetch('/api/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message,
                clientIds: Array.from(selectedClients)
            })
        });
        
        const result = await response.json();
        addLog(result.message, response.ok ? 'success' : 'error');
        broadcastMessageEl.value = '';
    } catch (error) {
        addLog('Failed to broadcast message', 'error');
    }
});

// Clear offline devices function
clearOfflineBtn.addEventListener('click', async () => {
    const offlineCount = clients.filter(c => !c.connected).length;
    
    if (offlineCount === 0) {
        alert('No offline devices to clear');
        return;
    }
    
    const confirmed = confirm(`Are you sure you want to remove ${offlineCount} offline device(s) from the list?`);
    if (!confirmed) return;
    
    try {
        const response = await fetch('/api/clear-offline', {
            method: 'POST'
        });
        
        const result = await response.json();
        addLog(result.message, response.ok ? 'success' : 'error');
        
        if (response.ok) {
            // Remove offline clients from local array and selected clients
            const offlineClientIds = clients.filter(c => !c.connected).map(c => c.id);
            offlineClientIds.forEach(id => selectedClients.delete(id));
            clients = clients.filter(c => c.connected);
            
            updateStats();
            renderClients();
        }
    } catch (error) {
        addLog('Failed to clear offline devices', 'error');
    }
});

// Utility functions
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('p');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    logsEl.appendChild(logEntry);
    logsEl.scrollTop = logsEl.scrollHeight;
    
    // Keep only last 100 log entries
    while (logsEl.children.length > 100) {
        logsEl.removeChild(logsEl.firstChild);
    }
}

// Initialize
loadClients();