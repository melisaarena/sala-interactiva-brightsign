/**
 * Main Entry Point for Slave BrightSign
 * Connects to Master BrightSign WebSocket server
 */
(function() {

const { log, loadConfig } = window.Utils;

let masterConnection = null;

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSystem);
} else {
  initSystem();
}

async function initSystem() {
  try {
    log('[MAIN] 🚀 Iniciando sistema Slave');

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

    // 2. Crear conexión con el Master
    log('[MAIN] 📡 Conectando al Master...');
    masterConnection = new window.MasterConnection(config);
    
    // 3. Configurar callback para actualización de estado
    if (masterConnection.setStatusUpdateCallback) {
      masterConnection.setStatusUpdateCallback(updateConnectionStatus);
    }
    
    // 4. Conectar al Master
    masterConnection.connect();
    
    // 5. Esperar 2 segundos para sincronización inicial
    setTimeout(() => {
      // 6. Cargar React app en iframe
      loadExternalApp(config);
    }, 2000);
    
    // 7. Escuchar mensajes del iframe (React app)
    window.addEventListener('message', handleIframeMessage);

    log('[MAIN] ✅ Sistema Slave inicializado');

  } catch (err) {
    log('[ERROR] initSystem: ' + err.message);
  }
}

/**
 * Manejar mensajes del iframe (React app)
 */
function handleIframeMessage(event) {
  const message = event.data;
  
  if (!message || !message.type) return;
  
  log('[MAIN] 📨 Mensaje del iframe:', message.type);
  
  // Los slaves generalmente solo reciben, no envían
  // Pero pueden reportar al Master si es necesario
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
  const projectorIndex = config.projector?.index || 2;
  
  // Build URL with projector parameter
  const fullUrl = `${appUrl}/brightsign/display?projectorIndex=${projectorIndex}`;
  
  log('[MAIN] 📺 Cargando app externa:', fullUrl);
  iframe.src = fullUrl;
  
  // Hide waiting overlay and show iframe
  const waitingOverlay = document.getElementById('waitingOverlay');
  if (waitingOverlay) {
    waitingOverlay.style.display = 'none';
  }
  
  iframe.style.display = 'block';
}

/**
 * Actualizar estado de conexión en UI
 */
function updateConnectionStatus(status) {
  const connectionStatusElement = document.getElementById('connectionStatus');
  const syncIndicatorElement = document.getElementById('syncIndicator');
  const clockSyncElement = document.getElementById('clockSync');
  const networkDelayElement = document.getElementById('networkDelay');
  const syncQualityElement = document.getElementById('syncQuality');
  
  if (connectionStatusElement) {
    if (status.connected) {
      connectionStatusElement.textContent = 'Connected';
      connectionStatusElement.className = 'status-connected';
    } else {
      connectionStatusElement.textContent = 'Connecting...';
      connectionStatusElement.className = 'status-disconnected';
    }
  }
  
  if (syncIndicatorElement) {
    syncIndicatorElement.className = status.connected ? 'sync-indicator connected' : 'sync-indicator';
  }
  
  if (clockSyncElement && status.clockSync !== undefined) {
    const clockDiff = Math.round(status.clockSync);
    clockSyncElement.textContent = `${clockDiff}ms`;
    clockSyncElement.className = Math.abs(clockDiff) < 50 ? 'sync-good' : 'sync-warning';
  }
  
  if (networkDelayElement && status.networkDelay !== undefined) {
    networkDelayElement.textContent = `${Math.round(status.networkDelay)}ms`;
  }
  
  if (syncQualityElement && status.syncQuality) {
    syncQualityElement.textContent = status.syncQuality;
    syncQualityElement.className = `quality-${status.syncQuality.toLowerCase()}`;
  }
}

log('[MAIN] 📄 main.js cargado');

})();
