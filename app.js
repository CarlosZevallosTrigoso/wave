class AudioVisualizer {
    constructor() {
        this.canvas = document.getElementById('visualizer');
        this.audioFile = null;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.audioSource = null;
        this.audioElement = null;
        this.isPlaying = false;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        
        // Three.js
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.currentWaveform = null;
        
        // Format
        this.currentFormat = '1080x1080';
        
        this.init();
        this.setupEventListeners();
    }
    
    init() {
        this.updateCanvasSize();
        this.setupThreeJS();
    }
    
    updateCanvasSize() {
        const [width, height] = this.currentFormat.split('x').map(Number);
        this.canvas.width = width;
        this.canvas.height = height;
    }
    
    setupThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        
        // Camera
        const aspect = this.canvas.width / this.canvas.height;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.z = 5;
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setSize(this.canvas.width, this.canvas.height);
        this.renderer.setPixelRatio(1); // Fixed ratio for consistent output
    }
    
    setupEventListeners() {
        document.getElementById('audioFile').addEventListener('change', (e) => this.loadAudio(e));
        document.getElementById('formatSelect').addEventListener('change', (e) => this.changeFormat(e.target.value));
        document.getElementById('waveformType').addEventListener('change', (e) => this.changeWaveform(e.target.value));
        document.getElementById('playPauseBtn').addEventListener('click', () => this.togglePlayPause());
        document.getElementById('timeline').addEventListener('input', (e) => this.seek(e.target.value));
        document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
    }
    
    async loadAudio(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.showStatus('Cargando audio...');
        
        try {
            // Create audio element
            if (this.audioElement) {
                this.audioElement.pause();
                this.audioElement = null;
            }
            
            this.audioElement = new Audio();
            this.audioElement.src = URL.createObjectURL(file);
            
            await new Promise((resolve, reject) => {
                this.audioElement.addEventListener('loadedmetadata', resolve);
                this.audioElement.addEventListener('error', reject);
            });
            
            // Setup audio context
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Setup analyser
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 512;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            
            // Connect audio
            if (this.audioSource) {
                this.audioSource.disconnect();
            }
            this.audioSource = this.audioContext.createMediaElementSource(this.audioElement);
            this.audioSource.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            // Update duration
            document.getElementById('duration').textContent = this.formatTime(this.audioElement.duration);
            
            // Enable controls
            document.getElementById('playPauseBtn').disabled = false;
            document.getElementById('timeline').disabled = false;
            document.getElementById('recordBtn').disabled = false;
            
            // Load initial waveform
            const waveformType = document.getElementById('waveformType').value;
            this.changeWaveform(waveformType);
            
            this.showStatus('Audio cargado correctamente', 'success');
            
            // Update timeline while playing
            this.audioElement.addEventListener('timeupdate', () => {
                if (!this.isPlaying) return;
                const progress = (this.audioElement.currentTime / this.audioElement.duration) * 100;
                document.getElementById('timeline').value = progress;
                document.getElementById('currentTime').textContent = this.formatTime(this.audioElement.currentTime);
            });
            
            this.audioElement.addEventListener('ended', () => {
                this.isPlaying = false;
                document.getElementById('playPauseBtn').querySelector('.icon').textContent = '▶';
                if (this.isRecording) {
                    this.stopRecording();
                }
            });
            
        } catch (error) {
            console.error('Error loading audio:', error);
            this.showStatus('Error al cargar el audio', 'error');
        }
    }
    
    changeFormat(format) {
        this.currentFormat = format;
        this.updateCanvasSize();
        
        // Update camera aspect
        const aspect = this.canvas.width / this.canvas.height;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        
        // Update renderer
        this.renderer.setSize(this.canvas.width, this.canvas.height);
        
        // Reload waveform
        if (this.currentWaveform) {
            const waveformType = document.getElementById('waveformType').value;
            this.changeWaveform(waveformType);
        }
    }
    
    changeWaveform(type) {
        // Clean up previous waveform
        if (this.currentWaveform) {
            this.currentWaveform.dispose();
            this.scene.clear();
        }
        
        // Create new waveform
        switch(type) {
            case 'slitscan':
                this.currentWaveform = new SlitScanWaveform(this.scene, this.analyser);
                break;
            case 'liquidblur':
                this.currentWaveform = new LiquidBlurWaveform(this.scene, this.analyser);
                break;
            case 'particlemorph':
                this.currentWaveform = new ParticleMorphWaveform(this.scene, this.analyser);
                break;
            case 'echoripples':
                this.currentWaveform = new EchoRipplesWaveform(this.scene, this.analyser);
                break;
        }
        
        // Setup config UI
        this.setupConfigUI();
        
        this.showStatus(`Waveform cambiado a: ${type}`, 'success');
    }
    
    setupConfigUI() {
        const configControls = document.getElementById('configControls');
        configControls.innerHTML = '';
        
        if (!this.currentWaveform || !this.currentWaveform.config) return;
        
        Object.entries(this.currentWaveform.config).forEach(([key, value]) => {
            const item = document.createElement('div');
            item.className = 'config-item';
            
            const label = document.createElement('label');
            label.textContent = this.formatConfigLabel(key);
            item.appendChild(label);
            
            let input;
            if (typeof value === 'number') {
                input = document.createElement('input');
                input.type = 'range';
                input.min = value === this.currentWaveform.config.segments ? 3 : 0.1;
                input.max = value === this.currentWaveform.config.segments ? 100 : 
                            key.includes('radius') || key.includes('size') ? 2 : 10;
                input.step = value === this.currentWaveform.config.segments ? 1 : 0.1;
                input.value = value;
                
                const valueDisplay = document.createElement('span');
                valueDisplay.textContent = value.toFixed(1);
                
                input.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    this.currentWaveform.config[key] = val;
                    valueDisplay.textContent = val.toFixed(1);
                });
                
                item.appendChild(input);
                item.appendChild(valueDisplay);
            } else if (typeof value === 'string' && value.startsWith('#')) {
                input = document.createElement('input');
                input.type = 'color';
                input.value = value;
                input.addEventListener('input', (e) => {
                    this.currentWaveform.config[key] = e.target.value;
                });
                item.appendChild(input);
            }
            
            configControls.appendChild(item);
        });
    }
    
    formatConfigLabel(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }
    
    togglePlayPause() {
        if (!this.audioElement) return;
        
        if (this.isPlaying) {
            this.audioElement.pause();
            this.isPlaying = false;
            document.getElementById('playPauseBtn').querySelector('.icon').textContent = '▶';
        } else {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            this.audioElement.play();
            this.isPlaying = true;
            document.getElementById('playPauseBtn').querySelector('.icon').textContent = '⏸';
            this.animate();
        }
    }
    
    seek(value) {
        if (!this.audioElement) return;
        const time = (value / 100) * this.audioElement.duration;
        this.audioElement.currentTime = time;
        document.getElementById('currentTime').textContent = this.formatTime(time);
    }
    
    animate() {
        if (!this.isPlaying) return;
        
        requestAnimationFrame(() => this.animate());
        
        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Update waveform
        if (this.currentWaveform) {
            this.currentWaveform.update(this.dataArray);
        }
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }
    
    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }
    
    startRecording() {
        if (!this.canvas || !this.audioElement) return;
        
        this.recordedChunks = [];
        
        // Create stream from canvas
        const canvasStream = this.canvas.captureStream(30); // 30 FPS
        
        // Create stream from audio
        const audioDestination = this.audioContext.createMediaStreamDestination();
        this.audioSource.connect(audioDestination);
        
        // Combine streams
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioDestination.stream.getAudioTracks()
        ]);
        
        // Setup recorder
        this.mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm;codecs=vp9,opus',
            videoBitsPerSecond: 8000000
        });
        
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };
        
        this.mediaRecorder.onstop = () => {
            this.saveRecording();
        };
        
        // Start recording
        this.mediaRecorder.start();
        this.isRecording = true;
        
        document.getElementById('recordBtn').classList.add('recording');
        document.getElementById('recordBtn').querySelector('.text').textContent = 'Grabando...';
        
        // Auto-start playback if not playing
        if (!this.isPlaying) {
            this.togglePlayPause();
        }
        
        this.showStatus('Grabación iniciada', 'success');
    }
    
    stopRecording() {
        if (!this.mediaRecorder || !this.isRecording) return;
        
        this.mediaRecorder.stop();
        this.isRecording = false;
        
        document.getElementById('recordBtn').classList.remove('recording');
        document.getElementById('recordBtn').querySelector('.text').textContent = 'Grabar';
        
        this.showStatus('Grabación finalizada. Guardando...', 'success');
    }
    
    saveRecording() {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `waveform_${Date.now()}.webm`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.showStatus('Video guardado correctamente', 'success');
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    showStatus(message, type = '') {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = 'status ' + type;
    }
}

