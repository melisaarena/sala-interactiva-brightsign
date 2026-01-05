// ===== Reloj en Pantalla =====

(function() {

const { log } = window.SlaveUtils;

class SlaveClock {
  constructor(clockSync) {
    this.clockSync = clockSync;
    this.clockInterval = null;
  }

  start() {
    this.stop();
    this.clockInterval = setInterval(() => {
      this.updateClock();
    }, 16);
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
    
    const currentTime = this.clockSync.clockSynced ? this.clockSync.getSyncedTime() : Date.now();
    const date = new Date(currentTime);
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    element.textContent = `${hours}:${minutes}:${seconds}.${milliseconds}`;
    element.style.color = this.clockSync.clockSynced ? '#00FF00' : '#FFFFFF';
  }
}

window.SlaveClock = SlaveClock;

})();
