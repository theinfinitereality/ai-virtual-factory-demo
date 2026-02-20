/**
 * Virtual Factory AI Assistant - Charts Manager
 * Manages real-time sensor charts using Chart.js
 */

class ChartsManager {
    constructor() {
        this.charts = {};
        this.dataPoints = {
            power: [],
            pressure: [],
            temperature: []
        };
        this.labels = [];
        this.maxDataPoints = CONFIG.CHARTS.MAX_DATA_POINTS;
    }
    
    init() {
        this.createChart('power', 'power-chart', CONFIG.COLORS.CHART_POWER, 'kW');
        this.createChart('pressure', 'pressure-chart', CONFIG.COLORS.CHART_PRESSURE, 'bar');
        this.createChart('temperature', 'temperature-chart', CONFIG.COLORS.CHART_TEMPERATURE, '°C');

        // Pre-fill charts with nominal data so they're not empty on load
        this.prefillWithNominalData();

        console.log('📊 Charts initialized');
    }

    prefillWithNominalData() {
        // Fill with 10 points of nominal data
        const nominalData = {
            power: 42.0,      // Nominal ~42 kW
            pressure: 140.0,  // Nominal ~140 bar
            temperature: 70.0 // Nominal ~70°C
        };

        for (let i = 0; i < 10; i++) {
            const time = new Date(Date.now() - (10 - i) * 1000);
            this.labels.push(time.toLocaleTimeString());
            this.dataPoints.power.push(nominalData.power + (Math.random() - 0.5) * 2);
            this.dataPoints.pressure.push(nominalData.pressure + (Math.random() - 0.5) * 2);
            this.dataPoints.temperature.push(nominalData.temperature + (Math.random() - 0.5) * 1);
        }

        // Update all charts
        Object.values(this.charts).forEach(chart => chart.update());
    }
    
    createChart(name, canvasId, color, unit) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            console.error(`Canvas ${canvasId} not found`);
            return;
        }
        
        this.charts[name] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.labels,
                datasets: [{
                    label: name.charAt(0).toUpperCase() + name.slice(1),
                    data: this.dataPoints[name],
                    borderColor: color,
                    backgroundColor: color + '20',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                return `${context.parsed.y.toFixed(1)} ${unit}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: false,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        display: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.06)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b7280',
                            font: {
                                size: 10
                            },
                            callback: function(value) {
                                return value.toFixed(0);
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }
    
    update(telemetry) {
        const timestamp = new Date(telemetry.timestamp);
        const timeLabel = timestamp.toLocaleTimeString();
        
        // Add new data point
        this.labels.push(timeLabel);
        this.dataPoints.power.push(telemetry.sensors.power);
        this.dataPoints.pressure.push(telemetry.sensors.pressure);
        this.dataPoints.temperature.push(telemetry.sensors.temperature);
        
        // Remove old data points if exceeding max
        if (this.labels.length > this.maxDataPoints) {
            this.labels.shift();
            this.dataPoints.power.shift();
            this.dataPoints.pressure.shift();
            this.dataPoints.temperature.shift();
        }
        
        // Update all charts
        Object.keys(this.charts).forEach(chartName => {
            this.charts[chartName].update('none');
        });
        
        // Update value displays
        this.updateValueDisplays(telemetry);
    }
    
    updateValueDisplays(telemetry) {
        const powerEl = document.getElementById('power-value');
        const pressureEl = document.getElementById('pressure-value');
        const tempEl = document.getElementById('temperature-value');

        // Also get card elements for border highlighting
        const powerCard = document.getElementById('power-card');
        const pressureCard = document.getElementById('pressure-card');
        const tempCard = document.getElementById('temperature-card');

        const powerStatus = this.getStatusClass('power', telemetry.sensors.power);
        const pressureStatus = this.getStatusClass('pressure', telemetry.sensors.pressure);
        const tempStatus = this.getStatusClass('temperature', telemetry.sensors.temperature);

        if (powerEl) {
            powerEl.textContent = `${telemetry.sensors.power.toFixed(1)} kW`;
            powerEl.className = 'chart-value ' + powerStatus;
        }
        if (powerCard) {
            powerCard.className = 'chart-card ' + (powerStatus !== 'normal' ? powerStatus : '');
        }

        if (pressureEl) {
            pressureEl.textContent = `${telemetry.sensors.pressure.toFixed(1)} bar`;
            pressureEl.className = 'chart-value ' + pressureStatus;
        }
        if (pressureCard) {
            pressureCard.className = 'chart-card ' + (pressureStatus !== 'normal' ? pressureStatus : '');
        }

        if (tempEl) {
            tempEl.textContent = `${telemetry.sensors.temperature.toFixed(1)} °C`;
            tempEl.className = 'chart-value ' + tempStatus;
        }
        if (tempCard) {
            tempCard.className = 'chart-card ' + (tempStatus !== 'normal' ? tempStatus : '');
        }
    }
    
    getStatusClass(sensorName, value) {
        const config = CONFIG.SENSORS[sensorName.toUpperCase()];
        
        if (sensorName === 'temperature') {
            if (value >= config.CRITICAL_THRESHOLD) return 'critical';
            if (value >= config.WARNING_THRESHOLD) return 'warning';
            return 'normal';
        } else {
            if (value <= config.CRITICAL_LOW || value >= config.CRITICAL_HIGH) return 'critical';
            if (value <= config.WARNING_LOW || value >= config.WARNING_HIGH) return 'warning';
            return 'normal';
        }
    }
}

// Make charts manager globally available
window.ChartsManager = ChartsManager;

