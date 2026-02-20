/**
 * Virtual Factory AI Assistant - AI Integration
 * Handles communication with Napster Spaces AI SDK
 */

class AIIntegration {
    constructor(simulation) {
        this.simulation = simulation;
        this.spacesInstance = null;
        this.telemetryInterval = null;
        this.lastAIHash = null;
        this.messageCount = 0;
        this.avatarReadyPromise = null;
        this.avatarReadyResolve = null;

        // State tracking for AI response triggering
        this.lastState = 'NORMAL';
        this.lastAlertKey = 'false-false-false-false-false-false'; // Initialize to normal state key
        this.lastStability = 100;

        // Initialize sensor status tracking as NOMINAL (prevents false alerts on startup)
        this.lastSensorStatus = { power: 'NOMINAL', pressure: 'NOMINAL', temperature: 'NOMINAL' };

        // Skip first few telemetry sends to let system stabilize
        this.telemetrySendCount = 0;
        this.minTelemetryBeforeAlert = 5; // Skip first 5 telemetry sends (10 seconds) for avatar to load
    }

    async init() {
        try {
            if (!window.napsterSpacesSDK) {
                console.error('❌ Napster Spaces SDK not loaded');
                return;
            }

            console.log('🤖 Initializing AI Assistant...');

            // Create a promise that resolves when avatar is ready
            this.avatarReadyPromise = new Promise((resolve) => {
                this.avatarReadyResolve = resolve;
            });

            this.spacesInstance = await window.napsterSpacesSDK.init({
                experienceId: CONFIG.AI.EXPERIENCE_ID,
                container: '#avatar-sdk-container',
                startWithoutPreview: true,
                functionsLibraryId: CONFIG.AI.FUNCTIONS_LIBRARY_ID,
                functions: [CONFIG.AI.FUNCTION_NAME],
                features: {
                    backgroundRemoval: { enabled: true },
                    waveform: { enabled: true, color: '#3b82f6' },
                    inactiveTimeout: { enabled: true, duration: 10 * 60 * 1000 },
                    disclaimer: { enabled: true, text: 'AI-powered factory assistant' }
                },
                onReady: () => {
                    console.log('✅ AI Assistant ready (SDK initialized, waiting for avatar...)');
                },
                onError: (error) => {
                    console.error('❌ AI Error:', error);
                },
                onData: (data) => this.handleOnData(data)
            });

            console.log('✅ AI Integration initialized');
        } catch (error) {
            console.error('❌ Failed to initialize AI:', error);
            // Resolve anyway so app doesn't hang
            if (this.avatarReadyResolve) {
                this.avatarReadyResolve();
            }
        }
    }

    async waitForAvatarReady() {
        if (this.avatarReadyPromise) {
            console.log('⏳ Waiting for avatar to be ready (no timeout)...');
            return this.avatarReadyPromise;
        }
        return Promise.resolve();
    }
    
    startTelemetry() {
        // Fixed interval for avatar updates
        this.telemetryInterval = setInterval(() => {
            this.sendTelemetry();
        }, CONFIG.AI.TELEMETRY_INTERVAL);
        console.log('📡 Telemetry started (every 3 seconds)');
    }

