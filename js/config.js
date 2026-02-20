/**
 * Virtual Factory AI Assistant - Configuration
 * Central configuration for the entire application
 */

const CONFIG = {
    // Napster Spaces AI Configuration
    AI: {
        EXPERIENCE_ID: 'YWIzZGI5ZWItMWIxOC00MzVlLTkxN2UtYTgzZjJiNDVmM2I1OjVkOTI0YjZjLWU1ZjgtNGQ1Yi1hNjFhLTM5ODM5MzI2ZmE5NQ==',
        FUNCTIONS_LIBRARY_ID: '1e26cc14-28bd-4c18-811a-15e8d74989a8',
        FUNCTION_NAME: 'factory_control',
        TELEMETRY_INTERVAL: 3000, // 3 seconds - fixed interval for avatar updates
    },

    // Simulation Parameters
    SIMULATION: {
        TICK_INTERVAL: 6000, // 6 seconds - slow ticks for avatar processing
        STARTUP_STABLE_DURATION: 15000, // 15 seconds before first scenario
        SCENARIO_DELAY: 10000, // 10 seconds between scenarios
    },

    // Sensor Nominal Ranges
    SENSORS: {
        POWER: {
            NOMINAL_MIN: 38,
            WARNING_LOW: 38,
            CRITICAL_LOW: 32,
            UNIT: 'kW'
        },
        PRESSURE: {
            NOMINAL_MIN: 135,
            WARNING_LOW: 135,
            CRITICAL_LOW: 125,
            UNIT: 'bar',
            ADJUSTMENT_STEP: 5
        },
        TEMPERATURE: {
            NOMINAL_MAX: 75,
            WARNING_THRESHOLD: 75,
            CRITICAL_THRESHOLD: 85,
            UNIT: '°C'
        }
    },

    // Cooling System
    COOLING: {
        DEFAULT: 30,
        MIN: 0,
        MAX: 100,
        INCREMENT: 35,  // Larger increment so fewer calls needed (30->65->100)
        EFFECTIVENESS: 7.0 // °C per 100% cooling (needs to overcome 2-3.5°C rise significantly)
    },

    // Stability Score Thresholds
    STABILITY: {
        PENALTY_WARNING: 10,
        PENALTY_CRITICAL: 25,
        PENALTY_TREND: 5,
        THRESHOLD_NORMAL: 86,
        THRESHOLD_DEGRADED: 71,
        THRESHOLD_CRITICAL: 0
    },

    // System States
    STATES: {
        NORMAL: 'NORMAL',
        DEGRADED: 'DEGRADED',
        CRITICAL: 'CRITICAL',
        PAUSED: 'PAUSED'
    },

    // Scenario Types
    SCENARIOS: {
        NONE: 'NONE',
        POWER_SAG: 'POWER_SAG',
        PRESSURE_DRIFT: 'PRESSURE_DRIFT',
        OVERHEAT: 'OVERHEAT'
    },

    // Scenario Weights (for random selection)
    SCENARIO_WEIGHTS: {
        POWER_SAG: 0.40,
        PRESSURE_DRIFT: 0.35,
        OVERHEAT: 0.25
    },

    // Robot Animation Speeds
    ROBOT: {
        SPEED_NORMAL: 1.0,
        SPEED_DEGRADED: 0.8,
        SPEED_CRITICAL: 0.0,
        SPEED_PAUSED: 0.0
    },

    // Conveyor Settings
    CONVEYOR: {
        SPEED_NORMAL: 0.02,
        SPEED_DEGRADED: 0.015,
        ITEM_SPAWN_INTERVAL: 3000, // 3 seconds
        ITEM_SPACING: 2.0
    },

    // Chart Settings
    CHARTS: {
        MAX_DATA_POINTS: 60, // 60 points = 120 seconds at 2s interval
        UPDATE_INTERVAL: 2000
    },

    // Auto-stop rule
    AUTO_STOP: {
        ENABLED: false, // Disabled - let AI handle critical situations
        CRITICAL_TICKS: 10 // 10 ticks = 8 seconds (if enabled)
    },

    // Action Types
    ACTIONS: {
        SWITCH_BACKUP_POWER: 'switch_backup_power',
        INCREASE_PRESSURE: 'increase_pressure',
        DECREASE_PRESSURE: 'decrease_pressure',
        INCREASE_COOLING: 'increase_cooling',
        PAUSE_LINE: 'pause_line',
        RESUME_LINE: 'resume_line'
    },

    // UI Colors - Björk "All Is Full of Love" palette
    COLORS: {
        NORMAL: '#7dd3c0',
        DEGRADED: '#d4a574',
        CRITICAL: '#d4847a',
        PAUSED: '#9ca3af',
        CHART_POWER: '#7eb8c9',
        CHART_PRESSURE: '#a8c5d4',
        CHART_TEMPERATURE: '#c5a88a'
    }
};

// Make config globally available
window.FACTORY_CONFIG = CONFIG;