// Slit-Scan Sphere Waveform (Inspired by layered sphere with motion blur)
class SlitScanWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.layers = [];
        this.time = 0;
        
        this.config = {
            layerCount: 30,
            radius: 1.2,
            blur: 0.8,
            speed: 1.0,
            colorShift: 0.0
        };
        
        this.create();
    }
    
    create() {
        // Create multiple horizontal slice layers
        for (let i = 0; i < this.config.layerCount; i++) {
            const t = i / this.config.layerCount;
            const y = (t - 0.5) * 2;
            
            // Calculate radius for spherical shape
            const sphereRadius = Math.sqrt(Math.max(0, 1 - y * y)) * this.config.radius;
            
            const geometry = new THREE.RingGeometry(
                sphereRadius * 0.95,
                sphereRadius,
                64
            );
            
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.05 + this.config.colorShift, 0.8, 0.5),
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });
            
            const layer = new THREE.Mesh(geometry, material);
            layer.rotation.x = Math.PI / 2;
            layer.position.y = y * 1.5;
            layer.userData = { index: i, baseY: y * 1.5 };
            
            this.layers.push(layer);
            this.scene.add(layer);
        }
    }
    
    update(dataArray) {
        this.time += 0.01 * this.config.speed;
        
        const avgAmplitude = dataArray.reduce((a, b) => a + b) / dataArray.length / 255;
        const bassData = dataArray.slice(0, Math.floor(dataArray.length * 0.1));
        const bassAvg = bassData.reduce((a, b) => a + b) / bassData.length / 255;
        
        this.layers.forEach((layer, i) => {
            const t = i / this.layers.length;
            const dataIdx = Math.floor(t * dataArray.length);
            const amplitude = (dataArray[dataIdx] / 255);
            
            // Motion blur effect: offset Y position
            const offset = Math.sin(this.time + i * 0.2) * this.config.blur * amplitude;
            layer.position.y = layer.userData.baseY + offset;
            
            // Scale effect
            const scale = 1 + amplitude * 0.3 + bassAvg * 0.2;
            layer.scale.set(scale, scale, 1);
            
            // Color shift based on amplitude and position
            const hue = (0.05 + this.config.colorShift + t * 0.15 + amplitude * 0.1) % 1;
            const brightness = 0.4 + amplitude * 0.6;
            layer.material.color.setHSL(hue, 0.9, brightness);
            
            // Opacity pulse
            layer.material.opacity = 0.6 + amplitude * 0.4;
        });
    }
    
    dispose() {
        this.layers.forEach(layer => {
            layer.geometry.dispose();
            layer.material.dispose();
            this.scene.remove(layer);
        });
        this.layers = [];
    }
}

