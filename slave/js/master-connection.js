// ===== Conexión WebSocket con Master =====

(function() {

const { log } = window.Utils;

class MasterConnection {
  constructor(config) {
    this.masterWs = null;
    this.config = config;
    this.heartbeatTimer = null;
    this.connectionRetryTimer = null;
    this.retryCount = 0;
    this.maxRetryDelay = 30000;
    this.reconnectDelay = 3000;
    this.onMessageReceived = null; // Callback para mensajes
    this.statusUpdateCallback = null; // Callback para actualizar UI
    this.currentStatus = {
      connected: false,
      clockSync: 0,
      networkDelay: 0,
      syncQuality: 'Unknown'
    };
  }
  
  /**
   * Configurar callback para actualizar UI
   */
  setStatusUpdateCallback(callback) {
    this.statusUpdateCallback = callback;
  }

  connect() {
    try {
      const masterHost = this.config.websocket?.masterHost || '192.168.1.250';
      const masterPort = this.config.websocket?.masterPort || 8765;
      const masterUrl = `ws://${masterHost}:${masterPort}`;
      
      log(`[MASTER-CONN] Conectando a ${masterUrl}...`);
      this.masterWs = new WebSocket(masterUrl);
      
      this.masterWs.onopen = () => {
        log('[MASTER-CONN] ✅ Conectado');
        this.updateConnectionStatus('Conectado', true);
        this.retryCount = 0;
        
        // Identificarse con el Master
        const deviceId = this.config.projector?.name || `slave-${this.config.projector?.index}`;
        this.masterWs.send(JSON.stringify({
          type: 'slave_identify',
          deviceId: deviceId,
          projectorIndex: this.config.projector?.index,
          version: '2.0.0',
          timestamp: Date.now()
        }));
        
        this.startHeartbeat();
      };
      
      this.masterWs.onclose = () => {
        log('[MASTER-CONN] ❌ Desconectado');
        this.updateConnectionStatus('Desconectado', false);
        this.stopHeartbeat();
        
        const retryDelay = Math.min(
          this.reconnectDelay * Math.pow(2, this.retryCount),
          this.maxRetryDelay
        );
        
        this.retryCount++;
        
        if (this.retryCount % 5 === 1) {
          log(`[MASTER-CONN] Reconectando en ${retryDelay/1000}s`);
        }
        
        this.connectionRetryTimer = setTimeout(() => {
          this.connect();
        }, retryDelay);
      };
      
      this.masterWs.onerror = (err) => {
        log('[MASTER-CONN] ⚠️ Error de conexión');
        this.updateConnectionStatus('Error', false);
      };
      
      this.masterWs.onmessage = (event) => {
        this.handleMessage(event);
      };
      
    } catch (err) {
      if (this.retryCount % 5 === 0) {
        log(`[MASTER-CONN] Error: ${err.message}`);
      }
      
      const retryDelay = Math.min(
        this.reconnectDelay * Math.pow(2, this.retryCount),
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
        const deviceId = this.config.projector?.name || `slave-${this.config.projector?.index}`;
        this.masterWs.send(JSON.stringify({
          type: 'heartbeat',
          deviceId: deviceId,
          timestamp: Date.now()
        }));
      }
    }, 5000); // Heartbeat cada 5 segundos
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
      
      log(`[MASTER-CONN] 📨 Mensaje: ${message.type}`);
      
      switch (message.type) {
        case 'identify_confirm':
          log('[MASTER-CONN] ✅ Identificación confirmada');
          // Notificar que estamos listos
          const deviceId = this.config.projector?.name || `slave-${this.config.projector?.index}`;
          setTimeout(() => {
            this.masterWs.send(JSON.stringify({
              type: 'sync_ready',
              deviceId: deviceId,
              timestamp: Date.now()
            }));
          }, 500);
          break;
        
        case 'sync_confirm':
          log('[MASTER-CONN] 🔄 Sincronización confirmada');
          if (message.clockDiff !== undefined) {
            this.currentStatus.clockSync = message.clockDiff;
            this.currentStatus.networkDelay = message.roundTrip || 0;
            
            // Calculate sync quality
            const absClockDiff = Math.abs(message.clockDiff);
            if (absClockDiff < 20) {
              this.currentStatus.syncQuality = 'Excellent';
            } else if (absClockDiff < 50) {
              this.currentStatus.syncQuality = 'Good';
            } else if (absClockDiff < 100) {
              this.currentStatus.syncQuality = 'Fair';
            } else {
              this.currentStatus.syncQuality = 'Poor';
            }
            
            // Update UI
            if (this.statusUpdateCallback) {
              this.statusUpdateCallback(this.currentStatus);
            }
          }
          break;
          
        case 'synchronized_navigation':
          log('[MASTER-CONN] 🗺️ Navegación sincronizada recibida');
          this.sendToIframe(message);
          break;
          
        case 'synchronized_video_play':
          log('[MASTER-CONN] 🎬 Reproducción de video sincronizada');
          this.sendToIframe(message);
          break;
          
        case 'show_external_app':
          log('[MASTER-CONN] 📺 Mostrar app externa');
          this.showIframe();
          break;
          
        case 'hide_external_app':
          log('[MASTER-CONN] 📺 Ocultar app externa');
          this.hideIframe();
          break;
          
        default:
          // Pasar mensaje al callback si está definido
          if (this.onMessageReceived) {
            this.onMessageReceived(message);
          }
          break;
      }
      
    } catch (err) {
      log(`[MASTER-CONN] Error procesando JSON: ${err.message}`);
    }
  }

  /**
   * Enviar mensaje al iframe vía postMessage
   */
  sendToIframe(message) {
    try {
      const iframe = document.getElementById('externalContent');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(message, '*');
        log('[MASTER-CONN] 📤 Mensaje enviado al iframe');
      } else {
        log('[MASTER-CONN] ⚠️ iframe no encontrado');
      }
    } catch (err) {
      log(`[MASTER-CONN] Error enviando a iframe: ${err.message}`);
    }
  }

  /**
   * Mostrar iframe
   */
  showIframe() {
    const iframe = document.getElementById('externalContent');
    if (iframe) {
      iframe.style.display = 'block';
    }
  }

  /**
   * Ocultar iframe
   */
  hideIframe() {
    const iframe = document.getElementById('externalContent');
    if (iframe) {
      iframe.style.display = 'none';
    }
  }

  updateConnectionStatus(status, connected) {
    this.currentStatus.connected = connected;
    
    // Call callback if set
    if (this.statusUpdateCallback) {
      this.statusUpdateCallback(this.currentStatus);
    }
    
    // Log para debugging
    log(`[MASTER-CONN] Status: ${status} (${connected ? 'conectado' : 'desconectado'})`);
  }
  
  /**
   * Cerrar conexión
   */
  disconnect() {
    if (this.masterWs) {
      this.masterWs.close();
      this.masterWs = null;
    }
    this.stopHeartbeat();
    if (this.connectionRetryTimer) {
      clearTimeout(this.connectionRetryTimer);
    }
  }
}

window.MasterConnection = MasterConnection;

})();
