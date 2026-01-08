(function () {

	const { log } = window.Utils;
	let isEnabled = false;
	let menuState = null;
	let menuStructure = null;

	function initRemoteControl() {
		log('[REMOTE] Control remoto inicializado');
		isEnabled = true;
		
		// Cargar configuración inicial
		const config = getUtilsConfig();
		if (config?.menu?.initialState) {
			menuState = {
				sectionId: config.menu.initialState.sectionId,
				itemId: config.menu.initialState.itemId,
				language: config.menu.initialState.language || 'es'
			};
			log(`[REMOTE] Estado inicial: ${menuState.sectionId} / ${menuState.itemId} / ${menuState.language}`);
		}
		
		// Cargar estructura del menú
		loadMenuStructure();
		
		return true;
	}

	function loadMenuStructure() {
		try {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', '/menu.json', false); // Sincrónico para simplificar
			xhr.send();
			
			if (xhr.status === 200) {
				menuStructure = JSON.parse(xhr.responseText);
				log('[REMOTE] Estructura de menú cargada');
			} else {
				log('[REMOTE] Error cargando menu.json: ' + xhr.status);
			}
		} catch (err) {
			log('[REMOTE] Error: ' + err.message);
		}
	}

	function updateMenuState(direction) {
		// Actualiza sección e item según la dirección
		// NO modifica el language (se mantiene el actual)
		if (!menuStructure || !menuState) return;

		const sections = menuStructure.sections;
		const currentSectionIndex = sections.findIndex(s => s.id === menuState.sectionId);
		
		if (currentSectionIndex === -1) return;

		const currentSection = sections[currentSectionIndex];
		const currentItemIndex = currentSection.items.findIndex(i => i.id === menuState.itemId);

		switch (direction) {
			case 'up': // Tecla 1 - Sección anterior
				if (currentSectionIndex > 0) {
					const newSection = sections[currentSectionIndex - 1];
					menuState.sectionId = newSection.id;
					// Mantener el mismo índice de item si existe, sino el primero
					if (newSection.items[currentItemIndex]) {
						menuState.itemId = newSection.items[currentItemIndex].id;
					} else {
						menuState.itemId = newSection.items[0].id;
					}
				}
				break;

			case 'right': // Tecla 2 - Item siguiente
				if (currentItemIndex < currentSection.items.length - 1) {
					menuState.itemId = currentSection.items[currentItemIndex + 1].id;
				}
				break;

			case 'down': // Tecla 3 - Sección siguiente
				if (currentSectionIndex < sections.length - 1) {
					const newSection = sections[currentSectionIndex + 1];
					menuState.sectionId = newSection.id;
					// Mantener el mismo índice de item si existe, sino el primero
					if (newSection.items[currentItemIndex]) {
						menuState.itemId = newSection.items[currentItemIndex].id;
					} else {
						menuState.itemId = newSection.items[0].id;
					}
				}
				break;

			case 'left': // Tecla 4 - Item anterior
				if (currentItemIndex > 0) {
					menuState.itemId = currentSection.items[currentItemIndex - 1].id;
				}
				break;
		}

		log(`[REMOTE] Nuevo estado: ${menuState.sectionId} / ${menuState.itemId} / ${menuState.language}`);
	}

	window.addEventListener('keydown', (event) => {
		if (!event || !event.keyCode) return;
		handleBsKeyPress(event.keyCode);
	});

	function forwardKeyToIframe(keyCode, exactStartTime, masterTime, bufferMs, state) {
		const iframe = document.getElementById('externalContent');
		if (!iframe?.contentWindow) return;

		const message = { 
			type: 'keydown', 
			keyCode: keyCode,
			masterTime: masterTime,
			exactStartTime: exactStartTime,
			bufferMs: bufferMs,
			menuState: state // Incluir el estado del menú
		};

		log('[REMOTE] Enviando mensaje al iframe: ' + JSON.stringify(message));
		iframe.contentWindow.postMessage(message, '*');
	}

	function broadcastNavigationToSlaves(keyCode, exactStartTime, masterTime, bufferMs, state) {
		if (!window.SlaveServer?.broadcastToSlaves) return;

		window.SlaveServer.broadcastToSlaves({
			type: 'navigate_iframe',
			keyCode: keyCode,
			exactStartTime: exactStartTime,
			menuState: state // Incluir el estado del menú
		});
	}

	function sendSynchronizedNavigation(keyCode, direction) {
		// Actualizar el estado del menú antes de enviar
		if (direction) {
			updateMenuState(direction);
		}

		const config = getUtilsConfig();
		const syncBuffer = config?.master?.syncDelayMs || 200;
		const masterTime = Date.now();
		const exactStartTime = masterTime + syncBuffer;

		// Enviar al iframe local (master) con el estado actualizado
		forwardKeyToIframe(keyCode, exactStartTime, masterTime, syncBuffer, menuState);
		
		// Broadcast a slaves con el estado actualizado
		broadcastNavigationToSlaves(keyCode, exactStartTime, masterTime, syncBuffer, menuState);
	}

	function sendSynchronizedEnter() {
		// Para Enter, NO actualizar el estado, solo enviarlo como está
		const config = getUtilsConfig();
		const syncBuffer = Math.max(config?.master?.syncDelayMs || 800, 1500);
		const masterTime = Date.now();
		const exactStartTime = masterTime + syncBuffer;

		// Enviar al iframe local (master) con el estado actual (sin modificar)
		forwardKeyToIframe("5", exactStartTime, masterTime, syncBuffer, menuState);
		
		// Broadcast a slaves con el estado actual (sin modificar)
		broadcastNavigationToSlaves("5", exactStartTime, masterTime, syncBuffer, menuState);
	}

	function handleBsKeyPress(code) {
		if (!isEnabled) return;

		log(`[REMOTE] Tecla presionada: ${code}`);

		switch (code) {
			case 48: // Tecla: 0 - 48 Control - Mantener teclado activo
				log('[REMOTE] Tecla 0 de control presionada (keep-alive)');
				break;

			case 49:
      		case 32849: // Tecla 1 - Arriba
				log(`[REMOTE] Tecla direccional: ${code} -> 1 (Arriba)`);
				sendSynchronizedNavigation("1", "up");
				break;
			
			case 50:
      		case 32847: // Tecla 2 - Derecha
				log(`[REMOTE] Tecla direccional: ${code} -> 2 (Derecha)`);
				sendSynchronizedNavigation("2", "right");
				break;

			case 51:
      		case 32850: // Tecla 3 - Abajo
				log(`[REMOTE] Tecla direccional: ${code} -> 3 (Abajo)`);
				sendSynchronizedNavigation("3", "down");
				break;

			case 52:
      		case 32848: // Tecla 4 - Izquierda
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