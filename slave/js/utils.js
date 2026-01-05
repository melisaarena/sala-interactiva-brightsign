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
    
    if (!configData.slave) {
      throw new Error('No se encontró configuración de slave');
    }
    
    const deviceConfig = configData.slave;
    
    // Aplicar configuración de verbose logging si está presente
    if (deviceConfig.verboseLogging !== undefined) {
      setVerboseLogging(deviceConfig.verboseLogging);
      log(`[CONFIG] Verbose logging: ${deviceConfig.verboseLogging ? 'ACTIVADO' : 'DESACTIVADO'}`);
    }
    
    deviceConfig.reconnectDelay = deviceConfig.reconnectDelay || 3000;
    deviceConfig.heartbeatInterval = deviceConfig.heartbeatInterval || 10000;
    
    const requiredFields = ['deviceId', 'masterHost', 'masterPort'];
    const missingFields = requiredFields.filter(field => !deviceConfig[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Faltan campos: ${missingFields.join(', ')}`);
    }
    
    // Agregar externalApp al deviceConfig
    if (configData.externalApp) {
      deviceConfig.externalApp = configData.externalApp;
      log(`[CONFIG] URL externa configurada: ${deviceConfig.externalApp.url}`);
    } else {
      log('[CONFIG] Advertencia: No se encontró configuración de externalApp');
    }
    
    return deviceConfig;
  } catch (err) {
    log(`[CONFIG] Error: ${err.message}`);
    throw err;
  }
}

window.SlaveUtils = {
  log,
  loadConfig,
  setVerboseLogging,
  stamp
};

})();
