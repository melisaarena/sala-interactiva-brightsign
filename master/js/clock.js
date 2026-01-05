// ===== Reloj en pantalla Ready =====

(function() {

function initClock() {
  // Inicializar reloj optimizado (~60fps es suficiente para milisegundos)
  updateClock();
  setInterval(updateClock, 16);
}

function updateClock() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
  const timeString = `${hours}:${minutes}:${seconds}.${milliseconds}`;
  
  const clockDisplay = document.getElementById('clockDisplay');
  if (clockDisplay) {
    clockDisplay.textContent = timeString;
  }
}

// Exponer funciones globalmente
window.Clock = {
  initClock
};


})(); 