// Liquid Blur Waveform (Inspired by organic blurred shapes)
class LiquidBlurWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.blobs = [];
        this.time = 0;
        
        this.config = {
            blobCount: 5,
            size: 0.6,
            fluidity: 2.0,
            brightness: 2.5,
            colorRange: 0.3
        };
        
        this.create();
    }
    
    create() {
        for (let i = 0; i < this.config.blobCount; i++) {
            // Create blob with high vertex count for smooth deformation
            const geometry = new THREE.SphereGeometry(this.config.size, 32, 32);
            
            // Store original positions
            const positions = geometry.attributes.position.array;
            geometry.userData.originalPositions = new Float32Array(positions);
            
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.3 + i * 0.1, 1, 0.5),
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending
            });
            
            const blob = new THREE.Mesh(geometry, material);
            blob.userData = { 
                index: i,
                phase: i * Math.PI * 2 / this.config.blobCount
            };
            
            this.blobs.push(blob);
            this.scene.add(blob);
        }
    }
    
    update(dataArray) {
        this.time += 0.015 * this.config.fluidity;
        
        const avgAmplitude = dataArray.reduce((a, b) => a + b) / dataArray.length / 255;
        const bassAvg = dataArray.slice(0, Math.floor(dataArray.length * 0.15))
            .reduce((a, b) => a + b, 0) / (dataArray.length * 0.15) / 255;
        
        this.blobs.forEach((blob, blobIdx) => {
            const phase = blob.userData.phase;
            
            // Position blobs in organic pattern
            const angle = this.time + phase;
            const radius = 0.3 + avgAmplitude * 0.8;
            blob.position.x = Math.cos(angle) * radius;
            blob.position.y = Math.sin(angle) * radius * 0.7;
            
            // Deform geometry for liquid effect
            const positions = blob.geometry.attributes.position.array;
            const originalPositions = blob.geometry.userData.originalPositions;
            
            for (let i = 0; i < positions.length; i += 3) {
                const idx = Math.floor((i / 3) / (positions.length / 3) * dataArray.length);
                const amplitude = dataArray[idx] / 255;
                
                const x = originalPositions[i];
                const y = originalPositions[i + 1];
                const z = originalPositions[i + 2];
                
                // Create organic distortion
                const distortion = Math.sin(this.time * 2 + x * 3) * 
                                 Math.cos(this.time * 1.5 + y * 3) * 
                                 amplitude * 0.3;
                
                positions[i] = x * (1 + distortion);
                positions[i + 1] = y * (1 + distortion);
                positions[i + 2] = z * (1 + distortion);
            }
            
            blob.geometry.attributes.position.needsUpdate = true;
            
            // Scale with bass
            const scale = 0.8 + bassAvg * 1.5 + avgAmplitude * 0.5;
            blob.scale.set(scale, scale, scale);
            
            // Dynamic color
            const hue = (0.25 + blobIdx * 0.08 + avgAmplitude * this.config.colorRange) % 1;
            blob.material.color.setHSL(hue, 1, 0.5 * this.config.brightness);
            blob.material.opacity = 0.5 + amplitude * 0.4;
        });
    }
    
    dispose() {
        this.blobs.forEach(blob => {
            blob.geometry.dispose();
            blob.material.dispose();
            this.scene.remove(blob);
        });
        this.blobs = [];
    }
}

