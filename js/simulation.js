/**
 * Virtual Factory AI Assistant - Simulation Engine
 * Handles all simulation logic, sensors, scenarios, and state management
 */

class FactorySimulation {
    constructor() {
        this.state = CONFIG.STATES.NORMAL;
        this.stability = 100;
        
        // Sensors (nominal values above warning thresholds)
        this.sensors = {
            power: 42.0,      // Nominal ~42 kW (above 38 warning)
            pressure: 140.0,  // Nominal ~140 bar (above 135 warning)
            temperature: 70.0 // Nominal ~70°C (below 75 warning)
        };
        
        // Previous sensor values for delta calculation
        this.previousSensors = { ...this.sensors };
        
        // System settings
        this.cooling = CONFIG.COOLING.DEFAULT;
        this.backupPower = false;

        // Battery levels (0-100%)
        this.mainBatteryLevel = 100;
        this.backupBatteryLevel = 100;
        this.batteryRechargeRate = 2; // % per tick when recharging

        // Scenario management
        this.activeScenario = {
            type: CONFIG.SCENARIOS.NONE,
            active: false,
            tickCount: 0,
            duration: 0
        };
        
        // Timing
        this.startTime = Date.now();
        this.tickCount = 0;
        this.criticalTickCount = 0;
        this.stableTickCount = 0;
        // Initialize to current time so first scenario waits for SCENARIO_DELAY after startup
        this.lastScenarioEndTime = Date.now();
        this.scenarioScheduled = false;

        // History for trend detection
        this.sensorHistory = [];

        // Tick interval
        this.tickInterval = null;
    }
    
    start() {
        console.log('🏭 Factory simulation started');
        this.tickInterval = setInterval(() => this.tick(), CONFIG.SIMULATION.TICK_INTERVAL);
    }
    
