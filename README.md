# Sala Interactiva - BrightSign

Sistema de control maestro-esclavo para BrightSign que gestiona la navegación sincronizada de contenido interactivo en múltiples pantallas.

## 📋 Descripción General

Este proyecto implementa un sistema de sincronización para dispositivos BrightSign donde:

- Un dispositivo **Master** recibe comandos de un control remoto USB
- Múltiples dispositivos **Slave** se conectan al master vía WebSocket
- Todos los dispositivos muestran iframes sincronizados de una aplicación web
- La navegación y reproducción de videos se ejecutan en el mismo instante en todos los dispositivos

## 🏗️ Arquitectura

```
┌─────────────┐
│   Control   │
│   Remoto    │
│    USB      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│      Master BrightSign          │
│  - Recibe teclas del control    │
│  - Gestiona estado del menú     │
│  - Calcula exactStartTime       │
│  - WebSocket Server (port 8081) │
│  - Muestra iframe (proyector 0) │
└────────┬────────────────────────┘
         │
         │ WebSocket
         ├──────────────┬──────────────┐
         ▼              ▼              ▼
    ┌─────────┐    ┌─────────┐   ┌─────────┐
    │ Slave 1 │    │ Slave 2 │   │ Slave N │
    │(proj 1) │    │(proj 2) │   │(proj N) │
    └─────────┘    └─────────┘   └─────────┘
```

└────────────────┘ └────────────────┘

```

## 📁 Estructura del Proyecto

```

sala-interactiva-brightsign/
├── master/ # BrightSign Master
│ ├── autorun.brs # Punto de entrada BrightScript
│ ├── config.json # Configuración del master
│ ├── events.json # Configuración de eventos
│ ├── index.html # HTML principal
│ ├── js/
│ │ ├── main.js # Coordinador principal
│ │ ├── remote-control.js # Control remoto USB
│ │ ├── sync.js # Sincronización de videos
│ │ ├── slave-server.js # Servidor WebSocket para slaves
│ │ ├── player.js # Reproductor de video
│ │ ├── clock.js # Reloj del sistema
│ │ └── utils.js # Utilidades
│ ├── media/ # Videos para reproducir
│ │ ├── video1.mp4
│ │ ├── video2.mp4
│ │ └── ...
│ └── styles/
│ └── main.css
│
├── slave/ # BrightSign Slaves
│ ├── autorun.brs # Punto de entrada BrightScript
│ ├── config.json # Configuración del slave
│ ├── events.json # Configuración de eventos
│ ├── index.html # HTML principal
│ ├── js/
│ │ ├── main.js # Coordinador principal
│ │ ├── player.js # Reproductor sincronizado
│ │ ├── master-connection.js # Conexión WebSocket al master
│ │ ├── clock.js # Reloj sincronizado
│ │ ├── clock-sync.js # Sincronización de reloj
│ │ └── utils.js # Utilidades
│ ├── media/ # MISMOS videos que el master
│ │ ├── video1.mp4
│ │ ├── video2.mp4
│ │ └── ...
│ └── styles/
│ └── main.css
│
└── setup/ # Configuración de red (opcional)
├── autorun.brs
├── setup.json
└── ...

````

## ⚙️ Configuración

### Master (`master/config.json`)

