/**
 * Virtual Factory AI Assistant - Three.js Scene Manager
 * Manages the 3D visualization of the robot arm and conveyor system
 */

class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.robot = null;
        this.conveyor = null;
        this.items = [];
        this.animationSpeed = CONFIG.ROBOT.SPEED_NORMAL;
        this.conveyorSpeed = CONFIG.CONVEYOR.SPEED_NORMAL;
        this.state = CONFIG.STATES.NORMAL;
        this.animationTime = 0;
        this.lastItemSpawn = 0;

        // Welding state
        this.isWelding = false;
        this.weldingTarget = null;
        this.weldingProgress = 0;
        this.weldingDuration = 1.5; // seconds to weld one item
        this.sparks = [];
        this.weldZone = 2; // X position where robot welds
    }

    init() {
        this.setupScene();
        this.setupLights();
        this.loadTextures(); // Load PBR textures first
        this.createConveyor();
        this.createRobotArm();
        this.createRobotLEDs();
        this.createConveyorLEDs();
        this.createSparks();
        this.createFloor();
        this.createFactoryWalls();
        this.createInfrastructure();
        this.setupControls();
        this.animate();

        console.log('🎬 3D Scene initialized');
    }

    loadTextures() {
        const textureLoader = new THREE.TextureLoader();
        this.textures = {};

        // Industrial floor textures (stylized industrial_wall_6)
        this.textures.floor = {
            diffuse: textureLoader.load('textures/industrial_wall_6_baseColor_2k.jpg'),
            roughness: textureLoader.load('textures/industrial_wall_6_roughness_2k.jpg'),
            normal: textureLoader.load('textures/industrial_wall_6_normal_gl_2k.jpg'),
            ao: textureLoader.load('textures/industrial_wall_6_ambientOcclusion_2k.jpg')
        };

        // Cabinet textures (stylized industrial_wall_7)
        this.textures.cabinet = {
            diffuse: textureLoader.load('textures/industrial_wall_7_baseColor_2k.jpg'),
            roughness: textureLoader.load('textures/industrial_wall_7_roughness_2k.jpg'),
            normal: textureLoader.load('textures/industrial_wall_7_normal_gl_2k.jpg'),
            ao: textureLoader.load('textures/industrial_wall_7_ambientOcclusion_2k.jpg')
        };

        // Metal plate textures (for robot joints and industrial elements)
        this.textures.metal = {
            diffuse: textureLoader.load('textures/metal_diff.jpg'),
            roughness: textureLoader.load('textures/metal_rough.jpg'),
            normal: textureLoader.load('textures/metal_normal.jpg')
        };

        // Robot base/mount textures (stylized industrial_wall_5)
        this.textures.robotBase = {
            diffuse: textureLoader.load('textures/industrial_wall_5_baseColor_2k.jpg'),
            roughness: textureLoader.load('textures/industrial_wall_5_roughness_2k.jpg'),
            normal: textureLoader.load('textures/industrial_wall_5_normal_gl_2k.jpg'),
            ao: textureLoader.load('textures/industrial_wall_5_ambientOcclusion_2k.jpg')
        };

        // Factory wall textures (stylized industrial_wall_8)
        this.textures.wall = {
            diffuse: textureLoader.load('textures/industrial_wall_8_baseColor_2k.jpg'),
            roughness: textureLoader.load('textures/industrial_wall_8_roughness_2k.jpg'),
            normal: textureLoader.load('textures/industrial_wall_8_normal_gl_2k.jpg'),
            ao: textureLoader.load('textures/industrial_wall_8_ambientOcclusion_2k.jpg')
        };

        // Corrugated iron textures (for conveyor and structural elements)
        this.textures.corrugated = {
            diffuse: textureLoader.load('textures/corrugated_iron_diff.jpg'),
            roughness: textureLoader.load('textures/corrugated_iron_rough.jpg'),
            normal: textureLoader.load('textures/corrugated_iron_normal.jpg')
        };

        // Configure texture wrapping and repeating
        Object.values(this.textures).forEach(texSet => {
            Object.values(texSet).forEach(tex => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
            });
        });

        console.log('🖼️ PBR textures loaded');
    }
    
    setupScene() {
        // Scene - Industrial factory aesthetic
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a20);
        this.scene.fog = new THREE.Fog(0x1a1a20, 20, 50);

        // Create environment map for metallic reflections
        this.createEnvironmentMap();

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            50,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(8, 6, 8);
        this.camera.lookAt(0, 0, 0);

        // Renderer with tone mapping for better lighting
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.9;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    createEnvironmentMap() {
        // Create a more detailed HDRI-like environment map for realistic reflections
        const envCanvas = document.createElement('canvas');
        envCanvas.width = 1024;
        envCanvas.height = 512;
        const ctx = envCanvas.getContext('2d');

        // Create gradient sky
        const skyGradient = ctx.createLinearGradient(0, 0, 0, 512);
        skyGradient.addColorStop(0, '#87ceeb');    // Top - sky blue
        skyGradient.addColorStop(0.2, '#b8d4e8');  // Upper - light blue
        skyGradient.addColorStop(0.4, '#f0f5fa');  // Middle-upper - very light
        skyGradient.addColorStop(0.5, '#ffffff');  // Horizon - white
        skyGradient.addColorStop(0.6, '#f5f5f0');  // Middle-lower - cream
        skyGradient.addColorStop(0.8, '#d0d0c8');  // Lower - gray
        skyGradient.addColorStop(1, '#a0a098');    // Bottom - floor reflection
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, 1024, 512);

        // Add some soft "window" lights for industrial feel
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(150 + i * 200, 100, 80, 120);
        }

        // Add subtle warm accent lights
        ctx.fillStyle = 'rgba(255, 220, 180, 0.3)';
        ctx.fillRect(50, 150, 60, 80);
        ctx.fillRect(900, 150, 60, 80);

        // Add some industrial structure hints
        ctx.fillStyle = 'rgba(100, 100, 100, 0.15)';
        ctx.fillRect(0, 380, 1024, 132);

        // Add subtle ceiling structure
        ctx.fillStyle = 'rgba(200, 200, 200, 0.2)';
        for (let i = 0; i < 8; i++) {
            ctx.fillRect(i * 128, 30, 10, 60);
        }

        const envTexture = new THREE.CanvasTexture(envCanvas);
        envTexture.mapping = THREE.EquirectangularReflectionMapping;

        this.scene.environment = envTexture;
    }
    
    setupLights() {
        // Ambient light - low intensity for industrial look with shadows
        const ambient = new THREE.AmbientLight(0x404050, 0.4);
        this.scene.add(ambient);

        // Hemisphere light - subtle sky/ground gradient
        const hemiLight = new THREE.HemisphereLight(0x606080, 0x303030, 0.3);
        this.scene.add(hemiLight);

        // Main overhead light - industrial ceiling light simulation
        const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
        mainLight.position.set(3, 12, -4);
        mainLight.castShadow = true;
        mainLight.shadow.camera.left = -15;
        mainLight.shadow.camera.right = 15;
        mainLight.shadow.camera.top = 15;
        mainLight.shadow.camera.bottom = -15;
        mainLight.shadow.camera.near = 1;
        mainLight.shadow.camera.far = 30;
        mainLight.shadow.mapSize.width = 4096;
        mainLight.shadow.mapSize.height = 4096;
        mainLight.shadow.bias = -0.0005;
        mainLight.shadow.normalBias = 0.02;
        this.scene.add(mainLight);

        // Secondary overhead light - for depth
        const secondLight = new THREE.DirectionalLight(0xffe8d0, 0.5);
        secondLight.position.set(-6, 10, 2);
        secondLight.castShadow = true;
        secondLight.shadow.camera.left = -10;
        secondLight.shadow.camera.right = 10;
        secondLight.shadow.camera.top = 10;
        secondLight.shadow.camera.bottom = -10;
        secondLight.shadow.mapSize.width = 2048;
        secondLight.shadow.mapSize.height = 2048;
        this.scene.add(secondLight);

        // Subtle rim/back light - cool blue for depth separation
        const rimLight = new THREE.DirectionalLight(0x8090b0, 0.3);
        rimLight.position.set(-8, 6, -10);
        this.scene.add(rimLight);

        // Industrial spot lights over work area
        const spotLight1 = new THREE.SpotLight(0xfff0e0, 1.5, 15, Math.PI / 6, 0.5, 1);
        spotLight1.position.set(2, 8, -2);
        spotLight1.target.position.set(2, 0, -2);
        spotLight1.castShadow = true;
        spotLight1.shadow.mapSize.width = 1024;
        spotLight1.shadow.mapSize.height = 1024;
        this.scene.add(spotLight1);
        this.scene.add(spotLight1.target);

        // Spot light over conveyor
        const spotLight2 = new THREE.SpotLight(0xfff0e0, 1.0, 12, Math.PI / 5, 0.6, 1);
        spotLight2.position.set(-2, 7, 0);
        spotLight2.target.position.set(0, 0, 0);
        spotLight2.castShadow = false;
        this.scene.add(spotLight2);
        this.scene.add(spotLight2.target);

        // Focused welding zone spotlight - bright white from directly above
        const weldingSpot = new THREE.SpotLight(0xffffff, 3.0, 12, Math.PI / 8, 0.3, 1);
        weldingSpot.position.set(1.7, 10, -2.4);
        weldingSpot.target.position.set(1.7, 0, -2.4);
        weldingSpot.castShadow = true;
        weldingSpot.shadow.mapSize.width = 2048;
        weldingSpot.shadow.mapSize.height = 2048;
        weldingSpot.shadow.bias = -0.0005;
        this.scene.add(weldingSpot);
        this.scene.add(weldingSpot.target);

        // Welding light (point light at robot tip) - orange glow
        this.weldingLight = new THREE.PointLight(0xff6600, 0, 4);
        this.weldingLight.position.set(0, 2, 0);
        this.scene.add(this.weldingLight);

        console.log('💡 Industrial lighting setup complete');
    }
    
    createFloor() {
        const floorGeometry = new THREE.PlaneGeometry(40, 40, 80, 80);

        // Use stylized industrial floor textures
        const floorTex = this.textures.floor;
        floorTex.diffuse.repeat.set(6, 6);
        floorTex.roughness.repeat.set(6, 6);
        floorTex.normal.repeat.set(6, 6);
        floorTex.ao.repeat.set(6, 6);

        // Stylized industrial floor with PBR textures
        const floorMaterial = new THREE.MeshStandardMaterial({
            map: floorTex.diffuse,
            roughnessMap: floorTex.roughness,
            normalMap: floorTex.normal,
            aoMap: floorTex.ao,
            normalScale: new THREE.Vector2(1.0, 1.0),
            roughness: 0.9,
            metalness: 0.2,
            envMapIntensity: 0.4
        });

        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Yellow safety lines around robot work area
        const safetyMat = new THREE.MeshStandardMaterial({
            color: 0xf5a623,
            roughness: 0.4,
            metalness: 0.1,
            emissive: 0xf5a623,
            emissiveIntensity: 0.1
        });

        // Safety zone marking
        const zoneGeo = new THREE.RingGeometry(3.5, 3.7, 32);
        const zone = new THREE.Mesh(zoneGeo, safetyMat);
        zone.rotation.x = -Math.PI / 2;
        zone.position.set(1.7, 0.01, -2.4);
        this.scene.add(zone);

        // Hazard stripes near conveyor
        const stripeGeo = new THREE.PlaneGeometry(8, 0.3);
        const stripeCanvas = document.createElement('canvas');
        stripeCanvas.width = 256;
        stripeCanvas.height = 32;
        const sCtx = stripeCanvas.getContext('2d');
        for (let i = 0; i < 16; i++) {
            sCtx.fillStyle = i % 2 === 0 ? '#f5a623' : '#1a1a1a';
            sCtx.beginPath();
            sCtx.moveTo(i * 16, 0);
            sCtx.lineTo(i * 16 + 32, 0);
            sCtx.lineTo(i * 16 + 16, 32);
            sCtx.lineTo(i * 16 - 16, 32);
            sCtx.fill();
        }
        const stripeTexture = new THREE.CanvasTexture(stripeCanvas);
        stripeTexture.wrapS = THREE.RepeatWrapping;
        stripeTexture.repeat.set(4, 1);

        const stripeMat = new THREE.MeshStandardMaterial({
            map: stripeTexture,
            roughness: 0.5
        });
        const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
        stripe1.rotation.x = -Math.PI / 2;
        stripe1.position.set(0, 0.01, 1.2);
        this.scene.add(stripe1);

        const stripe2 = stripe1.clone();
        stripe2.position.z = -1.2;
        this.scene.add(stripe2);
    }

    createFactoryWalls() {
        // Factory walls on back and left side for realistic industrial look
        const wallTex = this.textures.wall;

        // Configure texture repeating for large walls
        wallTex.diffuse.repeat.set(6, 2);
        wallTex.roughness.repeat.set(6, 2);
        wallTex.normal.repeat.set(6, 2);
        wallTex.ao.repeat.set(6, 2);

        const wallMaterial = new THREE.MeshStandardMaterial({
            map: wallTex.diffuse,
            roughnessMap: wallTex.roughness,
            normalMap: wallTex.normal,
            aoMap: wallTex.ao,
            normalScale: new THREE.Vector2(1.0, 1.0),
            roughness: 0.8,
            metalness: 0.3,
            envMapIntensity: 0.5,
            side: THREE.DoubleSide
        });

        const wallHeight = 8;
        const wallWidth = 30;

        // Back wall (behind the cabinets, along X axis)
        const backWallGeo = new THREE.PlaneGeometry(wallWidth, wallHeight);
        const backWall = new THREE.Mesh(backWallGeo, wallMaterial);
        backWall.position.set(0, wallHeight / 2, -12);
        backWall.receiveShadow = true;
        backWall.castShadow = false;
        this.scene.add(backWall);

        // Left wall (along Z axis)
        // Adjust texture repeat for side wall orientation
        const leftWallMaterial = wallMaterial.clone();
        const leftWallGeo = new THREE.PlaneGeometry(wallWidth, wallHeight);
        const leftWall = new THREE.Mesh(leftWallGeo, leftWallMaterial);
        leftWall.position.set(-15, wallHeight / 2, 0);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.receiveShadow = true;
        leftWall.castShadow = false;
        this.scene.add(leftWall);

        // Add industrial baseboard/skirting at bottom of walls
        const baseboardMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.6,
            metalness: 0.4
        });
        const baseboardHeight = 0.3;

        // Back baseboard
        const backBaseGeo = new THREE.BoxGeometry(wallWidth, baseboardHeight, 0.1);
        const backBase = new THREE.Mesh(backBaseGeo, baseboardMat);
        backBase.position.set(0, baseboardHeight / 2, -11.95);
        backBase.castShadow = true;
        backBase.receiveShadow = true;
        this.scene.add(backBase);

        // Left baseboard
        const leftBaseGeo = new THREE.BoxGeometry(0.1, baseboardHeight, wallWidth);
        const leftBase = new THREE.Mesh(leftBaseGeo, baseboardMat);
        leftBase.position.set(-14.95, baseboardHeight / 2, 0);
        leftBase.castShadow = true;
        leftBase.receiveShadow = true;
        this.scene.add(leftBase);

        console.log('🏭 Factory walls created');
    }

    createInfrastructure() {
        // Professional industrial infrastructure
        this.infrastructure = new THREE.Group();

        // Uniform cabinet dimensions
        const cabinetW = 0.8, cabinetH = 1.6, cabinetD = 0.5;
        const baseZ = -7; // Further back from robot
        const spacing = 2.2;

        // Use stylized industrial cabinet textures
        const cabinetTex = this.textures.cabinet;
        cabinetTex.diffuse.repeat.set(1, 2);
        cabinetTex.roughness.repeat.set(1, 2);
        cabinetTex.normal.repeat.set(1, 2);
        cabinetTex.ao.repeat.set(1, 2);

        // Common materials - stylized industrial cabinets with PBR textures
        const cabinetMat = new THREE.MeshStandardMaterial({
            map: cabinetTex.diffuse,
            roughnessMap: cabinetTex.roughness,
            normalMap: cabinetTex.normal,
            aoMap: cabinetTex.ao,
            normalScale: new THREE.Vector2(1.0, 1.0),
            roughness: 0.7,
            metalness: 0.5,
            envMapIntensity: 0.6
        });
        const darkMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a, roughness: 0.3, metalness: 0.4
        });
        const cableMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a, roughness: 0.7, metalness: 0.1
        });

        // === 1. MAIN POWER UNIT (with battery level) ===
        const powerUnit = this.createCabinet(cabinetW, cabinetH, cabinetD, cabinetMat, darkMat, 0x22ff22, 'POWER');
        powerUnit.position.set(-spacing * 1.5, 0, baseZ);
        this.infrastructure.add(powerUnit);
        this.powerUnit = powerUnit;
        this.mainBatteryLED = powerUnit.ledStrip; // LED strip for status
        // Add battery level indicator
        this.batteryLevel = this.createBatteryIndicator(powerUnit, cabinetH, 'main');
        // Add battery cells visual
        this.addBatteryCells(powerUnit, cabinetH, cabinetD);

        // === 2. OIL/COOLING UNIT (with temperature gauge) ===
        const oilUnit = this.createCabinet(cabinetW, cabinetH, cabinetD, cabinetMat, darkMat, 0x22ff22, 'OIL');
        oilUnit.position.set(-spacing * 0.5, 0, baseZ);
        this.infrastructure.add(oilUnit);
        this.oilUnit = oilUnit;
        this.oilLED = oilUnit.ledStrip; // LED strip for status
        // Add temperature gauge
        this.tempGauge = this.createAnalogGauge(oilUnit, cabinetH, cabinetD, 0xff6b6b, 'TEMP');
        // Add oil barrel visual
        this.addOilBarrel(oilUnit, cabinetH, cabinetD);

        // === 3. HYDRAULIC PRESSURE UNIT (with pressure gauge) ===
        const pressureUnit = this.createCabinet(cabinetW, cabinetH, cabinetD, cabinetMat, darkMat, 0x22ff22, 'PSI');
        pressureUnit.position.set(spacing * 0.5, 0, baseZ);
        this.infrastructure.add(pressureUnit);
        this.pressureUnit = pressureUnit;
        this.pressureLED = pressureUnit.ledStrip; // LED strip for status
        // Add pressure gauge
        this.pressureGauge = this.createAnalogGauge(pressureUnit, cabinetH, cabinetD, 0x22d3ee, 'PSI');
        // Add pressure tank visual
        this.addPressureTank(pressureUnit, cabinetH, cabinetD);

        // === 4. BACKUP GENERATOR (with status light) ===
        const backupUnit = this.createCabinet(cabinetW, cabinetH, cabinetD, cabinetMat, darkMat, 0x22ff22, 'BACKUP');
        backupUnit.position.set(spacing * 1.5, 0, baseZ);
        this.infrastructure.add(backupUnit);
        this.backupGenerator = backupUnit;
        this.backupBatteryLED = backupUnit.ledStrip; // LED strip for status
        // Add backup battery indicator
        this.backupBatteryLevel = this.createBatteryIndicator(backupUnit, cabinetH, 'backup');
        // Add battery cells visual
        this.addBatteryCells(backupUnit, cabinetH, cabinetD);

        // Debug: Log both battery fills to verify they exist
        console.log('🔋 After creation - mainBatteryFill:', !!this.mainBatteryFill, 'backupBatteryFill:', !!this.backupBatteryFill);

        // === FLOOR CABLES ===
        const floorY = 0.02;
        // Power to conveyor area
        this.createFloorCable(powerUnit.position, new THREE.Vector3(0, floorY, -3), cableMat, 0.06);
        // Oil line
        this.createFloorCable(oilUnit.position, new THREE.Vector3(1, floorY, -3), cableMat, 0.04);
        // Pressure line
        this.createFloorCable(pressureUnit.position, new THREE.Vector3(2, floorY, -3), cableMat, 0.04);
        // Backup to main power
        this.createFloorCable(backupUnit.position, powerUnit.position, cableMat, 0.07);

        this.scene.add(this.infrastructure);
    }

    createCabinet(w, h, d, mainMat, accentMat, accentColor, label) {
        const group = new THREE.Group();

        // Main cabinet body
        const bodyGeo = new THREE.BoxGeometry(w, h, d);
        const body = new THREE.Mesh(bodyGeo, mainMat);
        body.position.y = h / 2;
        body.castShadow = true;
        group.add(body);

        // Top trim
        const topGeo = new THREE.BoxGeometry(w + 0.02, 0.05, d + 0.02);
        const top = new THREE.Mesh(topGeo, accentMat);
        top.position.y = h + 0.025;
        group.add(top);

        // Bottom base
        const baseGeo = new THREE.BoxGeometry(w + 0.04, 0.08, d + 0.04);
        const base = new THREE.Mesh(baseGeo, accentMat);
        base.position.y = 0.04;
        group.add(base);

        // Front panel (inset)
        const panelGeo = new THREE.BoxGeometry(w * 0.85, h * 0.7, 0.02);
        const panelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2, metalness: 0.3 });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.set(0, h * 0.55, d / 2 + 0.01);
        group.add(panel);

        // Color accent strip (LED indicator) - use MeshBasicMaterial for glow effect
        const stripGeo = new THREE.BoxGeometry(w, 0.08, 0.02);
        const stripMat = new THREE.MeshBasicMaterial({ color: accentColor });
        const strip = new THREE.Mesh(stripGeo, stripMat);
        strip.position.set(0, h * 0.15, d / 2 + 0.02);
        group.add(strip);

        // Store reference to the LED strip on the group
        group.ledStrip = strip;

        // Ventilation grille
        for (let i = 0; i < 4; i++) {
            const ventGeo = new THREE.BoxGeometry(w * 0.6, 0.02, 0.01);
            const vent = new THREE.Mesh(ventGeo, accentMat);
            vent.position.set(0, 0.3 + i * 0.08, d / 2 + 0.015);
            group.add(vent);
        }

        return group;
    }

    createBatteryIndicator(cabinet, cabinetH, type = 'main') {
        const group = new THREE.Group();
        const d = 0.5;

        // Large battery meter covering front panel
        const meterWidth = 0.35;
        const meterHeight = 0.55;
        const xOffset = 0; // Centered - each battery is in its own cabinet now

        // Battery outline/frame
        const outlineGeo = new THREE.BoxGeometry(meterWidth + 0.04, meterHeight + 0.04, 0.02);
        const outlineMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.5 });
        const outline = new THREE.Mesh(outlineGeo, outlineMat);
        outline.position.set(xOffset, cabinetH * 0.55, d / 2 + 0.025);
        group.add(outline);

        // Inner dark background
        const bgGeo = new THREE.BoxGeometry(meterWidth, meterHeight, 0.01);
        const bgMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8 });
        const bg = new THREE.Mesh(bgGeo, bgMat);
        bg.position.set(xOffset, cabinetH * 0.55, d / 2 + 0.035);
        group.add(bg);

        // Battery fill (green bar that scales with charge)
        const fillGeo = new THREE.BoxGeometry(meterWidth - 0.04, meterHeight - 0.06, 0.01);
        const fillMat = new THREE.MeshBasicMaterial({ color: 0x22ff22 });
        const fill = new THREE.Mesh(fillGeo, fillMat);
        fill.position.set(xOffset, cabinetH * 0.55, d / 2 + 0.04);
        group.add(fill);

        // Segment lines for battery look
        const segmentMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
        for (let i = 1; i < 5; i++) {
            const segGeo = new THREE.BoxGeometry(meterWidth - 0.02, 0.01, 0.015);
            const seg = new THREE.Mesh(segGeo, segmentMat);
            const segY = cabinetH * 0.55 - (meterHeight / 2) + (i * meterHeight / 5);
            seg.position.set(xOffset, segY, d / 2 + 0.045);
            group.add(seg);
        }

        // Battery label
        const labelMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
        const labelGeo = new THREE.BoxGeometry(meterWidth * 0.6, 0.04, 0.005);
        const label = new THREE.Mesh(labelGeo, labelMat);
        label.position.set(xOffset, cabinetH * 0.55 + meterHeight / 2 + 0.04, d / 2 + 0.04);
        group.add(label);

        // Store reference for updates based on type
        const fullHeight = meterHeight - 0.06;
        const baseY = cabinetH * 0.55;

        // Initialize battery fill to full (scale.y = 1.0, green color)
        fill.scale.y = 1.0;
        fill.material.color.setHex(0x22ff22);
        fill.visible = true;
        fill.renderOrder = 10; // Ensure it renders on top
        fill.material.depthTest = true;
        fill.material.depthWrite = true;
        console.log(`🔋 Created ${type} battery fill: uuid=${fill.uuid}, pos=(${fill.position.x.toFixed(3)},${fill.position.y.toFixed(3)},${fill.position.z.toFixed(3)}), scale=(${fill.scale.x},${fill.scale.y},${fill.scale.z})`);

        if (type === 'main') {
            this.mainBatteryFill = fill;
            this.mainBatteryFullHeight = fullHeight;
            this.mainBatteryBaseY = baseY;
            // Also keep old references for compatibility
            this.batteryFill = fill;
            this.batteryFullHeight = fullHeight;
            this.batteryBaseY = baseY;
        } else {
            this.backupBatteryFill = fill;
            this.backupBatteryFullHeight = fullHeight;
            this.backupBatteryBaseY = baseY;
        }

        cabinet.add(group);
        return group;
    }

    createAnalogGauge(cabinet, cabinetH, cabinetD, needleColor, type) {
        const group = new THREE.Group();

        // Gauge face (white circle)
        const faceGeo = new THREE.CircleGeometry(0.12, 32);
        const faceMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const face = new THREE.Mesh(faceGeo, faceMat);
        face.position.set(-0.2, cabinetH * 0.7, cabinetD / 2 + 0.025);
        group.add(face);

        // Gauge rim
        const rimGeo = new THREE.RingGeometry(0.11, 0.13, 32);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.6 });
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.position.set(-0.2, cabinetH * 0.7, cabinetD / 2 + 0.026);
        group.add(rim);

        // Needle
        const needleGeo = new THREE.BoxGeometry(0.08, 0.015, 0.005);
        const needleMat = new THREE.MeshBasicMaterial({ color: needleColor });
        const needle = new THREE.Mesh(needleGeo, needleMat);
        needle.position.set(-0.2, cabinetH * 0.7, cabinetD / 2 + 0.03);
        needle.geometry.translate(0.04, 0, 0); // Pivot at one end
        group.add(needle);

        // Store reference
        if (type === 'TEMP') {
            this.tempNeedle = needle;
        } else {
            this.pressureNeedle = needle;
        }

        cabinet.add(group);
        return group;
    }

    createStatusLight(cabinet, cabinetH, cabinetD, isOn) {
        const lightGeo = new THREE.CircleGeometry(0.06, 16);
        const lightMat = new THREE.MeshBasicMaterial({ color: isOn ? 0x22ff22 : 0x1a3d1a });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(0, cabinetH * 0.85, cabinetD / 2 + 0.025);
        cabinet.add(light);
        return light;
    }

    addBatteryCells(cabinet, cabinetH, cabinetD) {
        // Industrial battery cell array visual on top of cabinet
        const cellMat = new THREE.MeshStandardMaterial({
            color: 0x2a4a6a,
            roughness: 0.3,
            metalness: 0.7
        });
        const terminalMat = new THREE.MeshStandardMaterial({
            color: 0xcc8833,
            roughness: 0.2,
            metalness: 0.9
        });

        // Battery cells on top
        for (let i = 0; i < 3; i++) {
            const cellGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 12);
            const cell = new THREE.Mesh(cellGeo, cellMat);
            cell.position.set(-0.2 + i * 0.2, cabinetH + 0.15, 0);
            cell.castShadow = true;
            cabinet.add(cell);

            // Terminals
            const termGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8);
            const term = new THREE.Mesh(termGeo, terminalMat);
            term.position.set(-0.2 + i * 0.2, cabinetH + 0.28, 0);
            cabinet.add(term);
        }

        // Connecting wires between cells
        const wireMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
        const wireGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.16, 6);
        for (let i = 0; i < 2; i++) {
            const wire = new THREE.Mesh(wireGeo, wireMat);
            wire.rotation.z = Math.PI / 2;
            wire.position.set(-0.1 + i * 0.2, cabinetH + 0.28, 0);
            cabinet.add(wire);
        }
    }

    addOilBarrel(cabinet, cabinetH, cabinetD) {
        // Oil drum/barrel next to cabinet
        const barrelMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a2a,
            roughness: 0.4,
            metalness: 0.3
        });
        const bandMat = new THREE.MeshStandardMaterial({
            color: 0xeab308,
            roughness: 0.3,
            metalness: 0.5
        });

        // Main barrel
        const barrelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16);
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0.55, 0.3, 0);
        barrel.castShadow = true;
        cabinet.add(barrel);

        // Yellow bands
        const bandGeo = new THREE.TorusGeometry(0.21, 0.02, 8, 16);
        const topBand = new THREE.Mesh(bandGeo, bandMat);
        topBand.rotation.x = Math.PI / 2;
        topBand.position.set(0.55, 0.55, 0);
        cabinet.add(topBand);

        const bottomBand = new THREE.Mesh(bandGeo, bandMat);
        bottomBand.rotation.x = Math.PI / 2;
        bottomBand.position.set(0.55, 0.05, 0);
        cabinet.add(bottomBand);

        // Oil cap on top
        const capMat = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.2,
            metalness: 0.6
        });
        const capGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12);
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(0.55, 0.62, 0.08);
        cabinet.add(cap);

        // Oil level sight glass
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.1,
            metalness: 0.1,
            transparent: true,
            opacity: 0.7
        });
        const glassGeo = new THREE.BoxGeometry(0.03, 0.3, 0.02);
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(0.55, 0.3, 0.21);
        cabinet.add(glass);
    }

    addPressureTank(cabinet, cabinetH, cabinetD) {
        // Pressure accumulator tank
        const tankMat = new THREE.MeshStandardMaterial({
            color: 0xcc3333,
            roughness: 0.3,
            metalness: 0.6
        });
        const capMat = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.2,
            metalness: 0.8
        });

        // Main pressure vessel (capsule shape using cylinder + sphere caps)
        const tankGroup = new THREE.Group();

        // Cylinder body
        const cylinderGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 16);
        const cylinder = new THREE.Mesh(cylinderGeo, tankMat);
        tankGroup.add(cylinder);

        // Top sphere cap
        const sphereGeo = new THREE.SphereGeometry(0.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const topSphere = new THREE.Mesh(sphereGeo, tankMat);
        topSphere.position.y = 0.2;
        tankGroup.add(topSphere);

        // Bottom sphere cap
        const bottomSphere = new THREE.Mesh(sphereGeo, tankMat);
        bottomSphere.rotation.x = Math.PI;
        bottomSphere.position.y = -0.2;
        tankGroup.add(bottomSphere);

        tankGroup.position.set(0.55, 0.5, 0);
        tankGroup.castShadow = true;
        cabinet.add(tankGroup);

        // Top cap/valve
        const topCapGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.1, 12);
        const topCap = new THREE.Mesh(topCapGeo, capMat);
        topCap.position.set(0.55, 0.9, 0);
        cabinet.add(topCap);

        // Pressure relief valve
        const valveGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.08, 8);
        const valve = new THREE.Mesh(valveGeo, capMat);
        valve.rotation.z = Math.PI / 2;
        valve.position.set(0.55, 0.7, 0.18);
        cabinet.add(valve);

        // Mounting bracket
        const bracketMat = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.4,
            metalness: 0.5
        });
        const bracketGeo = new THREE.TorusGeometry(0.17, 0.02, 8, 16, Math.PI);
        const bracket = new THREE.Mesh(bracketGeo, bracketMat);
        bracket.rotation.y = Math.PI / 2;
        bracket.position.set(0.55, 0.4, 0);
        cabinet.add(bracket);

        // Warning label (small red stripe)
        const labelMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const labelGeo = new THREE.BoxGeometry(0.2, 0.05, 0.01);
        const label = new THREE.Mesh(labelGeo, labelMat);
        label.position.set(0.55, 0.5, 0.16);
        cabinet.add(label);
    }

    createFloorCable(start, end, material, thickness) {
        // Cable runs along floor with slight curves at ends
        const points = [
            new THREE.Vector3(start.x, 0.02, start.z + 0.3),
            new THREE.Vector3(start.x, 0.02, start.z + 1),
            new THREE.Vector3(end.x, 0.02, end.z - 1),
            new THREE.Vector3(end.x, 0.02, end.z)
        ];

        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeo = new THREE.TubeGeometry(curve, 24, thickness, 8, false);
        const cable = new THREE.Mesh(tubeGeo, material);
        cable.receiveShadow = true;
        this.infrastructure.add(cable);
    }

    // Update battery level visual (0-100) for a specific battery
    updateBatteryLevel(powerLevel, batteryType = 'active') {
        console.log(`🔋 updateBatteryLevel: type=${batteryType}, level=${powerLevel}`);

        // Determine which battery fill to update
        let fill, fullHeight, baseY;

        if (batteryType === 'main') {
            fill = this.mainBatteryFill;
            fullHeight = this.mainBatteryFullHeight;
            baseY = this.mainBatteryBaseY;
        } else if (batteryType === 'backup') {
            fill = this.backupBatteryFill;
            fullHeight = this.backupBatteryFullHeight;
            baseY = this.backupBatteryBaseY;
            console.log(`🔋 Backup battery refs: fill=${!!fill}, fullHeight=${fullHeight}, baseY=${baseY}`);
        } else {
            // 'active' - use old reference for compatibility
            fill = this.batteryFill;
            fullHeight = this.batteryFullHeight;
            baseY = this.batteryBaseY;
        }

        if (!fill) {
            console.log(`🔋 WARNING: No fill found for ${batteryType} battery!`);
            return;
        }

        const normalizedLevel = Math.max(0, Math.min(100, powerLevel)) / 100;
        const newHeight = fullHeight * normalizedLevel;
        fill.scale.y = normalizedLevel || 0.01;
        fill.position.y = baseY - (fullHeight - newHeight) / 2;
        fill.visible = true;
        fill.material.needsUpdate = true;

        // Get world position for debugging
        const worldPos = new THREE.Vector3();
        fill.getWorldPosition(worldPos);
        console.log(`🔋 Set ${batteryType} battery: scale.y=${fill.scale.y}, localPos.y=${fill.position.y.toFixed(3)}, worldPos=(${worldPos.x.toFixed(2)},${worldPos.y.toFixed(2)},${worldPos.z.toFixed(2)}), parent=${fill.parent?.type || 'none'}`);

        // Color based on level
        if (normalizedLevel > 0.5) {
            fill.material.color.setHex(0x22ff22);
        } else if (normalizedLevel > 0.25) {
            fill.material.color.setHex(0xffaa00);
        } else {
            fill.material.color.setHex(0xff3333);
        }
    }

    // Update both batteries based on which is connected
    updateBatteries(mainLevel, backupLevel, isBackupActive) {
        console.log(`🔋 updateBatteries called: mainLevel=${mainLevel}, backupLevel=${backupLevel}, isBackupActive=${isBackupActive}`);

        // Inactive battery shows full charge, active battery shows actual level
        if (isBackupActive) {
            // Backup is active - show main as full, backup as actual level
            console.log('🔋 Backup active: setting main=100, backup=' + backupLevel);
            this.updateBatteryLevel(100, 'main');
            this.updateBatteryLevel(backupLevel, 'backup');
        } else {
            // Main is active - show backup as full, main as actual level
            console.log('🔋 Main active: setting main=' + mainLevel + ', backup=100');
            this.updateBatteryLevel(mainLevel, 'main');
            this.updateBatteryLevel(100, 'backup');
        }

        // Both batteries show their level-based color (set in updateBatteryLevel)
        // No additional visual indicator for active/inactive - the LED strip handles that
    }

    // Update temperature gauge (20-120°C mapped to needle rotation)
    updateTemperatureGauge(temp) {
        if (!this.tempNeedle) return;
        // Map 20-120 to -135° to +135° (-0.75π to 0.75π)
        const normalized = (temp - 20) / 100;
        const angle = -0.75 * Math.PI + normalized * 1.5 * Math.PI;
        this.tempNeedle.rotation.z = -angle;
    }

    // Update pressure gauge (100-200 bar mapped to needle rotation)
    updatePressureGauge(pressure) {
        if (!this.pressureNeedle) return;
        // Map 100-200 to -135° to +135°
        const normalized = (pressure - 100) / 100;
        const angle = -0.75 * Math.PI + normalized * 1.5 * Math.PI;
        this.pressureNeedle.rotation.z = -angle;
    }

    // Toggle backup generator visual (now handled via status LED strips)
    setBackupPowerVisual(isOn) {
        // This is now handled by the status light system via LED strips
        // The backup battery LED will show green/orange/red based on its level
    }

    // Update status lights based on sensor readings
    // status: 'nominal', 'warning', 'critical'
    updateStatusLights(sensorData) {
        // Initialize status light state tracking if not exists
        if (!this.statusLightStates) {
            this.statusLightStates = {
                mainBattery: { status: 'nominal', blinkOn: true },
                backupBattery: { status: 'nominal', blinkOn: true },
                oilBarrel: { status: 'nominal', blinkOn: true },
                pressureTank: { status: 'nominal', blinkOn: true }
            };
        }

        // Determine status based on sensor values
        // Main battery
        if (sensorData.powerLevel !== undefined) {
            if (sensorData.powerLevel > 50) {
                this.statusLightStates.mainBattery.status = 'nominal';
            } else if (sensorData.powerLevel > 25) {
                this.statusLightStates.mainBattery.status = 'warning';
            } else {
                this.statusLightStates.mainBattery.status = 'critical';
            }
        }

        // Backup battery
        if (sensorData.backupLevel !== undefined) {
            if (sensorData.backupLevel > 50) {
                this.statusLightStates.backupBattery.status = 'nominal';
            } else if (sensorData.backupLevel > 25) {
                this.statusLightStates.backupBattery.status = 'warning';
            } else {
                this.statusLightStates.backupBattery.status = 'critical';
            }
        }

        // Oil/Temperature - matches CONFIG: WARNING >= 75°C, CRITICAL >= 85°C
        if (sensorData.oilTemp !== undefined) {
            if (sensorData.oilTemp < 75) {
                this.statusLightStates.oilBarrel.status = 'nominal';
            } else if (sensorData.oilTemp < 85) {
                this.statusLightStates.oilBarrel.status = 'warning';
            } else {
                this.statusLightStates.oilBarrel.status = 'critical';
            }
        }

        // Pressure - matches CONFIG: WARNING <= 135 bar, CRITICAL <= 125 bar
        if (sensorData.pressure !== undefined) {
            if (sensorData.pressure > 135) {
                this.statusLightStates.pressureTank.status = 'nominal';
            } else if (sensorData.pressure > 125) {
                this.statusLightStates.pressureTank.status = 'warning';
            } else {
                this.statusLightStates.pressureTank.status = 'critical';
            }
        }
    }

    // Called in animate loop to handle blinking
    updateStatusLightBlink() {
        if (!this.statusLightStates) return;

        const time = Date.now();
        const warningBlinkRate = 500; // ms
        const criticalBlinkRate = 200; // ms

        // Use the cabinet LED strips instead of separate status lights
        const lights = [
            { state: this.statusLightStates.mainBattery, light: this.mainBatteryLED },
            { state: this.statusLightStates.backupBattery, light: this.backupBatteryLED },
            { state: this.statusLightStates.oilBarrel, light: this.oilLED },
            { state: this.statusLightStates.pressureTank, light: this.pressureLED }
        ];

        for (const { state, light } of lights) {
            if (!light) continue;

            let color;
            if (state.status === 'nominal') {
                color = 0x22ff22; // Green, solid
            } else if (state.status === 'warning') {
                // Blink orange
                const blinkOn = Math.floor(time / warningBlinkRate) % 2 === 0;
                color = blinkOn ? 0xff9500 : 0x332200;
            } else {
                // Critical - blink red faster
                const blinkOn = Math.floor(time / criticalBlinkRate) % 2 === 0;
                color = blinkOn ? 0xff0000 : 0x330000;
            }

            light.material.color.setHex(color);
        }
    }

    createConveyor() {
        this.conveyor = new THREE.Group();

        // Use PBR corrugated iron texture for the frame
        const corrugatedTex = this.textures.corrugated;
        corrugatedTex.diffuse.repeat.set(4, 1);
        corrugatedTex.roughness.repeat.set(4, 1);
        corrugatedTex.normal.repeat.set(4, 1);

        // Conveyor frame - industrial corrugated metal
        const frameGeometry = new THREE.BoxGeometry(8, 0.15, 1.6);
        const frameMaterial = new THREE.MeshStandardMaterial({
            map: corrugatedTex.diffuse,
            roughnessMap: corrugatedTex.roughness,
            normalMap: corrugatedTex.normal,
            normalScale: new THREE.Vector2(0.8, 0.8),
            roughness: 0.6,
            metalness: 0.8,
            envMapIntensity: 1.0
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.set(0, 0.075, 0);
        frame.castShadow = true;
        frame.receiveShadow = true;
        this.conveyor.add(frame);

        // Rubber conveyor belt surface
        const rubberCanvas = document.createElement('canvas');
        rubberCanvas.width = 512;
        rubberCanvas.height = 128;
        const rCtx = rubberCanvas.getContext('2d');
        rCtx.fillStyle = '#1a1a1a';
        rCtx.fillRect(0, 0, 512, 128);
        // Add belt tread pattern
        rCtx.fillStyle = '#252525';
        for (let i = 0; i < 512; i += 32) {
            rCtx.fillRect(i, 0, 16, 128);
        }
        // Add subtle texture
        for (let i = 0; i < 5000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 128;
            const val = Math.random() * 15 + 20;
            rCtx.fillStyle = `rgb(${val}, ${val}, ${val})`;
            rCtx.fillRect(x, y, 1, 1);
        }
        const rubberTexture = new THREE.CanvasTexture(rubberCanvas);
        rubberTexture.wrapS = THREE.RepeatWrapping;
        rubberTexture.repeat.set(8, 1);

        const beltGeometry = new THREE.BoxGeometry(7.8, 0.05, 1.3);
        const beltMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            map: rubberTexture,
            roughness: 0.8,
            metalness: 0.0,
            envMapIntensity: 0.3
        });
        const belt = new THREE.Mesh(beltGeometry, beltMaterial);
        belt.position.set(0, 0.175, 0);
        belt.receiveShadow = true;
        this.conveyor.add(belt);

        // Side rails - polished aluminum
        const railGeo = new THREE.BoxGeometry(8, 0.12, 0.08);
        const railMat = new THREE.MeshStandardMaterial({
            color: 0x9a9a9a,
            roughness: 0.1,
            metalness: 0.95,
            envMapIntensity: 2.0
        });
        const railL = new THREE.Mesh(railGeo, railMat);
        railL.position.set(0, 0.21, 0.72);
        railL.castShadow = true;
        this.conveyor.add(railL);
        const railR = railL.clone();
        railR.position.z = -0.72;
        this.conveyor.add(railR);

        // End rollers - chrome
        const rollerGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.5, 24);
        const rollerMat = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            roughness: 0.05,
            metalness: 1.0,
            envMapIntensity: 2.5
        });
        const roller1 = new THREE.Mesh(rollerGeo, rollerMat);
        roller1.rotation.x = Math.PI / 2;
        roller1.position.set(-3.9, 0.1, 0);
        roller1.castShadow = true;
        this.conveyor.add(roller1);
        const roller2 = roller1.clone();
        roller2.position.x = 3.9;
        this.conveyor.add(roller2);

        // Conveyor supports - industrial painted steel
        const supportGeometry = new THREE.BoxGeometry(0.15, 1, 0.15);
        const supportMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a5a3a,  // Industrial green
            roughness: 0.5,
            metalness: 0.3,
            envMapIntensity: 0.8
        });

        // Cross braces
        const braceGeo = new THREE.BoxGeometry(0.08, 0.08, 1.2);
        const braceMat = new THREE.MeshStandardMaterial({
            color: 0x3a5a3a,
            roughness: 0.5,
            metalness: 0.3
        });

        for (let i = -3; i <= 3; i += 2) {
            const support = new THREE.Mesh(supportGeometry, supportMaterial);
            support.position.set(i, -0.5, 0.7);
            support.castShadow = true;
            this.conveyor.add(support);

            const support2 = support.clone();
            support2.position.z = -0.7;
            this.conveyor.add(support2);

            // Add cross brace
            const brace = new THREE.Mesh(braceGeo, braceMat);
            brace.position.set(i, -0.6, 0);
            this.conveyor.add(brace);
        }

        // Foot pads
        const footGeo = new THREE.BoxGeometry(0.25, 0.03, 0.25);
        const footMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.7,
            metalness: 0.2
        });
        for (let i = -3; i <= 3; i += 2) {
            const foot1 = new THREE.Mesh(footGeo, footMat);
            foot1.position.set(i, -1.0, 0.7);
            this.conveyor.add(foot1);
            const foot2 = foot1.clone();
            foot2.position.z = -0.7;
            this.conveyor.add(foot2);
        }

        this.conveyor.position.set(0, 1, 0);
        this.scene.add(this.conveyor);
    }
    
    createRobotArm() {
        this.robot = new THREE.Group();

        // Create subtle orange peel texture for painted surfaces
        const paintCanvas = document.createElement('canvas');
        paintCanvas.width = 256;
        paintCanvas.height = 256;
        const pCtx = paintCanvas.getContext('2d');
        pCtx.fillStyle = '#f5a623';
        pCtx.fillRect(0, 0, 256, 256);
        // Add subtle orange peel texture variation
        for (let i = 0; i < 3000; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            const brightness = Math.random() * 20 - 10;
            pCtx.fillStyle = `rgba(${245 + brightness}, ${166 + brightness}, ${35 + brightness}, 0.3)`;
            pCtx.beginPath();
            pCtx.arc(x, y, Math.random() * 3 + 1, 0, Math.PI * 2);
            pCtx.fill();
        }
        const paintTexture = new THREE.CanvasTexture(paintCanvas);

        // Industrial robot materials - FANUC-style with realistic finishes
        // Body: Automotive-quality paint with slight orange peel
        const bodyMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xf5a623,
            map: paintTexture,
            roughness: 0.35,
            metalness: 0.0,
            clearcoat: 0.8,
            clearcoatRoughness: 0.2,
            envMapIntensity: 1.0
        });

        // Accent: Powder-coated dark finish
        const accentMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.4,
            metalness: 0.3,
            envMapIntensity: 0.8
        });

        // Joints: Machined aluminum/steel with PBR metal texture
        const robotMetalTex = this.textures.metal;
        const jointMaterial = new THREE.MeshStandardMaterial({
            color: 0x6a6a6a,
            map: robotMetalTex.diffuse,
            roughnessMap: robotMetalTex.roughness,
            normalMap: robotMetalTex.normal,
            normalScale: new THREE.Vector2(0.3, 0.3),
            roughness: 0.25,
            metalness: 0.95,
            envMapIntensity: 1.5
        });

        // Details: Cast iron / machined parts
        const detailMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a4a4a,
            map: robotMetalTex.diffuse,
            roughnessMap: robotMetalTex.roughness,
            normalMap: robotMetalTex.normal,
            normalScale: new THREE.Vector2(0.4, 0.4),
            roughness: 0.4,
            metalness: 0.7,
            envMapIntensity: 1.0
        });

        // Base: Stylized industrial texture (industrial_wall_5)
        const robotBaseTex = this.textures.robotBase;
        robotBaseTex.diffuse.repeat.set(2, 2);
        robotBaseTex.roughness.repeat.set(2, 2);
        robotBaseTex.normal.repeat.set(2, 2);
        robotBaseTex.ao.repeat.set(2, 2);

        const baseMaterial = new THREE.MeshStandardMaterial({
            map: robotBaseTex.diffuse,
            roughnessMap: robotBaseTex.roughness,
            normalMap: robotBaseTex.normal,
            aoMap: robotBaseTex.ao,
            normalScale: new THREE.Vector2(1.0, 1.0),
            roughness: 0.6,
            metalness: 0.7,
            envMapIntensity: 0.8
        });

        // === BASE PEDESTAL ===
        // Large stable base - metallic silver like reference
        const basePlateGeo = new THREE.CylinderGeometry(0.8, 0.9, 0.15, 32);
        const basePlate = new THREE.Mesh(basePlateGeo, baseMaterial);
        basePlate.position.y = 0.075;
        basePlate.castShadow = true;
        basePlate.receiveShadow = true;
        this.robot.add(basePlate);

        // Base column - silver metallic
        const baseColumnGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.6, 32);
        const baseColumn = new THREE.Mesh(baseColumnGeo, baseMaterial);
        baseColumn.position.y = 0.45;
        baseColumn.castShadow = true;
        this.robot.add(baseColumn);

        // Base top ring - darker accent
        const baseRingGeo = new THREE.TorusGeometry(0.5, 0.08, 16, 32);
        const baseRing = new THREE.Mesh(baseRingGeo, jointMaterial);
        baseRing.position.y = 0.75;
        baseRing.rotation.x = Math.PI / 2;
        this.robot.add(baseRing);

        // === ROTATING BASE (J1) ===
        this.basePivot = new THREE.Group();
        this.basePivot.position.y = 0.75;
        this.robot.add(this.basePivot);

        // Turret housing
        const turretGeo = new THREE.CylinderGeometry(0.45, 0.5, 0.35, 32);
        const turret = new THREE.Mesh(turretGeo, bodyMaterial);
        turret.position.y = 0.175;
        turret.castShadow = true;
        this.basePivot.add(turret);

        // === SHOULDER MOUNT ===
        // Shoulder housing - more industrial shape
        const shoulderHousingGeo = new THREE.BoxGeometry(0.6, 0.5, 0.4);
        const shoulderHousing = new THREE.Mesh(shoulderHousingGeo, bodyMaterial);
        shoulderHousing.position.set(0, 0.6, 0);
        shoulderHousing.castShadow = true;
        this.basePivot.add(shoulderHousing);

        // Shoulder joint discs (visible motor housings)
        const shoulderDiscGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.15, 24);
        const shoulderDiscL = new THREE.Mesh(shoulderDiscGeo, jointMaterial);
        shoulderDiscL.rotation.x = Math.PI / 2;
        shoulderDiscL.position.set(0, 0.6, 0.25);
        shoulderDiscL.castShadow = true;
        this.basePivot.add(shoulderDiscL);

        const shoulderDiscR = new THREE.Mesh(shoulderDiscGeo, jointMaterial);
        shoulderDiscR.rotation.x = Math.PI / 2;
        shoulderDiscR.position.set(0, 0.6, -0.25);
        shoulderDiscR.castShadow = true;
        this.basePivot.add(shoulderDiscR);

        // === UPPER ARM (J2) ===
        this.upperArmPivot = new THREE.Group();
        this.upperArmPivot.position.set(0, 0.6, 0);
        this.basePivot.add(this.upperArmPivot);

        // Upper arm - curved industrial profile
        const upperArmGroup = new THREE.Group();

        // Main upper arm body - tapered
        const upperArmGeo = new THREE.CylinderGeometry(0.15, 0.18, 1.4, 24);
        this.upperArm = new THREE.Mesh(upperArmGeo, bodyMaterial);
        this.upperArm.position.y = 0.7;
        this.upperArm.castShadow = true;
        upperArmGroup.add(this.upperArm);

        // Upper arm covers (side panels)
        const armCoverGeo = new THREE.BoxGeometry(0.35, 1.2, 0.08);
        const armCoverFront = new THREE.Mesh(armCoverGeo, bodyMaterial);
        armCoverFront.position.set(0, 0.7, 0.12);
        armCoverFront.castShadow = true;
        upperArmGroup.add(armCoverFront);

        const armCoverBack = new THREE.Mesh(armCoverGeo, bodyMaterial);
        armCoverBack.position.set(0, 0.7, -0.12);
        armCoverBack.castShadow = true;
        upperArmGroup.add(armCoverBack);

        // Decorative lines on upper arm
        const lineGeo = new THREE.BoxGeometry(0.02, 1.0, 0.14);
        const line1 = new THREE.Mesh(lineGeo, detailMaterial);
        line1.position.set(0.17, 0.7, 0);
        upperArmGroup.add(line1);
        const line2 = new THREE.Mesh(lineGeo, detailMaterial);
        line2.position.set(-0.17, 0.7, 0);
        upperArmGroup.add(line2);

        this.upperArmPivot.add(upperArmGroup);

        // === ELBOW JOINT (J3) ===
        // Elbow motor housing
        const elbowHousingGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.35, 24);
        const elbowHousing = new THREE.Mesh(elbowHousingGeo, jointMaterial);
        elbowHousing.rotation.x = Math.PI / 2;
        elbowHousing.position.set(0, 1.4, 0);
        elbowHousing.castShadow = true;
        this.upperArmPivot.add(elbowHousing);

        // Elbow caps
        const elbowCapGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 24);
        const elbowCapL = new THREE.Mesh(elbowCapGeo, detailMaterial);
        elbowCapL.rotation.x = Math.PI / 2;
        elbowCapL.position.set(0, 1.4, 0.2);
        this.upperArmPivot.add(elbowCapL);

        const elbowCapR = new THREE.Mesh(elbowCapGeo, detailMaterial);
        elbowCapR.rotation.x = Math.PI / 2;
        elbowCapR.position.set(0, 1.4, -0.2);
        this.upperArmPivot.add(elbowCapR);

        // === FOREARM (J4) ===
        this.forearmPivot = new THREE.Group();
        this.forearmPivot.position.set(0, 1.4, 0);
        this.upperArmPivot.add(this.forearmPivot);

        // Forearm body - sleeker
        const forearmGeo = new THREE.CylinderGeometry(0.1, 0.14, 1.1, 24);
        this.forearm = new THREE.Mesh(forearmGeo, bodyMaterial);
        this.forearm.position.y = 0.55;
        this.forearm.castShadow = true;
        this.forearmPivot.add(this.forearm);

        // Forearm cover
        const forearmCoverGeo = new THREE.BoxGeometry(0.26, 0.9, 0.06);
        const forearmCover = new THREE.Mesh(forearmCoverGeo, bodyMaterial);
        forearmCover.position.set(0, 0.55, 0.08);
        forearmCover.castShadow = true;
        this.forearmPivot.add(forearmCover);

        // === WRIST (J5) ===
        const wristHousingGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 24);
        const wristHousing = new THREE.Mesh(wristHousingGeo, jointMaterial);
        wristHousing.rotation.x = Math.PI / 2;
        wristHousing.position.set(0, 1.1, 0);
        wristHousing.castShadow = true;
        this.forearmPivot.add(wristHousing);

        // === WRIST ROTATE (J6) ===
        this.wristPivot = new THREE.Group();
        this.wristPivot.position.set(0, 1.1, 0);
        this.forearmPivot.add(this.wristPivot);

        // Tool flange
        const flangeGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.15, 24);
        const flange = new THREE.Mesh(flangeGeo, detailMaterial);
        flange.position.y = 0.1;
        flange.castShadow = true;
        this.wristPivot.add(flange);

        // === WELDING TORCH ===
        const toolMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.1,
            metalness: 0.95,
            envMapIntensity: 1.5
        });

        // Torch body
        const torchBodyGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.3, 16);
        this.torch = new THREE.Mesh(torchBodyGeo, toolMaterial);
        this.torch.position.y = 0.32;
        this.torch.castShadow = true;
        this.wristPivot.add(this.torch);

        // Torch neck (angled)
        const torchNeckGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.2, 12);
        const torchNeck = new THREE.Mesh(torchNeckGeo, toolMaterial);
        torchNeck.position.set(0, 0.52, 0.05);
        torchNeck.rotation.x = 0.3;
        torchNeck.castShadow = true;
        this.wristPivot.add(torchNeck);

        // Welding tip (glowing when active)
        const tipGeometry = new THREE.SphereGeometry(0.04, 16, 16);
        this.weldingTipMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6600,
            emissive: 0xff6600,
            emissiveIntensity: 0
        });
        this.weldingTip = new THREE.Mesh(tipGeometry, this.weldingTipMaterial);
        this.weldingTip.position.set(0, 0.65, 0.1);
        this.wristPivot.add(this.weldingTip);

        // === CABLE BUNDLE ===
        this.createCableBundle();

        // Position robot behind conveyor
        // Robot base at Y=0, conveyor at Y=1, items at Y=1.38
        this.robot.position.set(this.weldZone - 0.3, 0, -2.4);
        this.scene.add(this.robot);

        // Arm angles for new structure - need to reach forward and down to items
        // Positive X rotation = bend toward positive Z (toward conveyor)
        // Keep good range of motion, but shift down to reach items
        this.homeUpperArmAngle = 0.4;    // Home - slight forward
        this.homeForearmAngle = 0.6;     // Home - bent forward
        this.weldUpperArmAngle = 0.8;    // Weld - reach to item
        this.weldForearmAngle = 1.1;     // Weld - bent toward item

        // Set initial pose
        this.upperArmPivot.rotation.x = this.homeUpperArmAngle;
        this.forearmPivot.rotation.x = this.homeForearmAngle;
    }

    createCableBundle() {
        // Cable bundle running along the arm
        const cableMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.6,
            metalness: 0.1
        });

        // Cable on upper arm
        const cableGeo1 = new THREE.CylinderGeometry(0.025, 0.025, 1.2, 8);
        const cable1 = new THREE.Mesh(cableGeo1, cableMaterial);
        cable1.position.set(0.18, 0.7, 0);
        this.upperArmPivot.add(cable1);

        // Cable on forearm
        const cableGeo2 = new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8);
        const cable2 = new THREE.Mesh(cableGeo2, cableMaterial);
        cable2.position.set(0.12, 0.55, 0);
        this.forearmPivot.add(cable2);

        // Cable clamps
        const clampMaterial = new THREE.MeshStandardMaterial({
            color: 0x505050,
            roughness: 0.3,
            metalness: 0.7
        });
        const clampGeo = new THREE.TorusGeometry(0.035, 0.01, 8, 12);

        for (let i = 0; i < 3; i++) {
            const clamp = new THREE.Mesh(clampGeo, clampMaterial);
            clamp.position.set(0.18, 0.3 + i * 0.4, 0);
            clamp.rotation.y = Math.PI / 2;
            this.upperArmPivot.add(clamp);
        }
    }

    createRobotLEDs() {
        // LED materials
        this.ledOnMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.ledOffMat = new THREE.MeshBasicMaterial({ color: 0x003300 });
        this.ledWarningMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        this.ledCriticalMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        const ledGeo = new THREE.SphereGeometry(0.03, 8, 8);
        this.robotLEDs = [];

        // LED on base (turret)
        const baseLED = new THREE.Mesh(ledGeo, this.ledOnMat);
        baseLED.position.set(0.4, 0.35, 0);
        this.basePivot.add(baseLED);
        this.robotLEDs.push(baseLED);

        // LED on shoulder
        const shoulderLED = new THREE.Mesh(ledGeo, this.ledOnMat);
        shoulderLED.position.set(0.3, 0.6, 0.2);
        this.basePivot.add(shoulderLED);
        this.robotLEDs.push(shoulderLED);

        // LED on upper arm
        const upperArmLED = new THREE.Mesh(ledGeo, this.ledOnMat);
        upperArmLED.position.set(0.2, 1.2, 0.15);
        this.upperArmPivot.add(upperArmLED);
        this.robotLEDs.push(upperArmLED);

        // LED on elbow
        const elbowLED = new THREE.Mesh(ledGeo, this.ledOnMat);
        elbowLED.position.set(0.22, 1.4, 0.15);
        this.upperArmPivot.add(elbowLED);
        this.robotLEDs.push(elbowLED);

        // LED on forearm
        const forearmLED = new THREE.Mesh(ledGeo, this.ledOnMat);
        forearmLED.position.set(0.15, 0.8, 0.12);
        this.forearmPivot.add(forearmLED);
        this.robotLEDs.push(forearmLED);

        // LED on wrist
        const wristLED = new THREE.Mesh(ledGeo, this.ledOnMat);
        wristLED.position.set(0.08, 0.45, 0.08);
        this.wristPivot.add(wristLED);
        this.robotLEDs.push(wristLED);
    }

    createConveyorLEDs() {
        // Status LEDs along conveyor
        const ledGeo = new THREE.SphereGeometry(0.04, 8, 8);
        this.conveyorLEDs = [];

        // LEDs on conveyor supports
        const ledPositions = [-3, -1, 1, 3];
        for (const x of ledPositions) {
            const led = new THREE.Mesh(ledGeo, this.ledOnMat);
            led.position.set(x, 0.6, 0.65);
            this.conveyor.add(led);
            this.conveyorLEDs.push(led);
        }

        // Start/end indicator LEDs (larger)
        const endLedGeo = new THREE.SphereGeometry(0.06, 12, 12);

        const startLED = new THREE.Mesh(endLedGeo, this.ledOnMat);
        startLED.position.set(-4, 0.3, 0);
        this.conveyor.add(startLED);
        this.conveyorLEDs.push(startLED);
        this.conveyorStartLED = startLED;

        const endLED = new THREE.Mesh(endLedGeo, this.ledOnMat);
        endLED.position.set(4, 0.3, 0);
        this.conveyor.add(endLED);
        this.conveyorLEDs.push(endLED);
        this.conveyorEndLED = endLED;
    }

    updateLEDStatus(state) {
        // Update all LEDs based on factory state
        let material;
        if (state === CONFIG.STATES.CRITICAL) {
            material = this.ledCriticalMat;
        } else if (state === CONFIG.STATES.DEGRADED) {
            material = this.ledWarningMat;
        } else if (state === CONFIG.STATES.PAUSED) {
            material = this.ledOffMat;
        } else {
            material = this.ledOnMat;
        }

        // Update robot LEDs
        for (const led of this.robotLEDs) {
            led.material = material;
        }

        // Update conveyor LEDs
        for (const led of this.conveyorLEDs) {
            led.material = material;
        }
    }

    createSparks() {
        // Create spark particles for welding effect
        this.sparkGroup = new THREE.Group();
        this.scene.add(this.sparkGroup);

        const sparkGeometry = new THREE.SphereGeometry(0.03, 8, 8);
        // Orange/red welding sparks
        const sparkMaterials = [
            new THREE.MeshBasicMaterial({ color: 0xffff00 }),
            new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
            new THREE.MeshBasicMaterial({ color: 0xff6600 }),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        ];

        // Pre-create spark pool
        for (let i = 0; i < 30; i++) {
            const spark = new THREE.Mesh(
                sparkGeometry,
                sparkMaterials[Math.floor(Math.random() * sparkMaterials.length)]
            );
            spark.visible = false;
            spark.userData = { velocity: new THREE.Vector3(), life: 0 };
            this.sparks.push(spark);
            this.sparkGroup.add(spark);
        }
    }

    setupControls() {
        // Simple orbit controls with mouse
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let rotation = { x: 0, y: 0 };

        this.container.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.container.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;

                rotation.y += deltaX * 0.005;
                rotation.x += deltaY * 0.005;
                rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotation.x));

                const radius = 12;
                this.camera.position.x = radius * Math.sin(rotation.y) * Math.cos(rotation.x);
                this.camera.position.y = radius * Math.sin(rotation.x) + 4;
                this.camera.position.z = radius * Math.cos(rotation.y) * Math.cos(rotation.x);
                this.camera.lookAt(0, 2, 0);

                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        this.container.addEventListener('mouseup', () => {
            isDragging = false;
        });

        this.container.addEventListener('mouseleave', () => {
            isDragging = false;
        });

        // Zoom with mouse wheel
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY * 0.01;
            const distance = this.camera.position.length();
            const newDistance = Math.max(5, Math.min(20, distance + delta));
            this.camera.position.multiplyScalar(newDistance / distance);
        });
    }

    spawnItem() {
        // Create work piece (metal part to be welded)
        const itemGroup = new THREE.Group();

        // Base plate - brushed stainless steel
        const baseGeometry = new THREE.BoxGeometry(0.5, 0.15, 0.5);
        const metalMaterial = new THREE.MeshStandardMaterial({
            color: 0x8090a0,
            roughness: 0.25,
            metalness: 0.9,
            envMapIntensity: 1.2
        });
        const basePlate = new THREE.Mesh(baseGeometry, metalMaterial);
        basePlate.castShadow = true;
        itemGroup.add(basePlate);

        // Part to be welded on top
        const partGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.3);
        const part = new THREE.Mesh(partGeometry, metalMaterial.clone());
        part.position.y = 0.175;
        part.castShadow = true;
        itemGroup.add(part);

        // Weld seam indicator (initially hidden, shown after welding)
        const seamGeometry = new THREE.TorusGeometry(0.18, 0.02, 8, 16);
        // Orange weld seam glow
        const seamMaterial = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xff6600,
            emissiveIntensity: 0,
            roughness: 0.6,
            metalness: 0.4
        });
        const weldSeam = new THREE.Mesh(seamGeometry, seamMaterial);
        weldSeam.rotation.x = Math.PI / 2;
        weldSeam.position.y = 0.08;
        weldSeam.visible = false;
        itemGroup.add(weldSeam);

        itemGroup.position.set(-4, 1.38, 0);
        itemGroup.userData = { welded: false, weldSeam: weldSeam };

        this.scene.add(itemGroup);
        this.items.push(itemGroup);
    }

    updateItems(delta) {
        // Move items along conveyor - ALL items stop during welding
        // Use a fixed movement amount based on speed to keep spacing consistent
        const movement = this.isWelding ? 0 : this.conveyorSpeed;

        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];

            item.position.x += movement;

            // Remove items that have passed the end
            if (item.position.x > 4.5) {
                this.scene.remove(item);
                this.items.splice(i, 1);
            }
        }

        // Spawn new items based on POSITION, not time - this keeps spacing consistent
        // Only spawn when conveyor is moving and there's enough space
        if (!this.isWelding && this.state !== CONFIG.STATES.PAUSED && this.state !== CONFIG.STATES.CRITICAL) {
            const spawnX = -4;
            const spacing = CONFIG.CONVEYOR.ITEM_SPACING;

            // Check if we can spawn (no item too close to spawn point)
            let canSpawn = true;
            for (const item of this.items) {
                if (item.position.x < spawnX + spacing) {
                    canSpawn = false;
                    break;
                }
            }

            if (canSpawn) {
                this.spawnItem();
            }
        }
    }

    findItemToWeld() {
        // Find an unwelded item in the welding zone
        for (const item of this.items) {
            if (!item.userData.welded &&
                Math.abs(item.position.x - this.weldZone) < 0.3) {
                return item;
            }
        }
        return null;
    }

    emitSparks() {
        // Get welding tip world position
        const tipPos = new THREE.Vector3();
        this.weldingTip.getWorldPosition(tipPos);

        // Emit some sparks
        for (let i = 0; i < 3; i++) {
            const spark = this.sparks.find(s => !s.visible);
            if (spark) {
                spark.visible = true;
                spark.position.copy(tipPos);
                spark.userData.velocity.set(
                    (Math.random() - 0.5) * 0.15,
                    Math.random() * 0.2 + 0.05,
                    (Math.random() - 0.5) * 0.15
                );
                spark.userData.life = 0.5 + Math.random() * 0.3;
                spark.scale.setScalar(0.5 + Math.random() * 0.5);
            }
        }
    }

    updateSparks(delta) {
        for (const spark of this.sparks) {
            if (spark.visible) {
                spark.userData.life -= delta;
                if (spark.userData.life <= 0) {
                    spark.visible = false;
                } else {
                    spark.position.add(spark.userData.velocity);
                    spark.userData.velocity.y -= 0.01; // gravity
                    spark.scale.multiplyScalar(0.96);
                }
            }
        }
    }

    updateRobotAnimation(delta) {
        // Update sparks
        this.updateSparks(delta);

        if (this.state === CONFIG.STATES.PAUSED || this.state === CONFIG.STATES.CRITICAL) {
            // Safe pose: arm straight up
            this.upperArmPivot.rotation.x = THREE.MathUtils.lerp(this.upperArmPivot.rotation.x, 0, 0.05);
            this.forearmPivot.rotation.x = THREE.MathUtils.lerp(this.forearmPivot.rotation.x, 0, 0.05);
            this.weldingTipMaterial.emissiveIntensity = 0;
            this.weldingLight.intensity = 0;
            this.isWelding = false;
            return;
        }

        // Check if we should start welding
        if (!this.isWelding) {
            const target = this.findItemToWeld();
            if (target) {
                this.isWelding = true;
                this.weldingTarget = target;
                this.weldingProgress = 0;
            }
        }

        if (this.isWelding && this.weldingTarget) {
            this.weldingProgress += delta * this.animationSpeed;

            // Welding animation phases
            const moveDownDuration = 0.5;
            const weldDuration = this.weldingDuration;
            const moveUpDuration = 0.5;
            const totalDuration = moveDownDuration + weldDuration + moveUpDuration;

            let t = this.weldingProgress / totalDuration;

            if (t < moveDownDuration / totalDuration) {
                // Moving down to weld - use easing for smooth motion
                const phase = this.easeInOutQuad(t / (moveDownDuration / totalDuration));
                this.upperArmPivot.rotation.x = THREE.MathUtils.lerp(this.homeUpperArmAngle, this.weldUpperArmAngle, phase);
                this.forearmPivot.rotation.x = THREE.MathUtils.lerp(this.homeForearmAngle, this.weldForearmAngle, phase);
                this.weldingTipMaterial.emissiveIntensity = 0;
                this.weldingLight.intensity = 0;
            } else if (t < (moveDownDuration + weldDuration) / totalDuration) {
                // Welding!
                this.upperArmPivot.rotation.x = this.weldUpperArmAngle;
                this.forearmPivot.rotation.x = this.weldForearmAngle;

                // Flickering welding effect
                const flicker = Math.sin(this.weldingProgress * 30) > 0 ? 1 : 0.3;
                this.weldingTipMaterial.emissiveIntensity = 2.5 * flicker;
                this.weldingLight.intensity = 5.0 * flicker;
                this.weldingLight.color.setHex(flicker > 0.5 ? 0xff6600 : 0xffffaa);

                // Position welding light at tip
                const tipPos = new THREE.Vector3();
                this.weldingTip.getWorldPosition(tipPos);
                this.weldingLight.position.copy(tipPos);

                // Emit sparks
                if (Math.random() > 0.4) {
                    this.emitSparks();
                }

                // Show weld seam gradually
                if (this.weldingTarget.userData.weldSeam) {
                    this.weldingTarget.userData.weldSeam.visible = true;
                    this.weldingTarget.userData.weldSeam.material.emissiveIntensity = 1.5 * flicker;
                }
            } else if (t < 1) {
                // Moving back up
                const phase = this.easeInOutQuad((t - (moveDownDuration + weldDuration) / totalDuration) / (moveUpDuration / totalDuration));
                this.upperArmPivot.rotation.x = THREE.MathUtils.lerp(this.weldUpperArmAngle, this.homeUpperArmAngle, phase);
                this.forearmPivot.rotation.x = THREE.MathUtils.lerp(this.weldForearmAngle, this.homeForearmAngle, phase);
                this.weldingTipMaterial.emissiveIntensity = 0;
                this.weldingLight.intensity = 0;

                // Cool down weld seam
                if (this.weldingTarget.userData.weldSeam) {
                    this.weldingTarget.userData.weldSeam.material.emissiveIntensity = 0.5 * (1 - phase);
                }
            } else {
                // Welding complete
                this.weldingTarget.userData.welded = true;
                if (this.weldingTarget.userData.weldSeam) {
                    this.weldingTarget.userData.weldSeam.material.emissiveIntensity = 0;
                }
                this.isWelding = false;
                this.weldingTarget = null;
            }
        } else {
            // Idle: gentle breathing motion
            this.animationTime += delta * this.animationSpeed * 0.5;
            const idleMove = Math.sin(this.animationTime * 2) * 0.03;
            this.upperArmPivot.rotation.x = this.homeUpperArmAngle + idleMove;
            this.forearmPivot.rotation.x = this.homeForearmAngle - idleMove * 0.5;
            this.weldingTipMaterial.emissiveIntensity = 0;
            this.weldingLight.intensity = 0;
        }
    }

    // Easing function for smooth motion
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    updateState(newState) {
        this.state = newState;

        // Update animation speed based on state
        switch (newState) {
            case CONFIG.STATES.NORMAL:
                this.animationSpeed = CONFIG.ROBOT.SPEED_NORMAL;
                this.conveyorSpeed = CONFIG.CONVEYOR.SPEED_NORMAL;
                break;
            case CONFIG.STATES.DEGRADED:
                this.animationSpeed = CONFIG.ROBOT.SPEED_DEGRADED;
                this.conveyorSpeed = CONFIG.CONVEYOR.SPEED_DEGRADED;
                break;
            case CONFIG.STATES.CRITICAL:
                this.animationSpeed = CONFIG.ROBOT.SPEED_CRITICAL;
                this.conveyorSpeed = 0;
                break;
            case CONFIG.STATES.PAUSED:
                this.animationSpeed = CONFIG.ROBOT.SPEED_PAUSED;
                this.conveyorSpeed = 0;
                break;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = 0.016; // Approximate 60fps

        this.updateRobotAnimation(delta);
        this.updateItems(delta);
        this.updateStatusLightBlink();

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
}

// Make scene manager globally available
window.SceneManager = SceneManager;