// Particle Morph Waveform (Inspired by dotted sphere with wave deformation)
class ParticleMorphWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.particles = null;
        this.time = 0;
        
        this.config = {
            particleCount: 8000,
            size: 0.02,
            morphSpeed: 1.0,
            waveIntensity: 1.5,
            colorCycle: 0.5
        };
        
        this.create();
    }
    
    create() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.particleCount * 3);
        const colors = new Float32Array(this.config.particleCount * 3);
        const sizes = new Float32Array(this.config.particleCount);
        
        // Create sphere distribution
        for (let i = 0; i < this.config.particleCount; i++) {
            // Fibonacci sphere distribution for even particle placement
            const phi = Math.acos(1 - 2 * (i + 0.5) / this.config.particleCount);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            
            const radius = 1.2;
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            
            // Color gradient
            const hue = (i / this.config.particleCount + 0.5) % 1;
            const color = new THREE.Color().setHSL(hue, 1, 0.5);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            
            sizes[i] = this.config.size;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        geometry.userData.originalPositions = new Float32Array(positions);
        
        const material = new THREE.PointsMaterial({
            size: this.config.size,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }
    
    update(dataArray) {
        this.time += 0.01 * this.config.morphSpeed;
        
        const positions = this.particles.geometry.attributes.position.array;
        const originalPositions = this.particles.geometry.userData.originalPositions;
        const colors = this.particles.geometry.attributes.color.array;
        const sizes = this.particles.geometry.attributes.size.array;
        
        const avgAmplitude = dataArray.reduce((a, b) => a + b) / dataArray.length / 255;
        
        for (let i = 0; i < this.config.particleCount; i++) {
            const i3 = i * 3;
            const x = originalPositions[i3];
            const y = originalPositions[i3 + 1];
            const z = originalPositions[i3 + 2];
            
            // Get corresponding audio data
            const dataIdx = Math.floor((i / this.config.particleCount) * dataArray.length);
            const amplitude = dataArray[dataIdx] / 255;
            
            // Create wave deformation
            const angle = Math.atan2(y, x);
            const wave1 = Math.sin(angle * 3 + this.time * 2) * amplitude * this.config.waveIntensity;
            const wave2 = Math.cos(angle * 5 - this.time * 1.5) * amplitude * this.config.waveIntensity;
            
            const deformation = (wave1 + wave2) * 0.3;
            const distance = Math.sqrt(x * x + y * y + z * z);
            const newDistance = distance + deformation;
            
            const scale = newDistance / distance;
            positions[i3] = x * scale;
            positions[i3 + 1] = y * scale;
            positions[i3 + 2] = z * scale;
            
            // Dynamic colors
            const hue = ((i / this.config.particleCount) + 
                        this.time * this.config.colorCycle * 0.1 + 
                        amplitude * 0.2) % 1;
            const color = new THREE.Color().setHSL(hue, 1, 0.5);
            colors[i3] = color.r * (1 + amplitude);
            colors[i3 + 1] = color.g * (1 + amplitude);
            colors[i3 + 2] = color.b * (1 + amplitude);
            
            // Size variation
            sizes[i] = this.config.size * (0.5 + amplitude * 2 + avgAmplitude);
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.color.needsUpdate = true;
        this.particles.geometry.attributes.size.needsUpdate = true;
        
        // Slow rotation
        this.particles.rotation.y += 0.002;
        this.particles.rotation.x = Math.sin(this.time * 0.5) * 0.2;
    }
    
    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.scene.remove(this.particles);
        }
    }
}

