// ===== Reloj en Pantalla =====

(function() {

const { log } = window.Utils;

class Clock {
  constructor() {
    this.clockInterval = null;
  }

  init() {
    this.start();
  }

  start() {
    this.stop();
    this.updateClock(); // Actualizar inmediatamente
    this.clockInterval = setInterval(() => {
      this.updateClock();
    }, 1000); // Actualizar cada segundo
  }

  stop() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  updateClock() {
    const element = document.getElementById('clockDisplay');
    if (!element) return;
    
    const date = new Date();
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    element.textContent = `${hours}:${minutes}:${seconds}`;
  }
}

// Crear instancia global
const clockInstance = new Clock();

window.Clock = {
  init: () => clockInstance.init(),
  start: () => clockInstance.start(),
  stop: () => clockInstance.stop()
};

})();
