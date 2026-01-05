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

	function forwardKeyToIframe(keyCode) {
		const iframe = document.getElementById('externalContent');
		if (!iframe?.contentWindow) return;

		iframe.contentWindow.postMessage({ type: 'keydown', keyCode: keyCode }, '*');
	}

	function broadcastNavigationToSlaves(keyCode) {
		if (!window.SlaveServer?.broadcastToSlaves) return;

		window.SlaveServer.broadcastToSlaves({
			type: 'navigate_iframe',
			keyCode: keyCode,
			masterTime: Date.now()
		});
	}

	function handleBsKeyPress(code) {
		if (!isEnabled) return;

		switch (code) {
			case 48: // Tecla: 0 - 48 Control - Mantener teclado activo
				log('[REMOTE] Tecla 0 de control presionada (keep-alive)');
				break;

			case 49: // Tecla: 1 - 49 Enter - Reproducir video
				executePlayVideoFromHotspot();
				break;

			case 50: // Tecla: 2 - Arriba
			case 51: // Tecla: 3 - Derecha
			case 52: // Tecla: 4 - Abajo
			case 53: // Tecla: 5 - Izquierda
				log(`[REMOTE] Tecla direccional: ${code}`);
				forwardKeyToIframe(code);
				broadcastNavigationToSlaves(code);
				break;
				
			case 54: // Tecla: 6 - 54 Idioma - A implementar
				log('[REMOTE] Tecla idioma presionada (pendiente implementar)');
				// TODO: Implementar cambio de idioma
				break;

			// Mantener teclas de teclado para desarrollo/debug
			case 109: // M - Mostrar/Ocultar Menú
				toggleExternalContent();
				break;
			case 13: // Enter - Reproducir video
				executePlayVideoFromHotspot();
				break;
			case 27: // Escape - Volver al menú
				returnToMenu();
				break;
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
				
				const video = document.getElementById('player');
				if (video && !video.paused) {
					video.pause();
				}
				
			} else {
				returnToSyncScreen();
			}
		} catch (err) {
			log('[REMOTE] Error toggleExternalContent: ' + err.message);
		}
	}

	function hideExternalContent() {
		try {
			const iframe = document.getElementById('externalContent');
			if (iframe && iframe.style.display !== 'none') {
				iframe.style.display = 'none';
				broadcastHideExternalApp();
			}
		} catch (err) {
			log('[REMOTE] Error hideExternalContent: ' + err.message);
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

	function broadcastHideExternalApp() {
		try {
			if (window.SlaveServer?.broadcastToSlaves) {
				window.SlaveServer.broadcastToSlaves({
					type: 'hide_external_app',
					masterTime: Date.now()
				});
			}
		} catch (err) {
			log('[REMOTE] Error broadcasting hide: ' + err.message);
		}
	}

	function getUtilsConfig() {
		const config = window.Utils?.loadConfig();
		if (!config) {
			log('[REMOTE] Error: No se pudo cargar la configuración');
		}
		return config || null;
	}

	function returnToMenu() {
		try {
			if (window.Sync?.executeSynchronizedStop) {
				window.Sync.executeSynchronizedStop();
			}
			
			const iframe = document.getElementById('externalContent');
			if (iframe) {
				iframe.style.display = 'block';
			}
			
			if (window.SlaveServer?.broadcastToSlaves) {
				window.SlaveServer.broadcastToSlaves({
					type: 'show_menu_only',
					masterTime: Date.now()
				});
			}
		} catch (err) {
			log('[REMOTE] Error returnToMenu: ' + err.message);
		}
	}

	function returnToSyncScreen() {
		try {
			const iframe = document.getElementById('externalContent');
			if (iframe) {
				iframe.style.display = 'none';
			}
			
			if (window.Sync?.executeSynchronizedStop) {
				window.Sync.executeSynchronizedStop();
			}
			
			broadcastHideExternalApp();
		} catch (err) {
			log('[REMOTE] Error returnToSyncScreen: ' + err.message);
		}
	}

	function executePlayVideoFromHotspot() {
		try {
			const iframe = document.getElementById('externalContent');
			if (!iframe || iframe.style.display === 'none' || !iframe.contentWindow) {
				return;
			}

			let videoResponseReceived = false;
			let responseTimeout = null;

			const handleVideoResponse = function(event) {
				if (!event.data || event.data.type !== 'video_response') return;

				videoResponseReceived = true;
				clearTimeout(responseTimeout);
				window.removeEventListener('message', handleVideoResponse);

				if (event.data.error) {
					log('[REMOTE] Error: ' + event.data.error);
					return;
				}

				const videoFile = event.data.videoFile;
				const hotspotId = event.data.hotspotId;

				if (window.Sync?.executeSynchronizedVideoPlay) {
					window.Sync.executeSynchronizedVideoPlay(videoFile, hotspotId);
				}
			};

			window.addEventListener('message', handleVideoResponse);

			responseTimeout = setTimeout(function() {
				if (!videoResponseReceived) {
					window.removeEventListener('message', handleVideoResponse);
				}
			}, 2000);

			iframe.contentWindow.postMessage({ type: 'request_current_video' }, '*');

		} catch (err) {
			log('[REMOTE] Error executePlayVideoFromHotspot: ' + err.message);
		}
	}

	window.RemoteControl = {
		initRemoteControl
	};

})();