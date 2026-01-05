// ===== Sincronización Confiable con Slaves =====

(function() {

const { log } = window.Utils;
const { broadcastToSlaves, getReadySlaveCount } = window.SlaveServer;

let videoElement = null;
let overlayElement = null;
let isPlaying = false;

function initSync(video, overlay) {
  videoElement = video;
  overlayElement = overlay;
  videoElement.addEventListener('ended', handleVideoEnded);
}

function handleVideoEnded() {
  isPlaying = false;
  
  if (videoElement) {
    videoElement.currentTime = 0;
    videoElement.src = '';
    videoElement.load();
  }
  
  const iframe = document.getElementById('externalContent');
  if (iframe) {
    iframe.style.display = 'block';
  }
  
  broadcastToSlaves({
    type: 'show_menu_only',
    masterTime: Date.now()
  });
}

async function executeSynchronizedVideoPlay(videoPath, hotspotId) {
  const slaveStats = getReadySlaveCount();
  isPlaying = true;

  const config = window.Utils ? window.Utils.loadConfig() : {};
  const syncBuffer = Math.max(config.master?.syncDelayMs || 800, 1500);

  if (slaveStats.total === 0) {
    startMasterVideoWithPath(Date.now(), videoPath);
    return;
  }

  const exactStartTime = Date.now() + syncBuffer;

  const syncMessage = {
    type: 'sync_exact_start',
    action: 'play',
    exactStartTime: exactStartTime,
    videoPosition: 0,
    masterTime: Date.now(),
    bufferMs: syncBuffer,
    syncId: Math.random().toString(36).substr(2, 9),
    mediaPath: videoPath,
    loop: false
  };

  const sentCount = broadcastToSlaves(syncMessage);
  
  if (sentCount === 0) {
    startMasterVideoWithPath(Date.now(), videoPath);
    return;
  }
  
  scheduleExactStartWithPath(exactStartTime, videoPath);
}

function scheduleExactStartWithPath(exactStartTime, videoPath) {
  const checkInterval = () => {
    const now = Date.now();
    const remaining = exactStartTime - now;
    
    if (remaining <= 0) {
      startMasterVideoWithPath(exactStartTime, videoPath);
      return;
    }
    
    if (remaining <= 10) {
      const waitForExact = () => {
        if (Date.now() >= exactStartTime) {
          startMasterVideoWithPath(exactStartTime, videoPath);
        } else {
          requestAnimationFrame(waitForExact);
        }
      };
      requestAnimationFrame(waitForExact);
    } else if (remaining <= 100) {
      setTimeout(checkInterval, 1);
    } else {
      setTimeout(checkInterval, Math.min(50, remaining - 100));
    }
  };
  
  checkInterval();
}

function startMasterVideoWithPath(targetTime, videoPath) {
  if (!videoElement || !overlayElement) return;
  
  const iframe = document.getElementById('externalContent');
  if (iframe && iframe.style.display !== 'none') {
    iframe.style.display = 'none';
  }
  
  videoElement.pause();
  videoElement.currentTime = 0;
  videoElement.src = '/media/' + videoPath;
  videoElement.loop = false;
  
  overlayElement.classList.add('hidden');
  
  videoElement.load();
  videoElement.currentTime = 0;
  
  videoElement.play().catch(err => {
    log(`[CONTROL] Error: ${err.message}`);
  });
}

async function executeSynchronizedPlay(config) {
  const slaveStats = getReadySlaveCount();
  isPlaying = true;

  if (slaveStats.total === 0) {
    startMasterVideoAtTime(Date.now());
    return;
  }

  const syncBuffer = Math.max(config.master.syncDelayMs, 1500);
  const exactStartTime = Date.now() + syncBuffer;
  const mediaPath = config.media.videoPath || 'video.mp4';
  
  const syncMessage = {
    type: 'sync_exact_start',
    action: 'play',
    exactStartTime: exactStartTime,
    videoPosition: 0,
    masterTime: Date.now(),
    bufferMs: syncBuffer,
    syncId: Math.random().toString(36).substr(2, 9),
    mediaPath: mediaPath,
    loop: true
  };

  const sentCount = broadcastToSlaves(syncMessage);
  
  if (sentCount === 0) {
    startMasterVideoAtTime(Date.now());
    return;
  }
  
  scheduleExactStart(exactStartTime);
}

function scheduleExactStart(exactStartTime) {
  const checkInterval = () => {
    const now = Date.now();
    const remaining = exactStartTime - now;
    
    if (remaining <= 0) {
      startMasterVideoAtTime(exactStartTime);
      return;
    }
    
    if (remaining <= 10) {
      const waitForExact = () => {
        if (Date.now() >= exactStartTime) {
          startMasterVideoAtTime(exactStartTime);
        } else {
          requestAnimationFrame(waitForExact);
        }
      };
      requestAnimationFrame(waitForExact);
    } else if (remaining <= 100) {
      setTimeout(checkInterval, 1);
    } else {
      setTimeout(checkInterval, Math.min(50, remaining - 100));
    }
  };
  
  checkInterval();
}

function startMasterVideoAtTime(targetTime) {
  if (!videoElement || !overlayElement) return;
  
  videoElement.pause();
  videoElement.currentTime = 0;
  
  const config = window.Utils ? window.Utils.loadConfig() : {};
  const mediaPath = config.media?.videoPath || 'video.mp4';
  
  videoElement.src = '/media/' + mediaPath;
  videoElement.loop = true;
  
  overlayElement.classList.add('hidden');
  
  videoElement.load();
  videoElement.currentTime = 0;
  
  videoElement.play().catch(err => {
    log(`[CONTROL] Error: ${err.message}`);
  });
}

async function executeSynchronizedStop() {
  broadcastToSlaves({
    type: 'sync_stop',
    masterTime: Date.now()
  });

  setTimeout(() => {
    stopMasterVideo();
  }, 100);
}

function stopMasterVideo() {
  if (!videoElement || !overlayElement) return;
  
  videoElement.pause();
  videoElement.currentTime = 0;
  videoElement.src = '';
  videoElement.loop = false;
  videoElement.load();
  overlayElement.classList.remove('hidden');
  
  isPlaying = false;
}

function handleRemoteCommand(message, config) {
  if (!message || message.type !== 'control') return;
  
  switch (message.action) {
    case 'play':
      executeSynchronizedPlay(config);
      break;
      
    case 'pause':
      broadcastToSlaves({
        type: 'sync_pause',
        masterTime: Date.now()
      });
      
      setTimeout(() => {
        if (videoElement) {
          videoElement.pause();
        }
      }, 100);
      break;
      
    case 'stop':
    case 'restart':
      executeSynchronizedStop();
      break;
  }
}

window.Sync = {
  initSync,
  executeSynchronizedVideoPlay,
  executeSynchronizedStop,
  stopMasterVideo,
  isPlaying: () => isPlaying
};

})();
