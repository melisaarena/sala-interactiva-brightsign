// ===== Main Entry Point =====

(function() {

const { log, loadConfig } = window.Utils;
const { initSlaveServer, getReadySlaveCount, getSlaveDetails } = window.SlaveServer;
const { initRemoteControl } = window.RemoteControl;
const { initClock } = window.Clock;

function updateSlaveUI() {
  const stats = getReadySlaveCount();
  const slaves = getSlaveDetails();
  
  const slaveCountElement = document.getElementById('slaveCount');
  const slaveListElement = document.getElementById('slaveList');
  
  if (slaveCountElement) {
    slaveCountElement.textContent = `${stats.ready} / ${stats.total}`;
  }
  
  if (slaveListElement) {
    slaveListElement.innerHTML = '';
    
    if (slaves.length === 0) {
      slaveListElement.innerHTML = '<div style="text-align: center; color: #999; padding: 10px;">No hay slaves conectados</div>';
    } else {
      slaves.forEach(slave => {
        const item = document.createElement('div');
        item.className = 'slave-item';
        if (slave.ready) {
          item.classList.add('ready');
        } else if (!slave.connected) {
          item.classList.add('disconnected');
        }
        
        const name = document.createElement('span');
        name.className = 'slave-name';
        name.textContent = slave.deviceId;
        
        const status = document.createElement('span');
        status.className = 'slave-status';
        if (slave.ready) {
          status.textContent = 'Ready';
        } else if (slave.connected) {
          status.textContent = 'Connected';
        } else {
          status.textContent = 'Disconnected';
          status.classList.add('disconnected');
        }
        
        item.appendChild(name);
        item.appendChild(status);
        slaveListElement.appendChild(item);
      });
    }
  }
}

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSystem);
} else {
  initSystem();
}

async function initSystem() {
  try {
    log('[MAIN] Iniciando sistema');

    const config = loadConfig();

    // Inicializar control remoto USB
    initRemoteControl();

    try {
      initSlaveServer(config); 
    } catch (err) {
      log(`[ERROR] initSlaveServer: ${err.message}`);
    }

    initClock();

    // Actualizar UI de slaves cada 2 segundos
    setInterval(updateSlaveUI, 2000);
    updateSlaveUI(); // Actualización inicial

    log('[MAIN] Sistema inicializado');

  } catch (err) {
    log(`[ERROR] ${err && err.message ? err.message : String(err)}`);
    console.error(err);
  }
}

})();