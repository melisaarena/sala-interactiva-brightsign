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
let cachedConfig = null; // Cache de configuración
let cachedMenu = null; // Cache de menú

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

// Cargar configuración (con caché)
function loadConfig(forceReload = false) {
  // Si ya está cacheada y no se fuerza recarga, devolver el cache
  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  let config = {
    master: { 
      slaveServerPort: 8081,
      syncDelayMs: 2000,
      maxSyncAttempts: 3,
      verboseLogging: true
    },
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

  // Guardar en cache
  cachedConfig = config;
  return config;
}

// Cargar estructura del menú (con caché)
function loadMenu(forceReload = false) {
  // Si ya está cacheada y no se fuerza recarga, devolver el cache
  if (cachedMenu && !forceReload) {
    return cachedMenu;
  }

  let menuStructure = null;
  
  try {
    const menuPath = path.join('/storage/sd', 'menu.json');
    const menuData = fs.readFileSync(menuPath, 'utf8');
    menuStructure = JSON.parse(menuData);
    log(`[MENU] Menú cargado - ${menuStructure.sections?.length || 0} secciones`);
  } catch (err) {
    log(`[MENU] Error cargando menu.json: ${err.message}`);
  }

  // Guardar en cache
  cachedMenu = menuStructure;
  return menuStructure;
}

// Exponer funciones globalmente para que otros scripts puedan usarlas
window.Utils = {
  log,
  loadConfig,
  loadMenu,
  setVerboseLogging
};
