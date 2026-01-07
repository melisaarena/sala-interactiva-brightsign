// ===== Utilidades y Configuración del Slave =====

(function() {

const fs = require('fs');
const path = require('path');
const processObj = require('process');

try {
  processObj.chdir('/storage/sd');
} catch {}

let logInitialized = false;
let verboseLogging = false; // Por defecto desactivado

function stamp() {
  return new Date().toISOString();
}

function setVerboseLogging(enabled) {
  verboseLogging = enabled;
}

function log(line, { verbose = false } = {}) {
  // Si es verbose y verbose logging está desactivado, no loguear
  if (verbose && !verboseLogging) return;
  
  console.log(line);
  
  try {
    const dir = '/storage/sd/log';
    const f = path.join(dir, 'text.log');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const ts = stamp();
    const entry = `[${ts}] ${line}\n`;

    if (!logInitialized) {
      fs.writeFile(f, entry, 'utf8', () => {});
      logInitialized = true;
    } else {
      fs.appendFile(f, entry, 'utf8', () => {});
    }
  } catch (err) {
    console.error('Error escribiendo log:', err);
  }
}

function loadConfig() {
  try {
    const configPath = path.join('/storage/sd', 'config.json');
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Nueva estructura con "projector", "websocket", "externalApp"
    if (!configData.projector) {
      throw new Error('No se encontró configuración de projector');
    }
    
    // Validar campos requeridos
    const requiredFields = ['index'];
    const missingFields = requiredFields.filter(field => !configData.projector[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Faltan campos en projector: ${missingFields.join(', ')}`);
    }
    
    // Validar WebSocket (diferente para Master vs Slave)
    if (!configData.websocket) {
      throw new Error('No se encontró configuración de websocket');
    }
    
    // Master debe tener 'port' y role="server"
    // Slave debe tener 'masterHost' y role="client"
    const wsConfig = configData.websocket;
    if (wsConfig.role === 'server' && !wsConfig.port) {
      throw new Error('Master requiere websocket.port en configuración');
    }
    if (wsConfig.role === 'client' && !wsConfig.masterHost) {
      throw new Error('Slave requiere websocket.masterHost en configuración');
    }
    
    // Validar externalApp
    if (!configData.externalApp || !configData.externalApp.url) {
      throw new Error('No se encontró configuración de externalApp.url');
    }
    
    log(`[CONFIG] ✅ Configuración cargada:`);
    log(`[CONFIG]    Proyector: ${configData.projector.index} - ${configData.projector.name || 'Sin nombre'}`);
    if (wsConfig.role === 'server') {
      log(`[CONFIG]    WebSocket: Server en puerto ${wsConfig.port}`);
    } else {
      log(`[CONFIG]    WebSocket: Client conectando a ${wsConfig.masterHost}:${wsConfig.masterPort || 8765}`);
    }
    log(`[CONFIG]    App externa: ${configData.externalApp.url}`);
    
    return configData;
  } catch (err) {
    log(`[CONFIG] ❌ Error: ${err.message}`);
    throw err;
  }
}

window.Utils = {
  log,
  loadConfig,
  setVerboseLogging,
  stamp
};

})();
