// ===== Sincronización de Reloj con Master =====

(function() {

const { log } = window.SlaveUtils;

class ClockSync {
  constructor() {
    this.masterTimeOffset = 0;
    this.clockSynced = false;
    this.syncPrecision = 0;
    this.lastSyncTime = 0;
    this.syncResults = [];
    this.pendingSyncRequest = null;
    this.syncTimeout = null;
    this.continuousSyncTimer = null;
    this.syncMaintenanceInterval = 8000;
    this.syncDriftThreshold = 25;
    this.syncQualityHistory = [];
    this.pendingMaintenanceSync = null;
  }

  performClockSync(initialMessage, masterWs) {
    log('[SYNC] Iniciando sincronización de reloj');
    
    this.masterWs = masterWs;
    this.syncResults = [];
    this.pendingSyncRequest = null;
    
    const syncAttempts = 7;
    let currentAttempt = 0;

    const performSyncRound = () => {
      if (currentAttempt >= syncAttempts) {
        this.finalizeClockSync(this.syncResults);
        return;
      }

      const requestTime = Date.now();
      const syncId = Math.random().toString(36).substr(2, 9);
      
      masterWs.send(JSON.stringify({
        type: 'time_sync_request',
        clientTime: requestTime,
        deviceId: window.deviceConfig.deviceId,
        syncId: syncId,
        attempt: currentAttempt + 1
      }));

      this.pendingSyncRequest = {
        requestTime: requestTime,
        syncId: syncId,
        attempt: currentAttempt
      };

      currentAttempt++;
      setTimeout(performSyncRound, 25);
    };

    if (initialMessage && initialMessage.serverTime) {
      const receivedAt = Date.now();
      const initialOffset = initialMessage.serverTime - receivedAt;
      this.syncResults.push({
        offset: initialOffset,
        roundTrip: 0,
        precision: Math.abs(initialOffset)
      });
    }

    setTimeout(performSyncRound, 50);
  }

  handleSyncResponse(message) {
    const responseTime = Date.now();
    
    if (this.pendingMaintenanceSync && this.pendingMaintenanceSync.syncId === message.syncId) {
      this.handleMaintenanceSync(message);
      return;
    }
    
    if (!this.pendingSyncRequest || this.pendingSyncRequest.syncId !== message.syncId) {
      return;
    }

    const roundTripTime = responseTime - this.pendingSyncRequest.requestTime;
    const networkDelay = roundTripTime / 2;
    const offsetMethod1 = (message.serverTime + networkDelay) - responseTime;
    const processingDelay = Math.min(roundTripTime * 0.1, 5);
    const offsetMethod2 = message.serverTime - (this.pendingSyncRequest.requestTime + networkDelay + processingDelay);
    const offsetMethod3 = message.serverTime - responseTime;
    
    const offsets = [offsetMethod1, offsetMethod2, offsetMethod3];
    const selectedOffset = offsets.reduce((a, b) => Math.abs(a) < Math.abs(b) ? a : b);

    this.syncResults.push({
      offset: selectedOffset,
      roundTrip: roundTripTime,
      precision: Math.abs(selectedOffset),
      attempt: this.pendingSyncRequest.attempt + 1
    });

    const networkDelayElement = document.getElementById('networkDelay');
    if (networkDelayElement) {
      networkDelayElement.textContent = `${roundTripTime.toFixed(1)}ms`;
    }

    this.pendingSyncRequest = null;
  }

  finalizeClockSync(syncResults) {
    if (syncResults.length === 0) {
      log('[SYNC] Error: No se obtuvieron mediciones');
      this.updateSyncStatus('No Data', false);
      return;
    }

    let filteredResults = syncResults.filter(result => result.roundTrip < 100);
    if (filteredResults.length < 3 && syncResults.length >= 3) {
      filteredResults = syncResults.filter(result => result.roundTrip < 200);
    }
    
    if (filteredResults.length === 0) {
      this.masterTimeOffset = syncResults[0].offset;
      this.syncPrecision = 100;
    } else {
      const offsets = filteredResults.map(r => r.offset);
      const meanOffset = offsets.reduce((a, b) => a + b, 0) / offsets.length;
      const stdDev = Math.sqrt(offsets.reduce((sum, offset) => sum + Math.pow(offset - meanOffset, 2), 0) / offsets.length);
      
      const cleanResults = filteredResults.filter(result => Math.abs(result.offset - meanOffset) <= 1.5 * stdDev);
      const finalResults = cleanResults.length >= 2 ? cleanResults : filteredResults;
      
      let totalWeight = 0;
      let weightedOffset = 0;

      finalResults.forEach(result => {
        const latencyWeight = Math.exp(-result.roundTrip / 20);
        const consistencyWeight = 1 / (1 + Math.abs(result.offset - meanOffset));
        const combinedWeight = latencyWeight * consistencyWeight;
        weightedOffset += result.offset * combinedWeight;
        totalWeight += combinedWeight;
      });

      this.masterTimeOffset = totalWeight > 0 ? weightedOffset / totalWeight : meanOffset;
      
      const finalOffsets = finalResults.map(r => r.offset);
      const finalMean = finalOffsets.reduce((a, b) => a + b, 0) / finalOffsets.length;
      const variance = finalOffsets.reduce((sum, offset) => sum + Math.pow(offset - finalMean, 2), 0) / finalOffsets.length;
      this.syncPrecision = Math.max(Math.sqrt(variance), 2);
    }

    this.clockSynced = true;
    this.lastSyncTime = Date.now();

    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }

    log(`[SYNC] ✅ Reloj sincronizado: offset ${this.masterTimeOffset.toFixed(2)}ms, precisión ±${this.syncPrecision.toFixed(2)}ms`);
    this.updateSyncStatus(`±${this.syncPrecision.toFixed(0)}ms`, true);
    
    setTimeout(() => {
      this.startContinuousSync(this.masterWs);
    }, 2000);
  }

  startContinuousSync(masterWs) {
    this.stopContinuousSync();
    if (!masterWs || masterWs.readyState !== 1) return;

    this.masterWs = masterWs;
    this.continuousSyncTimer = setInterval(() => {
      this.performMaintenanceSync();
    }, this.syncMaintenanceInterval);

    setTimeout(() => this.performMaintenanceSync(), 5000);
  }

  stopContinuousSync() {
    if (this.continuousSyncTimer) {
      clearInterval(this.continuousSyncTimer);
      this.continuousSyncTimer = null;
    }
  }

  performMaintenanceSync() {
    if (!this.masterWs || this.masterWs.readyState !== 1) {
      this.stopContinuousSync();
      return;
    }

    const syncId = Math.random().toString(36).substr(2, 9);
    this.masterWs.send(JSON.stringify({
      type: 'time_sync_request',
      clientTime: Date.now(),
      deviceId: window.deviceConfig.deviceId,
      syncId: syncId,
      maintenance: true
    }));

    this.pendingMaintenanceSync = {
      requestTime: Date.now(),
      syncId: syncId
    };
  }

  handleMaintenanceSync(message) {
    if (!this.pendingMaintenanceSync || this.pendingMaintenanceSync.syncId !== message.syncId) {
      return;
    }

    const responseTime = Date.now();
    const roundTripTime = responseTime - this.pendingMaintenanceSync.requestTime;
    const networkDelay = roundTripTime / 2;
    const adjustedServerTime = message.serverTime + networkDelay;
    const currentOffset = adjustedServerTime - responseTime;
    const offsetDrift = Math.abs(currentOffset - this.masterTimeOffset);
    
    this.syncQualityHistory.push({
      timestamp: responseTime,
      offset: currentOffset,
      drift: offsetDrift,
      roundTrip: roundTripTime
    });

    if (this.syncQualityHistory.length > 10) {
      this.syncQualityHistory.shift();
    }

    this.updateSyncQuality();

    if (offsetDrift > this.syncDriftThreshold) {
      log(`[SYNC] Resincronizando: drift ${offsetDrift.toFixed(1)}ms`);
      this.performQuickResync();
    }

    this.pendingMaintenanceSync = null;
  }

  performQuickResync() {
    this.stopContinuousSync();
    this.syncResults = [];
    let currentAttempt = 0;

    const performQuickSync = () => {
      if (currentAttempt >= 5) {
        this.finalizeQuickSync();
        return;
      }

      const syncId = Math.random().toString(36).substr(2, 9);
      this.masterWs.send(JSON.stringify({
        type: 'time_sync_request',
        clientTime: Date.now(),
        deviceId: window.deviceConfig.deviceId,
        syncId: syncId,
        quickResync: true
      }));

      this.pendingSyncRequest = {
        requestTime: Date.now(),
        syncId: syncId,
        attempt: currentAttempt
      };

      currentAttempt++;
      setTimeout(performQuickSync, 20);
    };

    performQuickSync();
  }

  finalizeQuickSync() {
    if (this.syncResults.length === 0) {
      this.startContinuousSync(this.masterWs);
      return;
    }

    const oldOffset = this.masterTimeOffset;
    this.masterTimeOffset = this.syncResults.reduce((sum, r) => sum + r.offset, 0) / this.syncResults.length;
    const correction = Math.abs(this.masterTimeOffset - oldOffset);

    log(`[SYNC] Resincronización: corrección ${correction.toFixed(2)}ms`);
    this.lastSyncTime = Date.now();
    this.updateSyncStatus(`±${correction.toFixed(0)}ms`, true);

    setTimeout(() => this.startContinuousSync(this.masterWs), 1000);
  }

  updateSyncStatus(precision, synced) {
    const element = document.getElementById('clockSync');
    if (element) {
      element.textContent = synced ? `Synced ${precision}` : (precision || 'Not Synced');
      element.style.color = synced ? '#0f0' : '#f00';
    }
  }

  updateSyncQuality() {
    const element = document.getElementById('syncQuality');
    if (!element || this.syncQualityHistory.length === 0) return;

    const recent = this.syncQualityHistory.slice(-3);
    const avgDrift = recent.reduce((sum, item) => sum + item.drift, 0) / recent.length;
    const maxDrift = Math.max(...recent.map(item => item.drift));

    let quality = 'EXCELLENT', color = '#0f0';
    if (avgDrift > 20 || maxDrift > 50) { quality = 'GOOD'; color = '#ff0'; }
    if (avgDrift > 50 || maxDrift > 100) { quality = 'FAIR'; color = '#f80'; }
    if (avgDrift > 100 || maxDrift > 200) { quality = 'POOR'; color = '#f00'; }

    element.textContent = `${quality} (${avgDrift.toFixed(1)}ms)`;
    element.style.color = color;
  }

  getSyncedTime() {
    return this.clockSynced ? Date.now() + this.masterTimeOffset : Date.now();
  }
}

window.ClockSync = ClockSync;

})();
