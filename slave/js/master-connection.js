// ===== Conexión WebSocket con Master =====

(function() {

const { log } = window.SlaveUtils;

class MasterConnection {
  constructor(clockSync) {
    this.masterWs = null;
    this.clockSync = clockSync;
    this.heartbeatTimer = null;
    this.connectionRetryTimer = null;
    this.retryCount = 0;
    this.maxRetryDelay = 30000;
    this.onSyncCommand = null;
  }

  connect() {
    try {
      const masterUrl = `ws://${window.deviceConfig.masterHost}:${window.deviceConfig.masterPort}`;
      this.masterWs = new WebSocket(masterUrl);
      
      this.masterWs.onopen = () => {
        log('[MASTER] Conectado');
        this.updateConnectionStatus('Connected to Master', true);
        this.retryCount = 0;
        
        this.masterWs.send(JSON.stringify({
          type: 'slave_identify',
          deviceId: window.deviceConfig.deviceId,
          version: '1.0.0',
          capabilities: ['iframe_display', 'navigation'],
          timestamp: new Date().toISOString()
        }));
        this.startHeartbeat();
      };
      
      this.masterWs.onclose = () => {
        this.updateConnectionStatus('Disconnected', false);
        this.clockSync.clockSynced = false;
        this.stopHeartbeat();
        this.clockSync.stopContinuousSync();
        
        const retryDelay = Math.min(
          window.deviceConfig.reconnectDelay * Math.pow(2, this.retryCount),
          this.maxRetryDelay
        );
        
        this.retryCount++;
        
        if (this.retryCount % 5 === 1) {
          log(`[MASTER] Reconectando en ${retryDelay/1000}s`);
        }
        
        this.connectionRetryTimer = setTimeout(() => {
          this.connect();
        }, retryDelay);
      };
      
      this.masterWs.onerror = () => {
        this.updateConnectionStatus('Connection Error', false);
      };
      
      this.masterWs.onmessage = (event) => {
        this.handleMessage(event);
      };
      
    } catch (err) {
      if (this.retryCount % 5 === 0) {
        log(`[MASTER] Error: ${err.message}`);
      }
      
      const retryDelay = Math.min(
        window.deviceConfig.reconnectDelay * Math.pow(2, this.retryCount),
        this.maxRetryDelay
      );
      this.retryCount++;
      
      this.connectionRetryTimer = setTimeout(() => {
        this.connect();
      }, retryDelay);
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.masterWs && this.masterWs.readyState === 1) {
        this.masterWs.send(JSON.stringify({
          type: 'heartbeat',
          deviceId: window.deviceConfig.deviceId,
          timestamp: Date.now()
        }));
      }
    }, window.deviceConfig.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  handleMessage(event) {
    try {
      let rawData;
      if (typeof event.data === 'string') {
        rawData = event.data;
      } else if (event.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          this.processMessageData(reader.result);
        };
        reader.readAsText(event.data);
        return;
      } else {
        rawData = String(event.data);
      }
      
      this.processMessageData(rawData);
    } catch (err) {
      log(`[MASTER] Error procesando mensaje: ${err.message}`);
    }
  }

  processMessageData(rawData) {
    try {
      const message = JSON.parse(rawData);
      
      switch (message.type) {
        case 'identify_confirm':
          log('[MASTER] Identificación confirmada');
          
          if (this.clockSync.syncTimeout) {
            clearTimeout(this.clockSync.syncTimeout);
          }
          
          this.clockSync.performClockSync(message, this.masterWs);
          
          this.clockSync.syncTimeout = setTimeout(() => {
            if (!this.clockSync.clockSynced && message.serverTime) {
              const receivedAt = Date.now();
              this.clockSync.masterTimeOffset = message.serverTime - receivedAt;
              this.clockSync.clockSynced = true;
              this.clockSync.syncPrecision = 50;
              this.clockSync.updateSyncStatus('Timeout ±50ms', true);
              log('[SYNC] Sincronización básica aplicada');
            }
          }, 10000);
          
          setTimeout(() => {
            this.masterWs.send(JSON.stringify({
              type: 'sync_ready',
              deviceId: window.deviceConfig.deviceId,
              timestamp: Date.now()
            }));
          }, 1000);
          break;
          
        case 'show_external_app':
        case 'navigate_iframe':
        case 'play_video':
          log('[MASTER] Comando recibido: ' + message.type);
          if (this.onSyncCommand) {
            this.onSyncCommand(message);
          } else {
            log('[MASTER] Error: onSyncCommand no está definido');
          }
          break;

        case 'time_sync_response':
          this.clockSync.handleSyncResponse(message);
          break;
      }
      
    } catch (err) {
      log(`[MASTER] Error procesando JSON: ${err.message}`);
    }
  }

  updateConnectionStatus(status, connected) {
    document.getElementById('connectionStatus').textContent = status;
    const indicator = document.getElementById('syncIndicator');
    
    if (connected) {
      indicator.classList.add('connected');
    } else {
      indicator.classList.remove('connected');
    }
  }

  reportSyncStart(targetTime, actualTime, timeDiff, precision) {
    if (this.masterWs && this.masterWs.readyState === 1) {
      try {
        this.masterWs.send(JSON.stringify({
          type: 'sync_start_report',
          deviceId: window.deviceConfig.deviceId,
          targetTime: targetTime,
          actualTime: actualTime,
          localTime: Date.now(),
          timeDiff: timeDiff,
          precision: precision,
          clockSynced: this.clockSync.clockSynced,
          syncOffset: this.clockSync.masterTimeOffset,
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        log(`[SYNC] Error reportando: ${err.message}`);
      }
    }
  }
}

window.MasterConnection = MasterConnection;

})();