    sendTelemetry() {
        if (!this.spacesInstance) return;

        this.telemetrySendCount++;
        const telemetry = this.simulation.getTelemetrySnapshot();

        // Skip triggering AI response for the first few telemetry sends to let system stabilize
        const isStartupPhase = this.telemetrySendCount <= this.minTelemetryBeforeAlert;

        if (isStartupPhase) {
            // During startup, just track state but don't trigger
            this.lastState = telemetry.state;
            this.lastStability = telemetry.stability;
            console.log(`📡 Startup telemetry ${this.telemetrySendCount}/${this.minTelemetryBeforeAlert} - state: ${telemetry.state}, stability: ${telemetry.stability}`);
            return;
        }

        // Get sensor statuses
        const power = telemetry.sensors.power;
        const pressure = telemetry.sensors.pressure;
        const temp = telemetry.sensors.temperature;

        const powerStatus = this.getSensorStatus('power', power);
        const pressureStatus = this.getSensorStatus('pressure', pressure);
        const tempStatus = this.getSensorStatus('temperature', temp);

        // Check for status changes
        const powerChanged = powerStatus !== this.lastSensorStatus.power;
        const pressureChanged = pressureStatus !== this.lastSensorStatus.pressure;
        const tempChanged = tempStatus !== this.lastSensorStatus.temperature;

        // Only alert if status changed (to WARNING/CRITICAL or back to NOMINAL)
        const sensors = [
            { name: 'POWER', value: power, unit: 'kW', status: powerStatus, fix: 'switch to backup power', changed: powerChanged, lastStatus: this.lastSensorStatus.power },
            { name: 'PRESSURE', value: pressure, unit: 'bar', status: pressureStatus, fix: 'increase pressure', changed: pressureChanged, lastStatus: this.lastSensorStatus.pressure },
            { name: 'TEMPERATURE', value: temp, unit: '°C', status: tempStatus, fix: 'increase cooling', changed: tempChanged, lastStatus: this.lastSensorStatus.temperature }
        ];

        let alertSent = false;
        for (const sensor of sensors) {
            const isAlert = sensor.status !== 'NOMINAL';
            const wasAlert = sensor.lastStatus !== 'NOMINAL';
            const recoveredToNominal = sensor.changed && !isAlert && wasAlert;  // Was bad, now good
            const shouldAlert = sensor.changed && (isAlert || recoveredToNominal);

            if (shouldAlert) {
                let message;
                if (recoveredToNominal) {
                    // Recovery message
                    message = `✅ ${sensor.name}: ${sensor.value.toFixed(0)}${sensor.unit} has returned to NOMINAL.`;
                    console.log(`✅ RECOVERED: ${message}`);
                } else {
                    // Alert message
                    message = `⚠️ ${sensor.name}: ${sensor.value.toFixed(0)}${sensor.unit} is ${sensor.status}. Recommend: ${sensor.fix}.`;
                    console.log(`🚨 ALERT (status changed): ${message}`);
                }

                this.spacesInstance.sendMessage({
                    text: message,
                    triggerResponse: true,
                    role: 'user'
                });
                alertSent = true;

                // Only send one alert at a time
                break;
            } else if (isAlert) {
                console.log(`📡 ${sensor.name}: ${sensor.value.toFixed(0)}${sensor.unit} still ${sensor.status} (no change, skipping alert)`);
            }
        }

        // Update last status tracking
        this.lastSensorStatus.power = powerStatus;
        this.lastSensorStatus.pressure = pressureStatus;
        this.lastSensorStatus.temperature = tempStatus;

        // If no alerts sent, send silent status update (no triggerResponse)
        if (!alertSent) {
            const hasAnyAlert = powerStatus !== 'NOMINAL' || pressureStatus !== 'NOMINAL' || tempStatus !== 'NOMINAL';
            if (!hasAnyAlert) {
                console.log(`📡 All sensors NOMINAL`);
            }
            // Don't flood AI with silent messages - only send occasionally or skip entirely
        }

        // Update state tracking
        this.lastState = telemetry.state;
        this.lastStability = telemetry.stability;
    }

