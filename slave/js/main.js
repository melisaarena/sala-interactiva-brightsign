// ===== Coordinador Principal =====

(function() {

const { log, loadConfig } = window.SlaveUtils;

let clockSync, masterConnection, clock;

window.onload = function() {
  try {
    log('[MAIN] Slave device iniciando');
    
    window.deviceConfig = loadConfig();
    
    const deviceIdElement = document.getElementById('deviceId');
    if (deviceIdElement) {
      deviceIdElement.textContent = window.deviceConfig.deviceId;
    }
    
    clockSync = new window.ClockSync();
    masterConnection = new window.MasterConnection(clockSync);
    masterConnection.connect();
    
    masterConnection.onSyncCommand = (message) => {
      switch (message.type) {
        case 'show_external_app':
          showExternalApp();
          break;
        case 'navigate_iframe':
          navigateIframe(message.keyCode, message.exactStartTime, message.masterTime, message.bufferMs, message.menuState);
          break;
      }
    };
    
    clock = new window.SlaveClock(clockSync);
    clock.start();
    
    log('[MAIN] Slave device iniciado');
    
  } catch (err) {
    log(`[MAIN] Error fatal: ${err.message}`);
  }
};

function showExternalApp() {
  try {
    const iframe = document.getElementById('externalContent');
    if (!iframe) return;

    const config = window.deviceConfig;
    const baseUrl = config.externalApp?.baseUrl || 'http://localhost:3000';
    const projectorIndex = config.externalApp?.projectorIndex || 0;
    const targetUrl = `${baseUrl}/#/brightsign/display?projectorIndex=${projectorIndex}`;
    
    iframe.src = targetUrl;
    iframe.style.display = 'block';
    log('[SLAVE] ✓ Iframe visible con URL: ' + targetUrl);
  } catch (err) {
    log('[SLAVE] Error showExternalApp: ' + err.message);
  }
}

function navigateIframe(keyCode, exactStartTime, masterTime, bufferMs, menuState) {
  try {
    const iframe = document.getElementById('externalContent');
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage({
      type: 'keydown',
      keyCode: keyCode,
      exactStartTime: exactStartTime,
      menuState: menuState // Reenviar el estado del menú
    }, '*');
  } catch (err) {
    log('[SLAVE] Error navigateIframe: ' + err.message);
  }
}

window.onerror = function(message, source, lineno) {
  log(`[ERROR] ${message} en ${source}:${lineno}`);
  return true;
};

})();
