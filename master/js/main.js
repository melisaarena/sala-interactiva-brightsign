/**
 * Main Entry Point for Master BrightSign
 * Master-Slave architecture with local WebSocket server
 */
(function() {

const { log, loadConfig } = window.Utils;
const { init: initRemoteControl } = window.RemoteControl;
const { initSlaveServer, broadcastNavigation, broadcastVideoPlay, getCurrentState } = window.SlaveServer;

let currentState = null; // Estado actual de navegación

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSystem);
} else {
  initSystem();
}

async function initSystem() {
  try {
    log('[MAIN] 🚀 Iniciando sistema Master');

    const config = loadConfig();
    if (!config) {
      log('[ERROR] No se pudo cargar la configuración');
      return;
    }

    // 1. Iniciar reloj
    if (window.Clock && window.Clock.init) {
      window.Clock.init();
      log('[MAIN] ⏰ Reloj inicializado');
    }

    // 2. Iniciar servidor WebSocket para slaves
    log('[MAIN] 📡 Iniciando servidor WebSocket para slaves...');
    initSlaveServer(config);
    
    // 3. Configurar actualización de lista de slaves
    if (window.SlaveServer && window.SlaveServer.setDashboardReporter) {
      window.SlaveServer.setDashboardReporter(updateSlaveList);
      log('[MAIN] 📊 Reporter de slaves configurado');
    }
    
    // 4. Iniciar control remoto
    log('[MAIN] 🎮 Iniciando control remoto...');
    const remoteInitialized = initRemoteControl();
    if (!remoteInitialized) {
      log('[MAIN] ⚠️ Control remoto no pudo inicializarse');
    }
    
    // 5. Configurar estado inicial
    currentState = {
      floorId: 'piso-1',
      itemId: 'item-1',
      lastUpdate: Date.now()
    };
    log('[MAIN] 📍 Estado inicial:', JSON.stringify(currentState));
    
    // 6. Esperar 2 segundos para que slaves se conecten
    setTimeout(() => {
      // 7. Broadcast estado inicial
      log('[MAIN] 📤 Enviando estado inicial a todos...');
      broadcastNavigation({
        state: currentState,
        direction: null
      });
      
      // 8. Cargar React app en iframe
      loadExternalApp(config);
    }, 2000);
    
    // 9. Escuchar mensajes del iframe (React app)
    window.addEventListener('message', handleIframeMessage);

    log('[MAIN] ✅ Sistema Master inicializado');

  } catch (err) {
    log('[ERROR] initSystem: ' + err.message);
  }
}

/**
 * Manejar mensajes del iframe (React app)
 */
function handleIframeMessage(event) {
  // Validar origen si es necesario
  // if (event.origin !== expectedOrigin) return;
  
  const message = event.data;
  
  if (!message || !message.type) return;
  
  log('[MAIN] 📨 Mensaje del iframe:', message.type);
  
  switch (message.type) {
    case 'request_video_play':
      // React app solicita reproducir un video
      log('[MAIN] 🎬 Solicitud de reproducción de video');
      broadcastVideoPlay({
        state: message.videoData.state || currentState,
        videoUrl: message.videoData.videoUrl,
        duration: message.videoData.duration || 0
      });
      break;
      
    case 'navigation_complete':
      // React app confirma navegación completada
      if (message.state) {
        currentState = message.state;
        log('[MAIN] 📍 Estado actualizado:', JSON.stringify(currentState));
      }
      break;
      
    default:
      // Ignorar otros tipos de mensajes
      break;
  }
}

/**
 * Cargar app externa (React) en iframe
 */
function loadExternalApp(config) {
  const iframe = document.getElementById('externalContent');
  if (!iframe) {
    log('[ERROR] iframe externalContent no encontrado');
    return;
  }

  const appUrl = config.externalApp?.url || 'http://192.168.1.14:5173';
  const projectorIndex = config.projector?.index || 1;
  
  // Build URL with projector parameter
  const fullUrl = `${appUrl}/brightsign/display?projectorIndex=${projectorIndex}`;
  
  log('[MAIN] 📺 Cargando app externa:', fullUrl);
  iframe.src = fullUrl;
  
  // Hide ready overlay and show iframe
  const readyOverlay = document.getElementById('readyOverlay');
  if (readyOverlay) {
    readyOverlay.style.display = 'none';
  }
  
  iframe.style.display = 'block';
}

/**
 * Actualizar lista de slaves conectados en UI
 */
function updateSlaveList(readyCount, connectedCount, slaveSyncStatus, slaveConnections) {
  const slaveCountElement = document.getElementById('slaveCount');
  const slaveListElement = document.getElementById('slaveList');
  
  if (slaveCountElement) {
    const config = loadConfig();
    const totalCount = config?.master?.expectedSlaves || connectedCount || 0;
    slaveCountElement.textContent = `${readyCount} / ${totalCount}`;
  }
  
  if (slaveListElement && slaveSyncStatus) {
    slaveListElement.innerHTML = '';
    
    for (const [deviceId, status] of slaveSyncStatus.entries()) {
      const slaveItem = document.createElement('div');
      slaveItem.className = 'slave-item';
      
      const statusIcon = status.ready ? '✅' : '⏳';
      const clockDiff = status.clockDiff !== undefined ? `${status.clockDiff}ms` : '---';
      
      slaveItem.innerHTML = `
        <span class="slave-id">${statusIcon} ${deviceId}</span>
        <span class="slave-clock">Clock: ${clockDiff}</span>
      `;
      
      slaveListElement.appendChild(slaveItem);
    }
  }
}

/**
 * Actualizar estado de conexión en UI (opcional)
 */
function updateConnectionStatus(isConnected) {
  // Status overlay está oculto por defecto
  // Descomentar si quieres mostrar status
  /*
  const statusElement = document.getElementById('connectionStatus');
  if (statusElement) {
    statusElement.textContent = isConnected ? 'Conectado' : 'Desconectado';
    statusElement.className = isConnected ? 'connected' : 'disconnected';
  }
  */
  
  const projectorElement = document.getElementById('projectorIndex');
  if (projectorElement) {
    const config = loadConfig();
    projectorElement.textContent = config.projector?.index || '?';
  }
}

// Hacer funciones disponibles globalmente si es necesario
window.MasterMain = {
  getCurrentState: () => currentState,
  broadcastNavigation,
  broadcastVideoPlay
};

log('[MAIN] 📄 main.js cargado');

})();