    shouldTriggerAIResponse(telemetry) {
        // Check if state changed
        if (this.lastState !== telemetry.state) {
            this.lastState = telemetry.state;
            // Trigger on state changes to DEGRADED, CRITICAL, or PAUSED
            if (telemetry.state !== 'NORMAL') {
                return true;
            }
        }

        // Check for critical sensor values
        const power = telemetry.sensors.power;
        const pressure = telemetry.sensors.pressure;
        const temp = telemetry.sensors.temperature;

        // Power critical: <32 (only LOW - scenarios drop power)
        const powerCritical = power < CONFIG.SENSORS.POWER.CRITICAL_LOW;
        // Pressure critical: <125 (only LOW - scenarios drop pressure)
        const pressureCritical = pressure < CONFIG.SENSORS.PRESSURE.CRITICAL_LOW;
        // Temp critical: >85 (only HIGH - scenarios raise temp)
        const tempCritical = temp > CONFIG.SENSORS.TEMPERATURE.CRITICAL_THRESHOLD;

        // Power warning: <38
        const powerWarning = power < CONFIG.SENSORS.POWER.WARNING_LOW;
        // Pressure warning: <135
        const pressureWarning = pressure < CONFIG.SENSORS.PRESSURE.WARNING_LOW;
        // Temp warning: >75
        const tempWarning = temp > CONFIG.SENSORS.TEMPERATURE.WARNING_THRESHOLD;

        // Trigger on ANY warning or critical - AI needs to respond every time
        const hasAlert = powerCritical || pressureCritical || tempCritical || powerWarning || pressureWarning || tempWarning;

        if (hasAlert) {
            console.log(`🚨 Alert detected: pW=${powerWarning}, pC=${powerCritical}, prW=${pressureWarning}, prC=${pressureCritical}, tW=${tempWarning}, tC=${tempCritical}`);
            return true;
        }

        // Trigger if stability drops significantly
        if (this.lastStability !== undefined && telemetry.stability < this.lastStability - 10) {
            this.lastStability = telemetry.stability;
            return true;
        }
        this.lastStability = telemetry.stability;

        return false;
    }
    
    formatTelemetryMessage(telemetry, isAlert = false) {
        const power = telemetry.sensors.power;
        const pressure = telemetry.sensors.pressure;
        const temp = telemetry.sensors.temperature;

        const powerStatus = this.getSensorStatus('power', power);
        const pressureStatus = this.getSensorStatus('pressure', pressure);
        const tempStatus = this.getSensorStatus('temperature', temp);

        // Build alert list for problematic sensors
        const alerts = [];
        if (powerStatus !== 'NOMINAL') alerts.push(`Power: ${power.toFixed(0)} kW is ${powerStatus}`);
        if (pressureStatus !== 'NOMINAL') alerts.push(`Pressure: ${pressure.toFixed(0)} bar is ${pressureStatus}`);
        if (tempStatus !== 'NOMINAL') alerts.push(`Temperature: ${temp.toFixed(0)}°C is ${tempStatus}`);

        if (alerts.length > 0) {
            // Alert format - highlight the problem
            return `⚠️ ALERT: ${alerts.join(', ')}. Please respond with recommendation.`;
        } else {
            // Normal telemetry
            return `TELEMETRY | Power: ${power.toFixed(0)} kW | Pressure: ${pressure.toFixed(0)} bar | Temp: ${temp.toFixed(0)}°C | All NOMINAL`;
        }
    }

    getSensorStatus(sensorName, value) {
        const config = CONFIG.SENSORS[sensorName.toUpperCase()];

        if (sensorName === 'temperature') {
            if (value >= config.CRITICAL_THRESHOLD) return 'CRITICAL';
            if (value >= config.WARNING_THRESHOLD) return 'WARNING';
            return 'NOMINAL';
        } else {
            if (value <= config.CRITICAL_LOW) return 'CRITICAL';
            if (value <= config.WARNING_LOW) return 'WARNING';
            return 'NOMINAL';
        }
    }
    
    formatDelta(delta) {
        if (Math.abs(delta) < 0.1) return '→';
        return delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
    }
    
