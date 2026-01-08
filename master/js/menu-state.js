(function () {

	const { log, loadMenu } = window.Utils;
	let menuState = null;
	let menuStructure = null;

	function initMenuState(config) {
		if (config?.menu?.initialState) {
			menuState = {
				sectionId: config.menu.initialState.sectionId,
				itemId: config.menu.initialState.itemId,
				language: config.menu.initialState.language || 'es'
			};
			log(`[MENU-STATE] Estado inicial: ${menuState.sectionId} / ${menuState.itemId} / ${menuState.language}`);
		}
		
		// Cargar el menú usando fs (igual que config.json)
		menuStructure = loadMenu();
		
		if (menuStructure) {
			log(`[MENU-STATE] ✓ Menú cargado con ${menuStructure.sections?.length || 0} secciones`);
		} else {
			log('[MENU-STATE] ❌ No se pudo cargar el menú');
		}
		
		return menuState;
	}

	function getCurrentState() {
		return menuState;
	}

	function updateMenuState(direction) {
		// Actualiza sección e item según la dirección
		// NO modifica el language (se mantiene el actual)
		if (!menuStructure || !menuState) {
			log('[MENU-STATE] ERROR: menuStructure o menuState es null');
			return menuState;
		}

		const sections = menuStructure.sections;
		const currentSectionIndex = sections.findIndex(s => s.id === menuState.sectionId);
		
		if (currentSectionIndex === -1) {
			log('[MENU-STATE] ERROR: No se encontró la sección actual: ' + menuState.sectionId);
			return menuState;
		}

		const currentSection = sections[currentSectionIndex];
		const currentItemIndex = currentSection.items.findIndex(i => i.id === menuState.itemId);
		
		log(`[MENU-STATE] Dirección: ${direction}, Sección: ${menuState.sectionId}, Item: ${menuState.itemId}`);

		switch (direction) {
			case 'up': // Tecla 1 - Piso superior (siguiente en la lista, cíclico)
				const nextSectionIndex = (currentSectionIndex + 1) % sections.length;
				const nextSection = sections[nextSectionIndex];
				menuState.sectionId = nextSection.id;
				// Mantener el mismo índice de item si existe, sino el primero
				if (nextSection.items[currentItemIndex]) {
					menuState.itemId = nextSection.items[currentItemIndex].id;
				} else {
					menuState.itemId = nextSection.items[0].id;
				}
				break;

			case 'right': // Tecla 2 - Item siguiente (cíclico)
				const nextItemIndex = (currentItemIndex + 1) % currentSection.items.length;
				menuState.itemId = currentSection.items[nextItemIndex].id;
				log(`[MENU-STATE] Right: ${currentItemIndex} -> ${nextItemIndex} (${menuState.itemId})`);
				break;

			case 'down': // Tecla 3 - Piso inferior (anterior en la lista, cíclico)
				const prevSectionIndex = currentSectionIndex > 0 
					? currentSectionIndex - 1 
					: sections.length - 1; // Volver a la última sección
				
				const prevSection = sections[prevSectionIndex];
				menuState.sectionId = prevSection.id;
				// Mantener el mismo índice de item si existe, sino el primero
				if (prevSection.items[currentItemIndex]) {
					menuState.itemId = prevSection.items[currentItemIndex].id;
				} else {
					menuState.itemId = prevSection.items[0].id;
				}
				break;

			case 'left': // Tecla 4 - Item anterior (cíclico)
				const prevItemIndex = currentItemIndex > 0 
					? currentItemIndex - 1 
					: currentSection.items.length - 1; // Volver al último item
				menuState.itemId = currentSection.items[prevItemIndex].id;
				log(`[MENU-STATE] Left: ${currentItemIndex} -> ${prevItemIndex} (${menuState.itemId})`);
				break;
		}

		log(`[MENU-STATE] Nuevo estado: ${menuState.sectionId} / ${menuState.itemId} / ${menuState.language}`);
		return menuState;
	}

	function changeLanguage() {
		// Cambiar al siguiente idioma disponible
		if (!menuStructure || !menuState) return menuState;

		const languages = menuStructure.languages || [];
		if (languages.length === 0) return menuState;

		const currentIndex = languages.findIndex(lang => lang.code === menuState.language);
		const nextIndex = (currentIndex + 1) % languages.length;
		menuState.language = languages[nextIndex].code;

		log(`[MENU-STATE] Idioma cambiado a: ${menuState.language}`);
		return menuState;
	}

	window.MenuState = {
		initMenuState,
		getCurrentState,
		updateMenuState,
		changeLanguage
	};

})();
