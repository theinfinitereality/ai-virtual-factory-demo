/**
 * Virtual Factory AI Assistant - Main Application
 * Orchestrates all components and manages the application lifecycle
 */

class FactoryApp {
    constructor() {
        this.simulation = null;
        this.sceneManager = null;
        this.chartsManager = null;
        this.aiIntegration = null;
    }
    
    async init() {
        console.log('🏭 Virtual Factory AI Assistant - Starting...');

        // Initialize simulation (but don't start yet)
        this.simulation = new FactorySimulation();

        // Initialize 3D scene
        this.sceneManager = new SceneManager('threejs-canvas');
        this.sceneManager.init();

        // Initialize charts
        this.chartsManager = new ChartsManager();
        this.chartsManager.init();

        // Initialize AI integration
        this.aiIntegration = new AIIntegration(this.simulation);
        await this.aiIntegration.init();

        // Set up event listeners
        this.setupEventListeners();

        // Wait for avatar to be ready before starting simulation
        console.log('⏳ Waiting for AI Avatar to be ready...');
        await this.aiIntegration.waitForAvatarReady();
        console.log('🎉 Avatar ready promise resolved! Hiding loading overlay...');

        // Hide the full page loading overlay
        const appLoadingOverlay = document.getElementById('app-loading-overlay');
        console.log('🔍 Loading overlay element:', appLoadingOverlay);
        if (appLoadingOverlay) {
            appLoadingOverlay.classList.add('hidden');
            console.log('✅ Loading overlay hidden');
        }

        // Start simulation after avatar is ready
        this.simulation.start();

        // Start sending telemetry now that everything is ready
        this.aiIntegration.startTelemetry();

        console.log('✅ Virtual Factory AI Assistant - Ready!');
    }
    
    setupEventListeners() {
        // Listen for telemetry updates
        window.addEventListener('telemetry', (event) => {
            const telemetry = event.detail;

            // Update charts
            this.chartsManager.update(telemetry);

            // Update UI elements
            this.updateUI(telemetry);

            // Update 3D scene state
            this.sceneManager.updateState(telemetry.state);

            // Update infrastructure visuals
            if (this.sceneManager.setBackupPowerVisual) {
                this.sceneManager.setBackupPowerVisual(telemetry.backupPower);
            }
            // Update both battery meters
            if (this.sceneManager.updateBatteries) {
                this.sceneManager.updateBatteries(
                    telemetry.mainBatteryLevel,
                    telemetry.backupBatteryLevel,
                    telemetry.backupPower
                );
            }
            if (this.sceneManager.updateTemperatureGauge) {
                this.sceneManager.updateTemperatureGauge(telemetry.sensors.temperature);
            }
            if (this.sceneManager.updatePressureGauge) {
                this.sceneManager.updatePressureGauge(telemetry.sensors.pressure);
            }
            // Update LED status based on factory state
            if (this.sceneManager.updateLEDStatus) {
                this.sceneManager.updateLEDStatus(telemetry.state);
            }
            // Update status lights based on sensor readings
            if (this.sceneManager.updateStatusLights) {
                this.sceneManager.updateStatusLights({
                    powerLevel: telemetry.mainBatteryLevel,
                    backupLevel: telemetry.backupBatteryLevel,
                    oilTemp: telemetry.sensors.temperature,
                    pressure: telemetry.sensors.pressure
                });
            }
        });
    }
    
    updateUI(telemetry) {
        // Update stability score
        const scoreEl = document.getElementById('stability-score');
        if (scoreEl) {
            scoreEl.textContent = Math.round(telemetry.stability);
            scoreEl.style.color = this.getStabilityColor(telemetry.stability);
        }
        
        // Update beacon
        this.updateBeacon(telemetry.state);
    }
    
    updateBeacon(state) {
        const beacon = document.getElementById('beacon');
        const label = document.getElementById('beacon-label');
        
        if (!beacon || !label) return;
        
        // Remove all classes
        beacon.className = 'beacon';
        
        switch (state) {
            case CONFIG.STATES.NORMAL:
                label.textContent = 'NORMAL';
                break;
            case CONFIG.STATES.DEGRADED:
                beacon.classList.add('amber');
                label.textContent = 'DEGRADED';
                break;
            case CONFIG.STATES.CRITICAL:
                beacon.classList.add('red');
                label.textContent = 'CRITICAL';
                break;
            case CONFIG.STATES.PAUSED:
                beacon.classList.add('red', 'flashing');
                label.textContent = 'PAUSED';
                break;
        }
    }
    
    getStabilityColor(stability) {
        if (stability >= CONFIG.STABILITY.THRESHOLD_NORMAL) {
            return CONFIG.COLORS.NORMAL;
        } else if (stability >= CONFIG.STABILITY.THRESHOLD_DEGRADED) {
            return CONFIG.COLORS.DEGRADED;
        } else {
            return CONFIG.COLORS.CRITICAL;
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new FactoryApp();
    await app.init();
    
    // Make app globally available for debugging
    window.factoryApp = app;
});

