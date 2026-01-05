// ===== WebSocket Server para Slaves =====

(function() {
const http = require('http');
const { log } = window.Utils;

let WebSocketServer = null;
try {
  const wsModule = require('/storage/sd/node_modules/ws');
  WebSocketServer = wsModule.Server || wsModule.WebSocketServer;
} catch (err) {
  log(`[ERROR] No se pudo cargar módulo WebSocket: ${err.message}`);
}

let slaveServer = null;
let slaveConnections = new Map();
let slaveSyncStatus = new Map();
let dashboardReporter = null;
let menuAutoShown = false;

function initSlaveServer(config) {
  if (!WebSocketServer) {
    log('[SLAVE-SERVER] WebSocketServer no disponible');
    return;
  }
  
  try {
    const server = http.createServer();
    slaveServer = new WebSocketServer({ server });

    slaveServer.on('connection', (ws, req) => {
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          handleSlaveMessage(ws, message, config);
        } catch (err) {
          log(`[SLAVE-SERVER] Error procesando mensaje: ${err.message}`);
        }
      });

      ws.on('close', () => {
        for (const [deviceId, slaveWs] of slaveConnections.entries()) {
          if (slaveWs === ws) {
            slaveConnections.delete(deviceId);
            // NO eliminar de slaveSyncStatus - solo marcar como no ready
            if (slaveSyncStatus.has(deviceId)) {
              slaveSyncStatus.get(deviceId).ready = false;
            }
            log(`[SLAVE-SERVER] Slave ${deviceId} desconectado`);
            break;
          }
        }
      });

      ws.on('error', (err) => {
        log(`[SLAVE-SERVER] Error en conexión: ${err.message}`);
      });
    });
    
    server.listen(config.master.slaveServerPort, () => {
      log(`[SLAVE-SERVER] Servidor activo en puerto ${config.master.slaveServerPort}`);
    });

  } catch (err) {
    log(`[SLAVE-SERVER] Error inicializando: ${err.message}`);
  }
}

function handleSlaveMessage(ws, message, config) {
  switch (message.type) {
    case 'slave_identify':
      const deviceId = message.deviceId;
      slaveConnections.set(deviceId, ws);
      slaveSyncStatus.set(deviceId, { 
        ready: true, 
        lastPing: Date.now(),
        version: message.version || 'unknown'
      });
      
      const masterTime1 = Date.now();
      const masterTime2 = performance.now();
      ws.send(JSON.stringify({
        type: 'identify_confirm',
        serverTime: masterTime1,
        performanceTime: masterTime2,
        masterDeviceId: 'master-brightsign',
        syncId: Math.random().toString(36).substr(2, 9)
      }));
      break;

    case 'sync_ready':
      if (slaveSyncStatus.has(message.deviceId)) {
        slaveSyncStatus.get(message.deviceId).ready = true;
        slaveSyncStatus.get(message.deviceId).lastPing = Date.now();
        checkAndShowMenuOnFirstSync();
      }
      break;

    case 'heartbeat':
      if (slaveSyncStatus.has(message.deviceId)) {
        slaveSyncStatus.get(message.deviceId).lastPing = Date.now();
      }
      break;

    case 'time_sync_request':
      const requestReceived = Date.now();
      
      const syncResponse = {
        type: 'time_sync_response',
        serverTime: requestReceived,
        syncId: message.syncId || 'unknown'
      };
      
      try {
        ws.send(JSON.stringify(syncResponse));
      } catch (err) {
        log(`[SLAVE-SERVER] Error enviando sync response: ${err.message}`);
      }
      break;
  }
}

function checkAndShowMenuOnFirstSync() {
  if (menuAutoShown) return;
  
  const stats = getReadySlaveCount();
  
  // Solo mostrar menú cuando todos los slaves esperados estén listos
  if (stats.ready > 0 && stats.ready === stats.total) {
    menuAutoShown = true;
    
    const iframe = document.getElementById('externalContent');
    if (iframe && iframe.style.display === 'none') {
      const config = window.Utils?.loadConfig();
      if (config) {
        iframe.src = config.externalApp?.url || '';
        iframe.style.display = 'block';
      }
    }
    
    broadcastToSlaves({
      type: 'show_external_app',
      masterTime: Date.now()
    });
  }
}

function broadcastToSlaves(message) {
  if (!slaveServer) return 0;
  
  let successCount = 0;

  for (const [deviceId, ws] of slaveConnections.entries()) {
    if (ws.readyState === 1) {
      try {
        ws.send(JSON.stringify(message));
        successCount++;
      } catch (err) {
        log(`[SLAVE-SERVER] Error enviando a ${deviceId}: ${err.message}`);
      }
    }
  }
  
  if (dashboardReporter) {
    dashboardReporter(successCount, slaveConnections.size, slaveSyncStatus, slaveConnections);
  }
  
  return successCount;
}

function getReadySlaveCount() {
  let readyCount = 0;
  const now = Date.now();
  
  // Contar slaves ready (sincronizados y con heartbeat reciente)
  for (const [deviceId, status] of slaveSyncStatus.entries()) {
    if (status.ready && (now - status.lastPing) < 10000) {
      readyCount++;
    }
  }
  
  // Total viene de la configuración
  const config = window.Utils?.loadConfig();
  const totalCount = config?.master?.expectedSlaves || 0;
  
  return { ready: readyCount, total: totalCount };
}

function getSlaveDetails() {
  const now = Date.now();
  const slaves = [];
  const processedIds = new Set();
  
  // Primero procesar slaves con status
  for (const [deviceId, status] of slaveSyncStatus.entries()) {
    processedIds.add(deviceId);
    const isConnected = slaveConnections.has(deviceId);
    const isReady = status.ready && (now - status.lastPing) < 10000;
    
    slaves.push({
      deviceId: deviceId,
      connected: isConnected,
      ready: isReady,
      lastPing: status.lastPing,
      timeSinceLastPing: now - status.lastPing
    });
  }
  
  // Agregar slaves conectados sin status aún
  for (const deviceId of slaveConnections.keys()) {
    if (!processedIds.has(deviceId)) {
      slaves.push({
        deviceId: deviceId,
        connected: true,
        ready: false,
        lastPing: now,
        timeSinceLastPing: 0
      });
    }
  }
  
  return slaves;
}

function setDashboardReporter(reporterFunction) {
  dashboardReporter = reporterFunction;
}

window.SlaveServer = {
  initSlaveServer,
  broadcastToSlaves,
  getReadySlaveCount,
  getSlaveDetails,
  setDashboardReporter
};

})(); 
