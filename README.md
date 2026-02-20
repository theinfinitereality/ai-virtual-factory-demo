# Virtual Factory AI Assistant Demo

AI-powered factory monitoring and operations assistant with real-time 3D visualization, sensor telemetry, and intelligent recommendations.

## 🎯 Overview

This demo showcases an AI assistant that monitors a robotic welding station in real-time, analyzes sensor data, detects anomalies, and provides operators with actionable recommendations to maintain optimal performance.

### Key Features

- **3D Visualization**: Interactive Three.js scene with robot arm, conveyor belt, and items
- **Real-time Monitoring**: Live sensor charts for Power, Hydraulic Pressure, and Oil Temperature
- **AI Assistant**: Napster Spaces AI avatar that analyzes telemetry and provides guidance
- **Intelligent Scenarios**: Simulated factory scenarios (Power Sag, Pressure Drift, Overheat)
- **Operator Actions**: Interactive controls for backup power, pressure adjustment, cooling, and line control
- **State Management**: NORMAL → DEGRADED → CRITICAL → PAUSED state transitions
- **Stability Scoring**: Real-time stability assessment (0-100) with visual indicators

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Python 3.7+ (for AI configuration scripts)
- Modern web browser

### 1. Configure AI Assistant

First, register the AI function and update the avatar prompt:

```bash
# Install Python dependencies
pip install requests

# Register the factory_assistant_update function
python3 scripts/register_factory_function.py

# Update the AI avatar prompt
python3 scripts/update_factory_avatar_prompt.py
```

**Important**: After running `register_factory_function.py`, copy the `function_library_id` from the output and update `js/config.js`:

```javascript
FUNCTIONS_LIBRARY_ID: 'YOUR_FUNCTION_LIBRARY_ID_HERE'
```

### 2. Run Locally with Docker

```bash
# Start the application
docker-compose up -d

# Access at
http://localhost:8080
```

### 3. Run Without Docker

```bash
# Serve with any static file server
python3 -m http.server 8080

# Or use Node.js
npx http-server -p 8080
```

## 📋 How It Works

### Simulation Flow

1. **Startup (0-15s)**: System runs in NORMAL state with stable sensors
2. **Scenario Trigger (15s+)**: Random scenario activates (Power Sag, Pressure Drift, or Overheat)
3. **AI Analysis**: Every 2 seconds, telemetry is sent to AI assistant
4. **AI Response**: AI calls `factory_assistant_update` function with status, message, evidence, and recommended actions
5. **Operator Action**: Operator clicks recommended action button
6. **Recovery**: Sensors stabilize, stability score increases, system returns to NORMAL
7. **Repeat**: After 20-30s stable, next scenario triggers

### System States

- **NORMAL** (Green): Stability 86-100, all sensors nominal, smooth operation
- **DEGRADED** (Amber): Stability 71-85, some warnings, reduced speed
- **CRITICAL** (Red): Stability 0-70, sensor criticals, risk of shutdown
- **PAUSED** (Flashing Red): Line stopped, requires operator intervention

### Sensors

| Sensor | Nominal | Warning | Critical | Unit |
|--------|---------|---------|----------|------|
| Power | 45-50 | <38 or >60 | <32 or >70 | kW |
| Pressure | 145-150 | <135 or >160 | <125 or >170 | bar |
| Oil Temp | 55-65 | >75 | >85 | °C |

### Scenarios

1. **Power Sag**: Power drops 1-3 kW/tick → Action: `switch_backup_power`
2. **Pressure Drift**: Pressure drops 1-2 bar/tick → Action: `increase_pressure`
3. **Overheat**: Temperature rises 1-1.5°C/tick → Action: `increase_cooling`

### Operator Actions

- `switch_backup_power`: Activates backup power (+3 kW/tick recovery)
- `increase_pressure`: Adds +5 bar immediately
- `decrease_pressure`: Reduces -5 bar immediately
- `increase_cooling`: Adds +20% cooling (reduces temp)
- `pause_line`: Emergency stop
- `resume_line`: Restart after pause (if sensors not critical)

## 🏗️ Architecture

```
├── index.html              # Main HTML structure
├── styles.css              # UI styling
├── js/
│   ├── config.js          # Central configuration
│   ├── simulation.js      # Simulation engine (sensors, scenarios, state)
│   ├── charts.js          # Chart.js sensor charts
│   ├── scene.js           # Three.js 3D visualization
│   ├── ai-integration.js  # Napster Spaces AI SDK integration
│   └── app.js             # Main application orchestrator
├── scripts/
│   ├── register_factory_function.py    # Register AI function
│   └── update_factory_avatar_prompt.py # Configure AI prompt
├── Dockerfile             # Production container
├── docker-compose.yml     # Local development
└── nginx.conf            # Web server configuration
```

## 🎮 Demo "Money Shot"

The key demo flow:

1. **Scenario Triggers**: Power starts dropping (47 → 40 → 34 kW)
2. **AI Detects**: "Power supply dropping rapidly. Backup power recommended."
3. **Operator Acts**: Clicks "Switch Backup Power" button
4. **Recovery Visible**: Within 10-20 seconds:
   - Power chart trends upward (34 → 40 → 47 kW)
   - Stability score increases (75 → 85 → 95)
   - Beacon changes green
   - Robot resumes smooth motion
5. **AI Confirms**: "Power restored to nominal range. All systems stable."

## 🔧 Configuration

Edit `js/config.js` to customize:

- Sensor ranges and thresholds
- Scenario weights and behaviors
- Animation speeds
- Chart settings
- AI telemetry interval

## 📊 Monitoring

- **3D Scene**: Visual representation of factory state
- **Sensor Charts**: 60-point rolling history (120 seconds)
- **Stability Score**: 0-100 with color coding
- **AI Message Feed**: Latest 10 alerts and recommendations
- **Beacon Indicator**: Quick visual status (green/amber/red/flashing)

## 🚢 Deployment

### Google Cloud Run

```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/virtual-factory

# Deploy
gcloud run deploy virtual-factory \
  --image gcr.io/PROJECT_ID/virtual-factory \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Other Platforms

The app is a static site and can be deployed to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Azure Static Web Apps
- GitHub Pages

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Credits

- Three.js for 3D visualization
- Chart.js for sensor charts
- Napster Spaces SDK for AI avatar integration

