/**
 * Remote Control Handler for Master BrightSign
 * Broadcasts navigation commands to all slaves via SlaveServer
 */
(function () {
  const { log } = window.Utils;
  let isEnabled = false;

  function initRemoteControl() {
    log("[REMOTE] 🎮 Control remoto inicializado");
    isEnabled = true;
    
    // Verificar que SlaveServer esté disponible
    if (!window.SlaveServer) {
      log("[REMOTE] ❌ SlaveServer not available");
      return false;
    }
    
    log("[REMOTE] ✅ SlaveServer ready");
    return true;
  }

  // Listen for keyboard events
  window.addEventListener("keydown", (event) => {
    if (!event || !event.keyCode) return;
    handleBsKeyPress(event.keyCode);
  });

  /**
   * Handle BrightSign remote control key presses
   * @param {number} code - Key code from remote control
   */
  function handleBsKeyPress(code) {
    if (!isEnabled) return;

    let mappedKey = null;

    switch (code) {
      case 48: // Tecla: 0 - Keep-alive
        log("[REMOTE] Tecla 0 de control presionada (keep-alive)");
        return;

      case 49:
      case 32849: // Tecla 1 - Arriba
        log(`[REMOTE] Tecla: ${code} → 1 (Arriba)`);
        mappedKey = "1";
        break;

      case 50:
      case 32847: // Tecla 2 - Derecha
        log(`[REMOTE] Tecla: ${code} → 2 (Derecha)`);
        mappedKey = "2";
        break;

      case 51:
      case 32850: // Tecla 3 - Abajo
        log(`[REMOTE] Tecla: ${code} → 3 (Abajo)`);
        mappedKey = "3";
        break;

      case 52:
      case 32848: // Tecla 4 - Izquierda
        log(`[REMOTE] Tecla: ${code} → 4 (Izquierda)`);
        mappedKey = "4";
        break;

      case 53: // Tecla: 5 - Enter/Select
        log(`[REMOTE] Tecla: ${code} → 5 (Enter/Select)`);
        mappedKey = "5";
        break;

      case 54: // Tecla: 6 - Idioma (not implemented yet)
        log("[REMOTE] Tecla idioma presionada (pendiente implementar)");
        return;

      // Keep debug keyboard keys for development
      case 38: // Arrow Up
        mappedKey = "1";
        break;
      case 39: // Arrow Right
        mappedKey = "2";
        break;
      case 40: // Arrow Down
        mappedKey = "3";
        break;
      case 37: // Arrow Left
        mappedKey = "4";
        break;
      case 13: // Enter
        mappedKey = "5";
        break;
        
      default:
        // Unknown key
        return;
    }

    // Send navigation command via SlaveServer broadcast
    if (mappedKey) {
      // Calcular nuevo estado basado en la tecla
      const newState = calculateNewState(mappedKey);
      
      if (newState && window.SlaveServer) {
        log(`[REMOTE] 📤 Broadcasting navigation: ${mappedKey}`);
        window.SlaveServer.broadcastNavigation({
          state: newState,
          direction: getDirection(mappedKey)
        });
      } else {
        log("[REMOTE] ❌ Cannot broadcast: SlaveServer not available");
      }
    }
  }

  /**
   * Calcular nuevo estado basado en la tecla presionada
   */
  function calculateNewState(key) {
    // Por ahora, devolver el estado actual
    // El React app será quien calcule el estado exacto
    const currentState = window.SlaveServer?.getCurrentState();
    
    return {
      floorId: currentState?.floorId || 'piso-1',
      itemId: currentState?.itemId || 'item-1',
      key: key, // Enviar la tecla para que React la procese
      lastUpdate: Date.now()
    };
  }

  /**
   * Obtener dirección basada en la tecla
   */
  function getDirection(key) {
    switch (key) {
      case '1': return 'up';
      case '2': return 'right';
      case '3': return 'down';
      case '4': return 'left';
      case '5': return 'select';
      default: return null;
    }
  }

  // Public API
  window.RemoteControl = {
    init: initRemoteControl,
    isEnabled: () => isEnabled,
  };
})();