    handleOnData(data) {
        console.log('🔵 AI Data received:', JSON.stringify(data, null, 2));

        // Check for avatar ready state in various possible structures
        const jsonStr = JSON.stringify(data);
        const hasAvatarStateChanged = jsonStr.includes('avatar_state_changed');
        const hasReadyState = jsonStr.includes('"state"') && jsonStr.includes('"ready"');

        console.log('🔍 Avatar check:', { hasAvatarStateChanged, hasReadyState, hasResolver: !!this.avatarReadyResolve });

        if (hasAvatarStateChanged && hasReadyState && this.avatarReadyResolve) {
            console.log('✅ Avatar ready detected! Resolving promise...');
            // Resolve the avatar ready promise
            this.avatarReadyResolve();
            this.avatarReadyResolve = null;
            return;
        }

        // Check for function calls - standard format
        if (data?.type === 'NAPSTER_SPACES_FUNCTION_CALL') {
            console.log('🟢 Function call detected (standard format)');
            this.handleFunctionCall(data);
            return;
        }
        
        // Check for function calls via DATA_MESSAGES format
        if (data?.type === 'NAPSTER_SPACES_DATA_MESSAGES' &&
            data?.payload?.data?.message?.type === 'function_call') {
            console.log('🟢 Function call detected (DATA_MESSAGES format)');
            const message = data.payload.data.message;
            
            let args = {};
            try {
                if (message.arguments && typeof message.arguments === 'object') {
                    args = message.arguments;
                } else if (message.content && typeof message.content === 'string') {
                    args = JSON.parse(message.content);
                } else if (message.content && typeof message.content === 'object') {
                    args = message.content;
                }
            } catch (e) {
                console.error('Failed to parse function args:', e);
            }
            
            const functionName = message.name || CONFIG.AI.FUNCTION_NAME;
            
            this.handleFunctionCall({
                payload: {
                    name: functionName,
                    arguments: args,
                    callId: message.call_id
                }
            });
            return;
        }
    }
    
    handleFunctionCall(data) {
        const { name, arguments: args, callId } = data.payload || {};

        console.log('📞 Function call received:', { name, args, callId });
        console.log('📞 Full data:', JSON.stringify(data, null, 2));

        if (name === CONFIG.AI.FUNCTION_NAME) {
            this.processControlAction(args, callId);
        } else {
            console.warn('⚠️ Unknown function name:', name, 'expected:', CONFIG.AI.FUNCTION_NAME);
        }
    }

    processControlAction(args, callId) {
        const { action, confirmed, confirmation_phrase } = args || {};

        console.log('🔧 Processing control action:', { action, confirmed, confirmation_phrase });
        console.log('🔧 Current simulation state before action:', {
            cooling: this.simulation.cooling,
            temperature: this.simulation.sensors.temperature,
            scenario: this.simulation.activeScenario
        });

        if (!action) {
            console.error('❌ No action specified in function call');
            if (this.spacesInstance && callId) {
                this.spacesInstance.sendFunctionOutput(callId, {
                    success: false,
                    error: 'No action specified'
                });
            }
            return;
        }

        console.log(`🎯 Executing action: ${action} (confirmed: ${confirmed}, phrase: "${confirmation_phrase}")`);

        // Execute the action on the simulation
        const result = this.simulation.executeAction(action);

        console.log('🔧 Simulation state after action:', {
            cooling: this.simulation.cooling,
            temperature: this.simulation.sensors.temperature,
            scenario: this.simulation.activeScenario
        });

        // Log the action to the message feed
        this.addActionToFeed(action, result);

        // Send response back to AI
        if (this.spacesInstance && callId) {
            this.spacesInstance.sendFunctionOutput(callId, {
                success: result.success,
                action: action,
                message: result.message,
                newState: this.simulation.getTelemetrySnapshot(),
                timestamp: Date.now()
            });
        }
    }

    addActionToFeed(action, result) {
        const feed = document.getElementById('messages-feed');
        if (!feed) return;

        const messageEl = document.createElement('div');
        messageEl.className = `message-item ${result.success ? 'action-success' : 'action-failed'}`;

        const timeEl = document.createElement('div');
        timeEl.className = 'message-time';
        timeEl.textContent = new Date().toLocaleTimeString();

        const textEl = document.createElement('div');
        textEl.className = 'message-text';
        textEl.textContent = `[ACTION] ${this.formatActionLabel(action)}: ${result.message}`;

        messageEl.appendChild(timeEl);
        messageEl.appendChild(textEl);

        // Insert at the top
        feed.insertBefore(messageEl, feed.firstChild);

        // Keep only last 10 messages
        while (feed.children.length > 10) {
            feed.removeChild(feed.lastChild);
        }

        this.messageCount++;
    }

    formatActionLabel(action) {
        return action.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    stop() {
        if (this.telemetryInterval) {
            clearInterval(this.telemetryInterval);
            this.telemetryInterval = null;
        }
    }
}

// Make AI integration globally available
window.AIIntegration = AIIntegration;

