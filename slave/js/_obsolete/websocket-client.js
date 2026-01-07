/**
 * WebSocket Client for BrightSign devices
 * Connects to centralized WebSocket server and handles communication
 */

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 3000;
    this.isIntentionalClose = false;
    this.projectorIndex = null;
    this.serverUrl = null;
    this.isConnected = false;
    
    // Event handlers
    this.onConnectHandler = null;
    this.onDisconnectHandler = null;
    this.onErrorHandler = null;
  }

  /**
   * Initialize WebSocket connection
   * @param {string} serverUrl - WebSocket server URL (e.g., "ws://192.168.1.10:8765")
   * @param {number} projectorIndex - Index of this projector (1-6)
   */
  connect(serverUrl, projectorIndex) {
    if (!serverUrl) {
      console.error("[WebSocket] Server URL is required");
      return;
    }

    if (!projectorIndex || projectorIndex < 1 || projectorIndex > 6) {
      console.error("[WebSocket] Invalid projector index:", projectorIndex);
      return;
    }

    this.serverUrl = serverUrl;
    this.projectorIndex = projectorIndex;
    this.isIntentionalClose = false;

    console.log("[WebSocket] Connecting to:", serverUrl, "as projector", projectorIndex);

    try {
      this.socket = new WebSocket(serverUrl);

      this.socket.onopen = () => {
        console.log("[WebSocket] ✅ Connected");
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Register as BrightSign device
        this.emit("register", {
          type: "brightsign",
          projectorIndex: this.projectorIndex
        });

        if (this.onConnectHandler) {
          this.onConnectHandler();
        }
      };

      this.socket.onclose = (event) => {
        console.log("[WebSocket] ❌ Disconnected", event.code, event.reason);
        this.isConnected = false;

        if (this.onDisconnectHandler) {
          this.onDisconnectHandler();
        }

        // Attempt reconnection if not intentional
        if (!this.isIntentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(
            "[WebSocket] Reconnecting in",
            this.reconnectDelay,
            "ms (attempt",
            this.reconnectAttempts,
            "of",
            this.maxReconnectAttempts,
            ")"
          );
          setTimeout(() => {
            this.connect(this.serverUrl, this.projectorIndex);
          }, this.reconnectDelay);
        }
      };

      this.socket.onerror = (error) => {
        console.error("[WebSocket] ⚠️ Error:", error);
        if (this.onErrorHandler) {
          this.onErrorHandler(error);
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          console.error("[WebSocket] Failed to parse message:", err);
        }
      };

    } catch (error) {
      console.error("[WebSocket] Failed to create socket:", error);
      if (this.onErrorHandler) {
        this.onErrorHandler(error);
      }
    }
  }

  /**
   * Handle incoming WebSocket messages
   * @param {Object} data - Parsed message data
   */
  handleMessage(data) {
    // Override this method or use on() to handle specific events
    console.log("[WebSocket] 📨 Received:", data);
  }

  /**
   * Emit event to server
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  emit(event, data) {
    if (!this.socket || !this.isConnected) {
      console.warn("[WebSocket] Cannot emit, socket not connected");
      return false;
    }

    try {
      const message = JSON.stringify({ event, data });
      this.socket.send(message);
      return true;
    } catch (error) {
      console.error("[WebSocket] Failed to emit:", error);
      return false;
    }
  }

  /**
   * Close WebSocket connection
   */
  disconnect() {
    console.log("[WebSocket] Disconnecting...");
    this.isIntentionalClose = true;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }

  /**
   * Set connection event handler
   * @param {Function} handler - Callback when connected
   */
  onConnect(handler) {
    this.onConnectHandler = handler;
  }

  /**
   * Set disconnection event handler
   * @param {Function} handler - Callback when disconnected
   */
  onDisconnect(handler) {
    this.onDisconnectHandler = handler;
  }

  /**
   * Set error event handler
   * @param {Function} handler - Callback on error
   */
  onError(handler) {
    this.onErrorHandler = handler;
  }
}