// Echo Ripples Waveform (Inspired by concentric circles and echo effects)
class EchoRipplesWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.ripples = [];
        this.time = 0;
        
        this.config = {
            rippleCount: 12,
            maxRadius: 2.0,
            echoIntensity: 1.5,
            speed: 1.0,
            lineWidth: 2.0
        };
        
        this.create();
    }
    
    create() {
        for (let i = 0; i < this.config.rippleCount; i++) {
            const segments = 128;
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array((segments + 1) * 3);
            const colors = new Float32Array((segments + 1) * 3);
            
            for (let j = 0; j <= segments; j++) {
                const angle = (j / segments) * Math.PI * 2;
                const radius = 0.1;
                
                positions[j * 3] = Math.cos(angle) * radius;
                positions[j * 3 + 1] = Math.sin(angle) * radius;
                positions[j * 3 + 2] = 0;
                
                const hue = i / this.config.rippleCount;
                const color = new THREE.Color().setHSL(hue, 1, 0.5);
                colors[j * 3] = color.r;
                colors[j * 3 + 1] = color.g;
                colors[j * 3 + 2] = color.b;
            }
            
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            const material = new THREE.LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.8,
                linewidth: this.config.lineWidth,
                blending: THREE.AdditiveBlending
            });
            
            const ripple = new THREE.LineLoop(geometry, material);
            ripple.userData = { 
                index: i,
                phase: (i / this.config.rippleCount) * Math.PI * 2,
                baseRadius: 0.1
            };
            
            this.ripples.push(ripple);
            this.scene.add(ripple);
        }
    }
    
    update(dataArray) {
        this.time += 0.02 * this.config.speed;
        
        const avgAmplitude = dataArray.reduce((a, b) => a + b) / dataArray.length / 255;
        const bassAvg = dataArray.slice(0, Math.floor(dataArray.length * 0.2))
            .reduce((a, b) => a + b, 0) / (dataArray.length * 0.2) / 255;
        
        this.ripples.forEach((ripple, idx) => {
            const positions = ripple.geometry.attributes.position.array;
            const colors = ripple.geometry.attributes.color.array;
            const segments = positions.length / 3 - 1;
            
            // Expand ripple outward with echo effect
            const progress = ((this.time + ripple.userData.phase) % (Math.PI * 2)) / (Math.PI * 2);
            const radius = progress * this.config.maxRadius;
            
            // Opacity fades as ripple expands
            const opacity = 1 - progress;
            ripple.material.opacity = opacity * 0.9;
            
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                
                // Get audio data for this segment
                const dataIdx = Math.floor((i / segments) * dataArray.length);
                const amplitude = (dataArray[dataIdx] / 255) * this.config.echoIntensity;
                
                // Create echo distortion (multiple overlapping waves)
                const distortion = Math.sin(angle * 3 - this.time * 3) * amplitude * 0.2 +
                                 Math.sin(angle * 5 + this.time * 2) * amplitude * 0.15 +
                                 bassAvg * 0.3;
                
                const finalRadius = radius + distortion;
                
                positions[i * 3] = Math.cos(angle) * finalRadius;
                positions[i * 3 + 1] = Math.sin(angle) * finalRadius;
                
                // Color shifts with position and audio
                const hue = (idx / this.config.rippleCount + 
                           (i / segments) * 0.3 + 
                           amplitude * 0.2 + 
                           this.time * 0.05) % 1;
                const brightness = 0.5 + amplitude * 0.5;
                const color = new THREE.Color().setHSL(hue, 1, brightness);
                
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            }
            
            ripple.geometry.attributes.position.needsUpdate = true;
            ripple.geometry.attributes.color.needsUpdate = true;
            
            // Subtle rotation for moiré effect
            ripple.rotation.z = this.time * 0.1;
        });
    }
    
    dispose() {
        this.ripples.forEach(ripple => {
            ripple.geometry.dispose();
            ripple.material.dispose();
            this.scene.remove(ripple);
        });
        this.ripples = [];
    }
}

// Initialize app
const app = new AudioVisualizer();
