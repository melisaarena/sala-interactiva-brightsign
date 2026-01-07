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
let currentState = null; // Estado actual de navegación

// Buffers para sincronización (en milisegundos)
const NAVIGATION_BUFFER_MS = 150;
const VIDEO_BUFFER_MS = 500;

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
    
    // Usar nueva estructura de config
    const port = config.websocket?.port || 8765;
    server.listen(port, () => {
      log(`[SLAVE-SERVER] Servidor activo en puerto ${port}`);
    });
    
    // Inicializar estado inicial
    currentState = {
      floorId: 'piso-1',
      itemId: 'item-1',
      lastUpdate: Date.now()
    };
    log('[SLAVE-SERVER] Estado inicial:', JSON.stringify(currentState));

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
        ready: false, // Will be set to true on sync_ready
        lastPing: Date.now(),
        version: message.version || 'unknown',
        clockDiff: 0
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
      
      log(`[SLAVE-SERVER] 🔌 Slave ${deviceId} identificado`);
      break;

    case 'sync_ready':
      if (slaveSyncStatus.has(message.deviceId)) {
        const status = slaveSyncStatus.get(message.deviceId);
        status.ready = true;
        status.lastPing = Date.now();
        
        // Calculate and store clock diff
        const clockDiff = message.timestamp ? Date.now() - message.timestamp : 0;
        status.clockDiff = clockDiff;
        
        // Send sync confirmation back to slave with clock diff
        ws.send(JSON.stringify({
          type: 'sync_confirm',
          deviceId: message.deviceId,
          clockDiff: clockDiff,
          roundTrip: Math.abs(clockDiff) * 2,
          timestamp: Date.now()
        }));
        
        log(`[SLAVE-SERVER] ✅ Slave ${message.deviceId} ready (clockDiff: ${clockDiff}ms)`);
        
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

/**
 * Enviar navegación sincronizada a todos los slaves
 */
function broadcastNavigation(navigationData) {
  const timestamp = Date.now() + NAVIGATION_BUFFER_MS;
  
  // Actualizar estado actual
  if (navigationData.state) {
    currentState = {
      ...navigationData.state,
      lastUpdate: Date.now()
    };
  }
  
  const message = {
    type: 'synchronized_navigation',
    timestamp: timestamp,
    state: navigationData.state,
    direction: navigationData.direction
  };
  
  log('[SLAVE-SERVER] 📤 Broadcasting navigation:', JSON.stringify(message.state));
  
  // Broadcast a todos los slaves
  const sent = broadcastToSlaves(message);
  
  // También enviar al iframe del Master
  sendToMasterIframe(message);
  
  return sent;
}

/**
 * Enviar reproducción de video sincronizada
 */
function broadcastVideoPlay(videoData) {
  const timestamp = Date.now() + VIDEO_BUFFER_MS;
  
  const message = {
    type: 'synchronized_video_play',
    timestamp: timestamp,
    state: videoData.state,
    videoUrl: videoData.videoUrl,
    duration: videoData.duration
  };
  
  log('[SLAVE-SERVER] 🎬 Broadcasting video play:', videoData.videoUrl);
  
  // Broadcast a todos los slaves
  const sent = broadcastToSlaves(message);
  
  // También enviar al iframe del Master
  sendToMasterIframe(message);
  
  return sent;
}

/**
 * Enviar mensaje al iframe del Master vía postMessage
 */
function sendToMasterIframe(message) {
  try {
    const iframe = document.getElementById('externalContent');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(message, '*');
    }
  } catch (err) {
    log(`[SLAVE-SERVER] Error enviando a Master iframe: ${err.message}`);
  }
}

/**
 * Obtener estado actual
 */
function getCurrentState() {
  return currentState;
}

window.SlaveServer = {
  initSlaveServer,
  broadcastToSlaves,
  broadcastNavigation,
  broadcastVideoPlay,
  getCurrentState,
  getReadySlaveCount,
  getSlaveDetails,
  setDashboardReporter
};

})(); 