```json
{
  "master": {
    "slaveServerPort": 8081,
    "syncDelayMs": 800,
    "maxSyncAttempts": 5
  },
  "externalApp": {
    "url": "http://192.168.1.9:5173"
  }
}
````

- **`slaveServerPort`**: Puerto del servidor WebSocket para slaves
- **`syncDelayMs`**: Buffer mínimo de sincronización (ms) - Aumentar si videos no sincronizan
- **`externalApp.url`**: URL del menú panorámico 360° (React app)

### Slave (`slave/config.json`)

```json
{
  "deviceId": "slave-01",
  "masterHost": "192.168.1.100",
  "masterPort": 8081,
  "reconnectDelay": 2000,
  "heartbeatInterval": 3000,
  "externalApp": {
    "url": "http://192.168.1.9:5173"
  }
}
```

- **`deviceId`**: Identificador único del slave
- **`masterHost`**: IP del BrightSign master
- **`masterPort`**: Puerto del servidor WebSocket del master
- **`reconnectDelay`**: Tiempo entre intentos de reconexión (ms)

## 🎮 Control Remoto (Teclas)

| Tecla        | Código | Función                             |
| ------------ | ------ | ----------------------------------- |
| **M**        | 109    | Mostrar/Ocultar menú (toggle)       |
| **Flecha ←** | 32848  | Navegar al hotspot anterior         |
| **Flecha →** | 32847  | Navegar al hotspot siguiente        |
| **Enter**    | 13     | Reproducir video del hotspot actual |
| **Escape**   | 27     | Detener video y volver al menú      |

**Nota**: La tecla M funciona como toggle:

- Si el menú está oculto → Lo muestra
- Si el menú está visible → Lo oculta y vuelve a pantalla de sincronización

## 🚀 Flujo de Funcionamiento

### 1. Inicio del Sistema

```
1. Master inicia → Pantalla de sincronización visible
2. Slaves inician → Se conectan al master vía WebSocket
3. Slaves sincronizados → Menú se abre automáticamente en todos
```

### 2. Navegación del Menú

```
1. Usuario presiona Flecha → / ←
2. Master reenvía evento al iframe local
3. Master envía comando navigate_iframe a slaves
4. Slaves reenvían evento a sus iframes
5. Todos navegan sincronizadamente
```

### 3. Reproducción de Video

```
1. Usuario presiona Enter en hotspot
2. Master solicita video al iframe: postMessage('request_current_video')
3. iframe responde con video_response: { videoFile, hotspotId, label }
4. Master programa reproducción exacta (T + 1.5s)
5. Master envía sync_exact_start a slaves con tiempo T
6. Slaves cargan video y esperan hasta tiempo T
7. Master carga video y espera hasta tiempo T
8. En tiempo T: Todos reproducen sincronizadamente (±5ms)
9. Video termina → Todos vuelven al menú automáticamente
```

### 4. Volver al Menú (Escape)

```
1. Usuario presiona Escape
2. Master detiene video y muestra menú
3. Master envía show_menu_only a slaves
4. Slaves detienen video y muestran menú
5. Todos mantienen el hotspot actual (no recargan)
```

## 📦 Instalación

### Requisitos

- BrightSign OS 8.x o superior
- Node.js modules instalados en BrightSign:
  - `ws` (WebSocket)
  - `http`
- Red local configurada (todos los dispositivos en misma subnet)
- Aplicación React 360-panoramic corriendo en servidor local

### Pasos

1. **Configurar red**:

   ```
   Master: 192.168.1.100
   Slave 1: 192.168.1.101
   Slave 2: 192.168.1.102
   ...
   Servidor React: 192.168.1.9:5173
   ```

2. **Configurar archivos**:

   - Editar `master/config.json` con la IP del servidor React
   - Editar cada `slave/config.json` con:
     - `deviceId` único
     - IP del master en `masterHost`

3. **Copiar videos**:

   - Copiar TODOS los videos a `master/media/`
   - Copiar los MISMOS videos a `slave/media/` de cada slave
   - Los nombres deben coincidir exactamente

4. **Configurar mapeo de videos**:

   - Editar `/360-panoramic/public/video-mapping.json`
   - Asociar cada hotspot con su archivo de video

5. **Copiar a SD**:

   - Copiar carpeta `master/` a SD del BrightSign master
   - Copiar carpeta `slave/` a SD de cada BrightSign slave

6. **Iniciar**:
   - Conectar control remoto USB al master
   - Encender todos los dispositivos
   - Esperar sincronización (menú aparece automáticamente)

## 🔧 Desarrollo

### Agregar Nuevo Video

1. Agregar archivo a `master/media/video-nuevo.mp4`
2. Copiar a `slave/media/video-nuevo.mp4` en TODOS los slaves
3. Actualizar `/360-panoramic/public/video-mapping.json`:
   ```json
   {
     "hotspots": {
       "hotspot-6": {
         "videoFile": "video-nuevo.mp4",
         "label": "Nuevo Video"
       }
     }
   }
   ```

### Agregar Nuevo Slave

1. Copiar carpeta `slave/` a nueva SD
2. Editar `config.json`:
   ```json
   {
     "deviceId": "slave-XX",
     "masterHost": "192.168.1.100",
     ...
   }
   ```
3. Copiar todos los videos a `media/`
4. Configurar IP estática en el BrightSign
5. Iniciar dispositivo

### Logs y Debugging

El sistema mantiene logs mínimos enfocados en errores críticos:

```javascript
// Master logs principales
[MAIN] Sistema inicializado
[SLAVE-SERVER] Servidor activo en puerto 8081
[REMOTE] Error toggleExternalContent: ...
[CONTROL] Error: ...

