// ===== Utilidades y Configuración =====
const fs = require('fs');
const path = require('path');
const processObj = require('process');

// Cambiar al directorio de trabajo
try {
  processObj.chdir('/storage/sd');
} catch {}

let logInitialized = false;
let verboseLogging = false; // Por defecto desactivado

// Función para configurar el logging verboso
function setVerboseLogging(enabled) {
  verboseLogging = enabled;
}

// Función de logging
function log(line, { verbose = false } = {}) {
  // Si es verbose y verbose logging está desactivado, no loguear
  if (verbose && !verboseLogging) return;
  
  console.log(line);
  
  try {
    const dir = '/storage/sd/log';
    const f = path.join(dir, 'text.log');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const ts = (typeof stamp === 'function') ? stamp() : new Date().toISOString();
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

// Cargar configuración
function loadConfig() {
  let config = {
    master: { 
      slaveServerPort: 8081,
      syncDelayMs: 2000,
      maxSyncAttempts: 3,
      verboseLogging: true
    },
    media: {
      videoPath: 'video.mp4'
    }
  };
  
  try {
    const configPath = path.join('/storage/sd', 'config.json');
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config = { ...config, ...configData };
    
    // Configurar el logging verboso globalmente
    if (config.master && typeof config.master.verboseLogging !== 'undefined') {
      setVerboseLogging(config.master.verboseLogging);
      log(`[CONFIG] Verbose logging: ${config.master.verboseLogging ? 'ACTIVADO' : 'DESACTIVADO'}`);
    }
    
    log('[CONFIG] Configuración cargada');
  } catch (err) {
    log(`[CONFIG] Usando configuración por defecto: ${err.message}`);
  }

  return config;
}

// Exponer funciones globalmente para que otros scripts puedan usarlas
window.Utils = {
  log,
  loadConfig,
  setVerboseLogging
};
