// ===== Control del Video =====

(function() {

const { log } = window.Utils;

let videoElement = null;

function initPlayer(video) {
  videoElement = video;
  
  log('[PLAYER] Player inicializado');
  
  video.addEventListener('pause', () => {
    log('[VIDEO] Video pausado', { verbose: true });
  });

  video.addEventListener('ended', () => {
    log('[VIDEO] Video terminado', { verbose: true });
  });

  video.addEventListener('error', (e) => {
    log(`[VIDEO] Error: ${e.message || 'Error desconocido'}`);
  });
}

// Exponer funciones globalmente
window.Player = {
  initPlayer
};

})();
