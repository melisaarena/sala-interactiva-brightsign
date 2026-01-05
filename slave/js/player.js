// ===== Control del Reproductor de Video =====

(function() {

const { log } = window.SlaveUtils;

class SlavePlayer {
  constructor(clockSync, masterConnection) {
    this.clockSync = clockSync;
    this.masterConnection = masterConnection;
    this.videoElement = document.getElementById('player');
    this.scheduledPlayback = null;
    this.isPlaying = false;
    this.intentionalStop = false;
  }

  init() {
    if (!this.videoElement) {
      log('[VIDEO] Error: No se encontró el elemento #player');
      return;
    }
    
    this.videoElement.addEventListener('error', () => {
      if (this.intentionalStop) {
        this.intentionalStop = false;
        return;
      }
      
      const error = this.videoElement.error;
      if (error) {
        const codes = ['', 'ABORTED', 'NETWORK', 'DECODE', 'SRC_NOT_SUPPORTED'];
        log(`[VIDEO] Error: ${codes[error.code] || 'UNKNOWN'}`);
      }
    });

    this.videoElement.addEventListener('ended', () => {
      this.handleVideoEnded();
    });
  }

  scheduleExactPlayback(message) {
    if (this.scheduledPlayback) {
      cancelAnimationFrame(this.scheduledPlayback);
      this.scheduledPlayback = null;
    }

    if (!this.clockSync.clockSynced) return;

    const currentSyncTime = this.clockSync.getSyncedTime();
    const targetSyncTime = message.exactStartTime || message.syncTime;
    const timeUntilStart = targetSyncTime - currentSyncTime;

    if (timeUntilStart < 0) return;

    const checkAndExecute = () => {
      const now = this.clockSync.getSyncedTime();
      const remaining = targetSyncTime - now;
      
      if (remaining <= 0) {
        const mediaPath = message.mediaPath || 'video.mp4';
        this.startExactPlayback(message.action, mediaPath, targetSyncTime, message);
      } else if (remaining < 50) {
        this.scheduledPlayback = requestAnimationFrame(checkAndExecute);
      } else {
        setTimeout(() => {
          this.scheduledPlayback = requestAnimationFrame(checkAndExecute);
        }, remaining - 50);
      }
    };

    if (timeUntilStart > 100) {
      setTimeout(() => {
        this.scheduledPlayback = requestAnimationFrame(checkAndExecute);
      }, timeUntilStart - 100);
    } else {
      this.scheduledPlayback = requestAnimationFrame(checkAndExecute);
    }
  }

  startExactPlayback(action, mediaPath, targetTime, message = {}) {
    const shouldLoop = message.loop || false;
    
    const overlay = document.getElementById('waitingOverlay');
    if (overlay) overlay.style.display = 'none';
    
    const iframe = document.getElementById('externalContent');
    if (iframe && iframe.style.display !== 'none') {
      iframe.style.display = 'none';
    }
    
    this.videoElement.pause();
    this.videoElement.currentTime = 0;
    this.videoElement.src = `/media/${mediaPath}`;
    this.videoElement.loop = shouldLoop;
    this.videoElement.load();
    
    const playPromise = this.videoElement.play();
    if (playPromise) {
      playPromise.then(() => {
        this.isPlaying = true;
      }).catch(err => {
        log(`[VIDEO] Error: ${err.message}`);
      });
    }
  }

  handleSyncStop() {
    this.isPlaying = false;
    this.intentionalStop = true;
    
    if (this.scheduledPlayback) {
      cancelAnimationFrame(this.scheduledPlayback);
      this.scheduledPlayback = null;
    }
    
    this.videoElement.pause();
    this.videoElement.currentTime = 0;
    this.videoElement.src = '';
    this.videoElement.loop = false;
    this.videoElement.load();
    
    const overlay = document.getElementById('waitingOverlay');
    if (overlay) overlay.style.display = 'flex';
  }

  handleSyncPause() {
    this.isPlaying = false;
    this.videoElement.pause();
  }

  handleVideoEnded() {
    this.isPlaying = false;
    
    if (this.videoElement) {
      this.videoElement.currentTime = 0;
      this.videoElement.src = '';
      this.videoElement.load();
    }
    
    const iframe = document.getElementById('externalContent');
    if (iframe) {
      iframe.style.display = 'block';
    }
  }
}

window.SlavePlayer = SlavePlayer;

})();