// Slave logs principales
[MAIN] Slave device iniciando
[MASTER] Conectado
[VIDEO] Error: SRC_NOT_SUPPORTED
[SLAVE] Error showExternalApp: ...
```

**Nota**: Se eliminaron logs verbosos de timing y navegación para mantener el código limpio. Solo se registran errores y eventos críticos del sistema.

## 🐛 Troubleshooting

### Los slaves no se conectan

- Verificar que todos están en la misma red
- Verificar firewall no bloquea puerto 8081
- Verificar IP del master en `slave/config.json`
- Revisar logs de conexión en pantalla del slave

### Videos no sincronizados

- Verificar que los archivos de video existen en todos los dispositivos
- Aumentar `syncDelayMs` en `master/config.json` (probar con 2000)
- Verificar que todos los dispositivos tienen red estable
- La sincronización usa requestAnimationFrame para precisión de ±5ms
- Todos los dispositivos (master y slaves) inician reproducción al mismo tiempo

### Menú no aparece automáticamente

- Verificar que `externalApp.url` es correcta en configs
- Verificar que servidor React está corriendo en 192.168.1.9:5173
- Verificar que slaves están conectados al master (WebSocket)
- El menú aparece inmediatamente cuando el primer slave se sincroniza
- Probar abrir manualmente con tecla M

### Slave vuelve al punto 1 del menú

- Esto es correcto cuando se usa `show_external_app` (sincronización inicial)
- Para mantener posición: se usa `show_menu_only` (al terminar video o Escape)
- Verificar que iframe no se recarga en `showMenuOnly()`
- El hotspot actual se mantiene solo si no se recarga el iframe

### Video no reproduce

- Verificar que archivo existe en `media/` con nombre exacto
- Verificar mapeo en `/360-panoramic/public/video-mapping.json`
- Verificar formato de video (MP4, H.264, AAC)
- Revisar logs para errores de carga

## 📝 Notas Técnicas

### Sincronización de Reloj

El sistema usa múltiples técnicas para sincronización precisa:

1. **Offset de tiempo**: Calcula diferencia entre master y slave
2. **Timestamps múltiples**: `Date.now()` y `performance.now()`
3. **Buffer de sincronización**: Mínimo 1.5 segundos para coordinación
4. **RequestAnimationFrame**: Para inicio exacto en el frame correcto

### Gestión de Estado del Menú

- `show_external_app`: Recarga iframe (para sincronización inicial)
- `show_menu_only`: Solo muestra sin recargar (mantiene estado)
- `hide_external_app`: Oculta para volver a sync screen

### Código Limpio y Mantenible

El código ha sido optimizado para:

- **Logs mínimos**: Solo errores críticos (sin logs de timing, keycodes, o contadores)
- **Código conciso**: Uso de optional chaining (`?.`) y early returns
- **Sincronización precisa**: ±5ms usando requestAnimationFrame
- **Arquitectura clara**: Separación entre coordinación (master) y reproducción (slaves)
- **Sin verbosidad**: Eliminados ~340 líneas de logs y comentarios redundantes

**Archivos principales limpiados:**

- `master/js/remote-control.js` (319→245 líneas)
- `master/js/sync.js` (361→265 líneas)
- `master/js/slave-server.js` (244→197 líneas)
- `slave/js/main.js` (156→114 líneas)
- `slave/js/player.js` (193→149 líneas)

### Comunicación PostMessage

**Master solicita video al iframe:**

```javascript
iframe.contentWindow.postMessage(
  {
    type: "request_current_video",
  },
  "*"
);
```

**iframe responde con video:**

```javascript
event.source.postMessage(
  {
    type: "video_response",
    videoFile: "video1.mp4",
    hotspotId: "hotspot-1",
    label: "Point of Interest #1",
  },
  { targetOrigin: "*" }
);
```

**Master envía eventos de navegación al iframe:**

```javascript
iframe.contentWindow.postMessage(
  {
    type: "keydown",
    keyCode: 32847, // Flecha derecha
  },
  "*"
);
```

## 📄 Licencia

Proyecto interno JW Bethel - Sala Interactiva

## 👥 Contacto

Para soporte técnico, contactar al equipo de desarrollo de Bethel.
