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
          navigateIframe(message.keyCode, message.exactStartTime, message.menuState);
          break;
        case 'play_video':
          playVideo(message.floorId, message.itemId, message.exactStartTime);
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

function navigateIframe(keyCode, exactStartTime, menuState) {
  try {
    const iframe = document.getElementById('externalContent');
    if (!iframe?.contentWindow) return;

    const message = {
      type: 'keydown',
      keyCode: keyCode,
      exactStartTime: exactStartTime,
      menuState: menuState
    };

    iframe.contentWindow.postMessage(message, '*');
    log('[SLAVE] Enviando mensaje al iframe: ' + JSON.stringify(message));
  } catch (err) {
    log('[SLAVE] Error navigateIframe: ' + err.message);
  }
}

function playVideo(floorId, itemId, exactStartTime) {
  try {
    const iframe = document.getElementById('externalContent');
    if (!iframe?.contentWindow) return;

    const message = {
      type: 'play_video',
      floorId: floorId,
      itemId: itemId,
      exactStartTime: exactStartTime
    };
    iframe.contentWindow.postMessage(message, '*');
    log('[SLAVE] Enviando mensaje al iframe: ' + JSON.stringify(message));
  } catch (err) {
    log('[SLAVE] Error playVideo: ' + err.message);
  }
}

window.onerror = function(message, source, lineno) {
  log(`[ERROR] ${message} en ${source}:${lineno}`);
  return true;
};

})();
