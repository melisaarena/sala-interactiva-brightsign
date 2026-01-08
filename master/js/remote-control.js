(function () {

	const { log } = window.Utils;
	let isEnabled = false;

	function initRemoteControl() {
		log('[REMOTE] Control remoto inicializado');
		isEnabled = true;
		
		// Inicializar el estado del menú
		const config = window.Utils.loadConfig();
		window.MenuState.initMenuState(config);
		
		return true;
	}

	window.addEventListener('keydown', (event) => {
		if (!event || !event.keyCode) return;
		handleBsKeyPress(event.keyCode);
	});

	function forwardKeyToIframe(keyCode, exactStartTime, state) {
		const iframe = document.getElementById('externalContent');
		if (!iframe?.contentWindow) return;

		let message;
		
		// Si es tecla Enter (5), enviar mensaje de play_video
		if (keyCode === "5") {
			message = {
				type: 'play_video',
				floorId: state.sectionId,
				itemId: state.itemId,
				exactStartTime: exactStartTime
			};
		} else {
			// Para otras teclas, enviar mensaje de navegación
			message = { 
				type: 'keydown', 
				keyCode: keyCode,
				exactStartTime: exactStartTime,
				menuState: state
			};
		}

		log('[REMOTE] Enviando mensaje al iframe: ' + JSON.stringify(message));
		iframe.contentWindow.postMessage(message, '*');
	}

	function broadcastNavigationToSlaves(keyCode, exactStartTime, state) {
		if (!window.SlaveServer?.broadcastToSlaves) return;

		let message;
		
		// Si es tecla Enter (5), enviar mensaje de play_video
		if (keyCode === "5") {
			message = {
				type: 'play_video',
				floorId: state.sectionId,
				itemId: state.itemId,
				exactStartTime: exactStartTime
			};
		} else {
			// Para otras teclas, enviar mensaje de navegación
			message = {
				type: 'navigate_iframe',
				keyCode: keyCode,
				exactStartTime: exactStartTime,
				menuState: state
			};
		}

		window.SlaveServer.broadcastToSlaves(message);
	}

	function sendSynchronizedNavigation(keyCode, direction) {
		// Actualizar el estado del menú antes de enviar
		const menuState = direction 
			? window.MenuState.updateMenuState(direction)
			: window.MenuState.getCurrentState();

		const config = window.Utils.loadConfig(); 
		const syncBuffer = config?.master?.syncDelayMs || 200;
		const exactStartTime = Date.now() + syncBuffer;

		// Enviar al iframe local (master) con el estado actualizado
		forwardKeyToIframe(keyCode, exactStartTime, menuState);
		
		// Broadcast a slaves con el estado actualizado
		broadcastNavigationToSlaves(keyCode, exactStartTime, menuState);
	}

	function sendSynchronizedEnter() {
		// Para Enter, NO actualizar el estado, solo enviarlo como está
		const menuState = window.MenuState.getCurrentState();
		const config = window.Utils.loadConfig(); 
		const syncBuffer = Math.max(config?.master?.syncDelayMs || 800, 1500);
		const exactStartTime = Date.now() + syncBuffer;

		// Enviar al iframe local (master) con el estado actual (sin modificar)
		forwardKeyToIframe("5", exactStartTime, menuState);
		
		// Broadcast a slaves con el estado actual (sin modificar)
		broadcastNavigationToSlaves("5", exactStartTime, menuState);
	}

	function handleBsKeyPress(code) {
		if (!isEnabled) return;

		log(`[REMOTE] Tecla presionada: ${code}`);

		switch (code) {
			case 48: // Tecla: 0 - 48 Control - Mantener teclado activo
				log('[REMOTE] Tecla 0 de control presionada (keep-alive)');
				break;

			case 49: // Tecla 1 - Arriba
				log(`[REMOTE] Tecla direccional: ${code} -> 1 (Arriba)`);
				sendSynchronizedNavigation("1", "up");
				break;
			
			case 50: // Tecla 2 - Derecha
				log(`[REMOTE] Tecla direccional: ${code} -> 2 (Derecha)`);
				sendSynchronizedNavigation("2", "right");
				break;

			case 51: // Tecla 3 - Abajo
				log(`[REMOTE] Tecla direccional: ${code} -> 3 (Abajo)`);
				sendSynchronizedNavigation("3", "down");
				break;

			case 52: // Tecla 4 - Izquierda
				log(`[REMOTE] Tecla direccional: ${code} -> 4 (Izquierda)`);
				sendSynchronizedNavigation("4", "left");
				break;

			case 53: // Tecla: 5 - Enter/Select
        		log(`[REMOTE] Tecla: ${code} → 5 (Enter/Select)`);
				const iframe = document.getElementById('externalContent');
				if (!iframe || iframe.style.display === 'none') {
					toggleExternalContent(); // Si no existe o está oculto, mostrarlo
				} else {
					sendSynchronizedEnter(); // Si está visible, enviar tecla Enter
				}
				break;

			case 54: // Tecla: 6 - Idioma
        		log("[REMOTE] Tecla idioma presionada");
				const newMenuState = window.MenuState.changeLanguage();
				sendSynchronizedNavigation("6", null); // Sin dirección, solo enviar el cambio de idioma
        		return;
		}
	}

	function toggleExternalContent() {
		try {
			const iframe = document.getElementById('externalContent');
			if (!iframe) return;

			if (iframe.style.display === 'none') {
				const config = window.Utils.loadConfig(); // Ahora usa caché automáticamente
				if (!config) return;
				
				const baseUrl = config.externalApp?.baseUrl || 'http://localhost:3000';
				const projectorIndex = config.externalApp?.projectorIndex || 0;
				const targetUrl = `${baseUrl}/#/brightsign/display?projectorIndex=${projectorIndex}`;
				
				// Enviar comando a slaves PRIMERO
				broadcastShowExternalApp();
				
				// Luego mostrar en master (para dar tiempo a los slaves)
				iframe.src = targetUrl;
				iframe.style.display = 'block';
				log('[REMOTE] ✓ Iframe visible manualmente con URL: ' + targetUrl);
				
			} 
		} catch (err) {
			log('[REMOTE] Error toggleExternalContent: ' + err.message);
		}
	}

	function broadcastShowExternalApp() {
		try {
			if (window.SlaveServer?.broadcastToSlaves) {
				window.SlaveServer.broadcastToSlaves({
					type: 'show_external_app',
					masterTime: Date.now()
				});
			}
		} catch (err) {
			log('[REMOTE] Error broadcasting show: ' + err.message);
		}
	}

	window.RemoteControl = {
		initRemoteControl
	};

})();