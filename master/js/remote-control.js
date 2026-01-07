(function () {

	const { log } = window.Utils;
	let isEnabled = false;

	function initRemoteControl() {
		log('[REMOTE] Control remoto inicializado');
		isEnabled = true;
		return true;
	}

	window.addEventListener('keydown', (event) => {
		if (!event || !event.keyCode) return;
		handleBsKeyPress(event.keyCode);
	});

	function forwardKeyToIframe(keyCode, exactStartTime, masterTime, bufferMs) {
		const iframe = document.getElementById('externalContent');
		if (!iframe?.contentWindow) return;

		iframe.contentWindow.postMessage({ 
			type: 'keydown', 
			keyCode: keyCode,
			masterTime: masterTime,
			exactStartTime: exactStartTime,
			bufferMs: bufferMs
		}, '*');
	}

	function broadcastNavigationToSlaves(keyCode, exactStartTime, masterTime, bufferMs) {
		if (!window.SlaveServer?.broadcastToSlaves) return;

		window.SlaveServer.broadcastToSlaves({
			type: 'navigate_iframe',
			keyCode: keyCode,
			masterTime: masterTime,
			exactStartTime: exactStartTime,
			bufferMs: bufferMs
		});
	}

	function sendSynchronizedNavigation(keyCode) {
		const config = getUtilsConfig();
		const syncBuffer = config?.master?.syncDelayMs || 200; // Buffer más corto para navegación
		const masterTime = Date.now();
		const exactStartTime = masterTime + syncBuffer;

		// Enviar al iframe local (master)
		forwardKeyToIframe(keyCode, exactStartTime, masterTime, syncBuffer);
		
		// Broadcast a slaves
		broadcastNavigationToSlaves(keyCode, exactStartTime, masterTime, syncBuffer);
	}

	function sendSynchronizedEnter() {
		const config = getUtilsConfig();
		const syncBuffer = Math.max(config?.master?.syncDelayMs || 800, 1500); // Buffer mayor para video (como en sync.js)
		const masterTime = Date.now();
		const exactStartTime = masterTime + syncBuffer;

		// Enviar al iframe local (master)
		forwardKeyToIframe("5", exactStartTime, masterTime, syncBuffer);
		
		// Broadcast a slaves
		broadcastNavigationToSlaves("5", exactStartTime, masterTime, syncBuffer);
	}

	function handleBsKeyPress(code) {
		if (!isEnabled) return;

		switch (code) {
			case 48: // Tecla: 0 - 48 Control - Mantener teclado activo
				log('[REMOTE] Tecla 0 de control presionada (keep-alive)');
				break;

			case 49:
      		case 32849: // Tecla 1 - Arriba
				log(`[REMOTE] Tecla direccional: ${code} -> 1 `);
				sendSynchronizedNavigation("1");
				break;
			
			case 50:
      		case 32847: // Tecla 2 - Derecha
				log(`[REMOTE] Tecla direccional: ${code} -> 2 `);
				sendSynchronizedNavigation("2");
				break;

			case 51:
      		case 32850: // Tecla 3 - Abajo
				log(`[REMOTE] Tecla direccional: ${code} -> 3 `);
				sendSynchronizedNavigation("3");
				break;

			case 52:
      		case 32848: // Tecla 4 - Izquierda
				log(`[REMOTE] Tecla direccional: ${code} -> 4 `);
				sendSynchronizedNavigation("4");
				break;

			case 53: // Tecla: 5 - Enter/Select
        		log(`[REMOTE] Tecla: ${code} → 5 (Enter/Select)`);
				const iframe = document.getElementById('externalContent');
				if (!iframe) return toggleExternalContent(); // si no esta iframe lo muestro. 
				sendSynchronizedEnter(); // Buffer mayor para reproducción de video
				break;

			case 54: // Tecla: 6 - Idioma (not implemented yet)
        		log("[REMOTE] Tecla idioma presionada (pendiente implementar)");
        		return;
		}
	}

	function toggleExternalContent() {
		try {
			const iframe = document.getElementById('externalContent');
			if (!iframe) return;

			if (iframe.style.display === 'none') {
				const config = getUtilsConfig();
				if (!config) return;
				
				const targetUrl = config.externalApp?.url || '';
				
				// Enviar comando a slaves PRIMERO
				broadcastShowExternalApp();
				
				// Luego mostrar en master (para dar tiempo a los slaves)
				iframe.src = targetUrl;
				iframe.style.display = 'block';
				
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

	function getUtilsConfig() {
		const config = window.Utils?.loadConfig();
		if (!config) {
			log('[REMOTE] Error: No se pudo cargar la configuración');
		}
		return config || null;
	}

	window.RemoteControl = {
		initRemoteControl
	};

})();