    stop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }
    
    tick() {
        this.tickCount++;
        const elapsed = Date.now() - this.startTime;
        
        // Store previous values for delta calculation
        this.previousSensors = { ...this.sensors };
        
        // Scenario management
        this.manageScenarios(elapsed);
        
        // Update sensors based on active scenario
        this.updateSensors();
        
        // Calculate stability score
        this.calculateStability();
        
        // Determine state based on stability
        this.updateState();
        
        // Auto-stop if critical for too long
        this.checkAutoStop();
        
        // Store in history
        this.sensorHistory.push({
            time: Date.now(),
            ...this.sensors,
            stability: this.stability,
            state: this.state
        });
        
        // Keep only recent history
        if (this.sensorHistory.length > CONFIG.CHARTS.MAX_DATA_POINTS) {
            this.sensorHistory.shift();
        }
        
        // Emit tick event
        this.emitTelemetry();
    }
    
    manageScenarios(elapsed) {
        // During startup period, no scenarios - but track stable ticks
        if (elapsed < CONFIG.SIMULATION.STARTUP_STABLE_DURATION) {
            this.stableTickCount++;
            return;
        }

        // If paused, don't trigger new scenarios
        if (this.state === CONFIG.STATES.PAUSED) {
            return;
        }

        // If scenario is scheduled via setTimeout, don't interfere
        if (this.scenarioScheduled) {
            return;
        }

        // If no active scenario, check if we should start one
        if (!this.activeScenario.active) {
            // Check if enough time has passed since last scenario (or startup)
            const timeSinceLastScenario = Date.now() - this.lastScenarioEndTime;
            if (timeSinceLastScenario >= CONFIG.SIMULATION.SCENARIO_DELAY) {
                console.log('🎬 Starting scenario after delay');
                this.startRandomScenario();
            }
        } else {
            // Scenario is active, increment tick count
            this.activeScenario.tickCount++;
        }
    }
    
    startRandomScenario() {
        const scenarios = [
            CONFIG.SCENARIOS.POWER_SAG,
            CONFIG.SCENARIOS.PRESSURE_DRIFT,
            CONFIG.SCENARIOS.OVERHEAT
        ];
        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

        this.activeScenario = {
            type: scenario,
            active: true,
            tickCount: 0
        };

        console.log(`🚨 Scenario started: ${scenario}`);
    }
    
    updateSensors() {
        // NEVER skip sensor updates - even when paused, we want to see current values

        const scenario = this.activeScenario.active ? this.activeScenario.type : null;

        // === BATTERY RECHARGING ===
        // The inactive battery slowly recharges
        if (this.backupPower) {
            // Main battery is inactive, recharge it
            if (this.mainBatteryLevel < 100) {
                this.mainBatteryLevel = Math.min(100, this.mainBatteryLevel + this.batteryRechargeRate);
            }
        } else {
            // Backup battery is inactive, recharge it
            if (this.backupBatteryLevel < 100) {
                this.backupBatteryLevel = Math.min(100, this.backupBatteryLevel + this.batteryRechargeRate);
            }
        }

        // === POWER ===
        if (scenario === CONFIG.SCENARIOS.POWER_SAG) {
            // Scenario: power drops - affects the currently connected battery
            const drop = Math.random() * 4 + 2;
            this.sensors.power -= drop;

            // Battery drain affects the active battery
            const batteryDrain = Math.random() * 8 + 5; // 5-13% per tick
            if (this.backupPower) {
                this.backupBatteryLevel = Math.max(0, this.backupBatteryLevel - batteryDrain);
                console.log(`⚡ Power sag: -${drop.toFixed(1)} kW → ${this.sensors.power.toFixed(1)} kW | Backup battery: ${this.backupBatteryLevel.toFixed(0)}%`);
            } else {
                this.mainBatteryLevel = Math.max(0, this.mainBatteryLevel - batteryDrain);
                console.log(`⚡ Power sag: -${drop.toFixed(1)} kW → ${this.sensors.power.toFixed(1)} kW | Main battery: ${this.mainBatteryLevel.toFixed(0)}%`);
            }
        }

        // === PRESSURE ===
        if (scenario === CONFIG.SCENARIOS.PRESSURE_DRIFT) {
            // Scenario: pressure drops
            const drop = Math.random() * 3 + 2;
            this.sensors.pressure -= drop;
            console.log(`💨 Pressure drift: -${drop.toFixed(1)} bar → ${this.sensors.pressure.toFixed(1)} bar`);           
        }

        // === TEMPERATURE ===
        if (scenario === CONFIG.SCENARIOS.OVERHEAT) {
            // Scenario: temperature rises
            const rise = Math.random() * 2 + 2; // 2-4°C per tick
            this.sensors.temperature += rise;
            console.log(`🌡️ Overheat: +${rise.toFixed(1)}°C → ${this.sensors.temperature.toFixed(1)}°C`);
       }
        // Normal: fluctuate ±1 kW (max 2 kW total)
        this.sensors.power += (Math.random() - 0.5) * 2;
        // Normal: fluctuate ±0.5°C (max 1°C total)
        this.sensors.temperature += (Math.random() - 0.5) * 1;
        // Normal: fluctuate ±1 bar (max 2 bar total)
        this.sensors.pressure += (Math.random() - 0.5) * 2;
        // Clamp to hardware limits
        this.sensors.power = Math.max(0, Math.min(100, this.sensors.power));
        this.sensors.pressure = Math.max(100, Math.min(200, this.sensors.pressure));
        this.sensors.temperature = Math.max(20, Math.min(120, this.sensors.temperature));

        // Debug log


        console.log(`📊 Sensors: P=${this.sensors.power.toFixed(1)}kW, Pr=${this.sensors.pressure.toFixed(1)}bar, T=${this.sensors.temperature.toFixed(1)}°C | scenario=${scenario || 'none'}`);
    }

    endScenario() {
        console.log(`✅ Scenario ended: ${this.activeScenario.type}`);
        // Just use endScenarioAndScheduleNext for consistent behavior
        this.endScenarioAndScheduleNext();
    }

    calculateStability() {
        let score = 100;

        // Check each sensor for warnings and criticals
        const powerStatus = this.getSensorStatus('power');
        const pressureStatus = this.getSensorStatus('pressure');
        const tempStatus = this.getSensorStatus('temperature');

        // Apply penalties
        if (powerStatus === 'warning' || pressureStatus === 'warning' || tempStatus === 'warning') {
            score -= CONFIG.STABILITY.PENALTY_WARNING;
        }
        if (powerStatus === 'critical' || pressureStatus === 'critical' || tempStatus === 'critical') {
            score -= CONFIG.STABILITY.PENALTY_CRITICAL;
        }

        // Check for worsening trends
        if (this.sensorHistory.length >= 2) {
            const prev = this.sensorHistory[this.sensorHistory.length - 1];
            const powerTrend = this.sensors.power - prev.power;
            const pressureTrend = this.sensors.pressure - prev.pressure;
            const tempTrend = this.sensors.temperature - prev.temperature;

            if ((powerTrend < 0 && this.sensors.power < CONFIG.SENSORS.POWER.NOMINAL_MIN) ||
                (pressureTrend < 0 && this.sensors.pressure < CONFIG.SENSORS.PRESSURE.NOMINAL_MIN) ||
                (tempTrend > 0 && this.sensors.temperature > CONFIG.SENSORS.TEMPERATURE.NOMINAL_MAX)) {
                score -= CONFIG.STABILITY.PENALTY_TREND;
            }
        }

        this.stability = Math.max(0, Math.min(100, score));
    }

    getSensorStatus(sensorName) {
        const value = this.sensors[sensorName];
        const config = CONFIG.SENSORS[sensorName.toUpperCase()];

        if (sensorName === 'temperature') {
            // Temperature: only check HIGH (overheating)
            if (value >= config.CRITICAL_THRESHOLD) return 'critical';
            if (value >= config.WARNING_THRESHOLD) return 'warning';
            return 'normal';
        } else {
            // Power & Pressure: only check LOW (drops)
            if (value <= config.CRITICAL_LOW) return 'critical';
            if (value <= config.WARNING_LOW) return 'warning';
            return 'normal';
        }
    }

    updateState() {
        if (this.state === CONFIG.STATES.PAUSED) {
            return; // Don't auto-change from paused
        }

        if (this.stability >= CONFIG.STABILITY.THRESHOLD_NORMAL) {
            this.state = CONFIG.STATES.NORMAL;
            this.stableTickCount++;
        } else if (this.stability >= CONFIG.STABILITY.THRESHOLD_DEGRADED) {
            this.state = CONFIG.STATES.DEGRADED;
            this.stableTickCount = 0;
        } else {
            this.state = CONFIG.STATES.CRITICAL;
            this.stableTickCount = 0;
        }
    }

    checkAutoStop() {
        if (!CONFIG.AUTO_STOP.ENABLED) return;

        if (this.state === CONFIG.STATES.CRITICAL) {
            this.criticalTickCount++;
            if (this.criticalTickCount >= CONFIG.AUTO_STOP.CRITICAL_TICKS) {
                console.log('⚠️ Auto-stop triggered: Critical for too long');
                this.pauseLine();
            }
        } else {
            this.criticalTickCount = 0;
        }
    }

    emitTelemetry() {
        const deltas = {
            powerDelta: this.sensors.power - this.previousSensors.power,
            pressureDelta: this.sensors.pressure - this.previousSensors.pressure,
            tempDelta: this.sensors.temperature - this.previousSensors.temperature
        };

        const telemetry = {
            timestamp: Date.now(),
            state: this.state,
            stability: this.stability,
            sensors: { ...this.sensors },
            cooling: this.cooling,
            backupPower: this.backupPower,
            mainBatteryLevel: this.mainBatteryLevel,
            backupBatteryLevel: this.backupBatteryLevel,
            scenario: {
                active: this.activeScenario.active,
                type: this.activeScenario.type
            },
            deltas
        };

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('telemetry', { detail: telemetry }));
    }

    // Operator Actions - Gradual recovery with realistic timing

    switchBackupPower() {
        this.backupPower = true;

        // When switching to backup, immediately restore main battery to full
        // (simulates that the offline battery is now at full charge / ready for next use)
        this.mainBatteryLevel = 100;

        console.log('🔋 Backup power activated - main battery reset to 100%, restoring power in 2s...');

        // 2 second delay then restore power
        setTimeout(() => {
            this.sensors.power = 42; // Nominal power ~42 kW (above 38 warning)
            this.endScenarioAndScheduleNext();
            console.log(`🔋 Power restored to 42 kW`);
        }, 2000);

        return { success: true, message: 'Backup power activated' };
    }

    increasePressure() {
        console.log('📈 Increasing pressure - restoring over 5s...');
        this.gradualRestore('pressure', 5000);
        return { success: true, message: 'Increasing pressure...' };
    }

    decreasePressure() {
        console.log('📉 Decreasing pressure - restoring over 5s...');
        this.gradualRestore('pressure', 5000);
        return { success: true, message: 'Decreasing pressure...' };
    }

    increaseCooling() {
        console.log('❄️ Increasing cooling - temperature dropping over 10s...');
        this.gradualRestore('temperature', 10000);
        return { success: true, message: 'Cooling system engaged...' };
    }

    // Gradual restore helper - smoothly returns sensor to nominal over duration
    gradualRestore(sensorType, duration) {
        const steps = 10;
        const interval = duration / steps;
        let step = 0;

        const startValue = this.sensors[sensorType];
        let targetValue;

        // Hardcoded nominal values (above warning thresholds)
        if (sensorType === 'pressure') {
            targetValue = 140; // Nominal ~140 bar (above 135 warning)
        } else if (sensorType === 'temperature') {
            targetValue = 70; // Nominal ~70°C (below 75 warning)
        } else if (sensorType === 'power') {
            targetValue = 42; // Nominal ~42 kW (above 38 warning)
        }

        const stepChange = (targetValue - startValue) / steps;

        const restoreInterval = setInterval(() => {
            step++;
            this.sensors[sensorType] += stepChange;
            console.log(`🔧 ${sensorType}: ${this.sensors[sensorType].toFixed(1)} (step ${step}/${steps})`);

            if (step >= steps) {
                clearInterval(restoreInterval);
                this.sensors[sensorType] = targetValue; // Ensure exact value
                this.endScenarioAndScheduleNext();
                console.log(`✅ ${sensorType} restored to ${targetValue.toFixed(1)}`);
            }
        }, interval);
    }

    // End current scenario, reset state, and schedule next scenario after delay
    endScenarioAndScheduleNext() {
        // End the active scenario
        this.activeScenario = {
            type: CONFIG.SCENARIOS.NONE,
            active: false,
            tickCount: 0,
            duration: 0
        };

        // Reset everything to normal
        this.backupPower = false;
        this.cooling = CONFIG.COOLING.DEFAULT;
        this.state = CONFIG.STATES.NORMAL;
        this.stability = 100;
        this.stableTickCount = 0;
        this.criticalTickCount = 0;
        this.lastScenarioEndTime = Date.now();

        // Reset both batteries to full when system returns to normal
        this.mainBatteryLevel = 100;
        this.backupBatteryLevel = 100;

        // Mark that we're scheduling the next scenario
        this.scenarioScheduled = true;

        const delay = CONFIG.SIMULATION.SCENARIO_DELAY;
        console.log(`✅ System restored to NORMAL - next scenario in ${delay/1000}s`);

        // Schedule next random scenario after delay
        setTimeout(() => {
            this.scenarioScheduled = false;
            console.log(`⏰ ${delay/1000}s passed - starting new scenario`);
            this.startRandomScenario();
        }, delay);
    }

    pauseLine() {
        this.state = CONFIG.STATES.PAUSED;
        this.activeScenario.active = false; // Halt scenario
        console.log('⏸️ Production line paused');
        return { success: true, message: 'Production line paused' };
    }

    resumeLine() {
        // Only resume if currently paused
        if (this.state !== CONFIG.STATES.PAUSED) {
            console.log('ℹ️ Line is not paused');
            return { success: false, message: 'Line is not paused' };
        }

        // Check if sensors are not critical
        const powerStatus = this.getSensorStatus('power');
        const pressureStatus = this.getSensorStatus('pressure');
        const tempStatus = this.getSensorStatus('temperature');

        if (powerStatus === 'critical' || pressureStatus === 'critical' || tempStatus === 'critical') {
            console.log('❌ Cannot resume: Sensors still critical');
            return { success: false, message: 'Cannot resume: Sensors still critical' };
        }

        // Set state based on current stability (bypass the PAUSED check in updateState)
        if (this.stability >= CONFIG.STABILITY.THRESHOLD_NORMAL) {
            this.state = CONFIG.STATES.NORMAL;
        } else if (this.stability >= CONFIG.STABILITY.THRESHOLD_DEGRADED) {
            this.state = CONFIG.STATES.DEGRADED;
        } else {
            this.state = CONFIG.STATES.CRITICAL;
        }

        this.stableTickCount = 0;
        this.criticalTickCount = 0;
        this.lastScenarioEndTime = Date.now(); // Reset scenario timer
        console.log('▶️ Production line resumed, state:', this.state);
        return { success: true, message: `Production line resumed (${this.state})` };
    }

    executeAction(actionType) {
        switch (actionType) {
            case CONFIG.ACTIONS.SWITCH_BACKUP_POWER:
                return this.switchBackupPower();
            case CONFIG.ACTIONS.INCREASE_PRESSURE:
                return this.increasePressure();
            case CONFIG.ACTIONS.DECREASE_PRESSURE:
                return this.decreasePressure();
            case CONFIG.ACTIONS.INCREASE_COOLING:
                return this.increaseCooling();
            case CONFIG.ACTIONS.PAUSE_LINE:
                return this.pauseLine();
            case CONFIG.ACTIONS.RESUME_LINE:
                return this.resumeLine();
            default:
                return { success: false, message: 'Unknown action' };
        }
    }

    getTelemetrySnapshot() {
        return {
            timestamp: Date.now(),
            state: this.state,
            stability: this.stability,
            sensors: { ...this.sensors },
            cooling: this.cooling,
            backupPower: this.backupPower,
            mainBatteryLevel: this.mainBatteryLevel,
            backupBatteryLevel: this.backupBatteryLevel,
            scenario: {
                active: this.activeScenario.active,
                type: this.activeScenario.type
            },
            deltas: {
                powerDelta: this.sensors.power - this.previousSensors.power,
                pressureDelta: this.sensors.pressure - this.previousSensors.pressure,
                tempDelta: this.sensors.temperature - this.previousSensors.temperature
            }
        };
    }
}

// Make simulation globally available
window.FactorySimulation = FactorySimulation;

