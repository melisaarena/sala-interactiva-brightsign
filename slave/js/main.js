// ===== Coordinador Principal =====

(function() {

const { log, loadConfig } = window.SlaveUtils;

let clockSync, masterConnection, player, clock;

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
    
    player = new window.SlavePlayer(clockSync, masterConnection);
    player.init();
    
    masterConnection.onSyncCommand = (message) => {
      switch (message.type) {
        case 'sync_exact_start':
        case 'sync_prepare':
          player.scheduleExactPlayback(message);
          break;
        case 'sync_stop':
          player.handleSyncStop();
          break;
        case 'sync_pause':
          player.handleSyncPause();
          break;
        case 'show_external_app':
          showExternalApp();
          break;
        case 'hide_external_app':
          hideExternalApp();
          break;
        case 'show_menu_only':
          showMenuOnly();
          break;
        case 'navigate_iframe':
          navigateIframe(message.keyCode);
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
    const targetUrl = config.externalApp?.url || '';
    
    iframe.src = targetUrl;
    iframe.style.display = 'block';
    
    const video = document.getElementById('player');
    if (video && !video.paused) {
      video.pause();
    }
  } catch (err) {
    log('[SLAVE] Error showExternalApp: ' + err.message);
  }
}

function hideExternalApp() {
  try {
    const iframe = document.getElementById('externalContent');
    if (iframe && iframe.style.display !== 'none') {
      iframe.style.display = 'none';
    }
  } catch (err) {
    log('[SLAVE] Error hideExternalApp: ' + err.message);
  }
}

function showMenuOnly() {
  try {
    const iframe = document.getElementById('externalContent');
    if (!iframe) return;

    iframe.style.display = 'block';
  } catch (err) {
    log('[SLAVE] Error showMenuOnly: ' + err.message);
  }
}

function navigateIframe(keyCode) {
  try {
    const iframe = document.getElementById('externalContent');
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage({
      type: 'keydown',
      keyCode: keyCode
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
