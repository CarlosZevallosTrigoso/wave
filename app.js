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
            case 'circular':
                this.currentWaveform = new CircularWaveform(this.scene, this.analyser);
                break;
            case 'horizontal':
                this.currentWaveform = new HorizontalWaveform(this.scene, this.analyser);
                break;
            case 'psychedelic':
                this.currentWaveform = new PsychedelicWaveform(this.scene, this.analyser);
                break;
            case 'gradient':
                this.currentWaveform = new GradientWaveform(this.scene, this.analyser);
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

// Circular Multicolor Waveform
class CircularWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.mesh = null;
        
        this.config = {
            radius: 0.8,
            segments: 64,
            thickness: 0.05,
            intensity: 1.5
        };
        
        this.create();
    }
    
    create() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.segments * 3);
        const colors = new Float32Array(this.config.segments * 3);
        
        // Initialize positions in a circle
        for (let i = 0; i < this.config.segments; i++) {
            const angle = (i / this.config.segments) * Math.PI * 2;
            positions[i * 3] = Math.cos(angle) * this.config.radius;
            positions[i * 3 + 1] = Math.sin(angle) * this.config.radius;
            positions[i * 3 + 2] = 0;
            
            // Rainbow colors
            const hue = i / this.config.segments;
            const color = new THREE.Color().setHSL(hue, 1, 0.5);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            linewidth: 3
        });
        
        this.mesh = new THREE.LineLoop(geometry, material);
        this.scene.add(this.mesh);
    }
    
    update(dataArray) {
        const positions = this.mesh.geometry.attributes.position.array;
        const segmentSize = Math.floor(dataArray.length / this.config.segments);
        
        for (let i = 0; i < this.config.segments; i++) {
            const angle = (i / this.config.segments) * Math.PI * 2;
            const dataIndex = i * segmentSize;
            const amplitude = (dataArray[dataIndex] / 255) * this.config.intensity;
            const radius = this.config.radius + amplitude * 0.5;
            
            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = Math.sin(angle) * radius;
        }
        
        this.mesh.geometry.attributes.position.needsUpdate = true;
    }
    
    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.scene.remove(this.mesh);
        }
    }
}

// Horizontal Bar Waveform
class HorizontalWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.bars = [];
        
        this.config = {
            barCount: 64,
            barWidth: 0.025,
            maxHeight: 1.5,
            spacing: 0.03,
            color: '#00ffff'
        };
        
        this.create();
    }
    
    create() {
        const totalWidth = this.config.barCount * (this.config.barWidth + this.config.spacing);
        const startX = -totalWidth / 2;
        
        for (let i = 0; i < this.config.barCount; i++) {
            const geometry = new THREE.BoxGeometry(
                this.config.barWidth,
                0.1,
                0.1
            );
            
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(this.config.color)
            });
            
            const bar = new THREE.Mesh(geometry, material);
            bar.position.x = startX + i * (this.config.barWidth + this.config.spacing);
            bar.position.y = 0;
            
            this.bars.push(bar);
            this.scene.add(bar);
        }
    }
    
    update(dataArray) {
        const segmentSize = Math.floor(dataArray.length / this.config.barCount);
        
        this.bars.forEach((bar, i) => {
            const dataIndex = i * segmentSize;
            const amplitude = (dataArray[dataIndex] / 255) * this.config.maxHeight;
            
            bar.scale.y = Math.max(0.1, amplitude);
            
            // Update color based on amplitude
            const color = new THREE.Color(this.config.color);
            const brightness = 0.5 + (amplitude / this.config.maxHeight) * 0.5;
            bar.material.color.setRGB(
                color.r * brightness,
                color.g * brightness,
                color.b * brightness
            );
        });
    }
    
    dispose() {
        this.bars.forEach(bar => {
            bar.geometry.dispose();
            bar.material.dispose();
            this.scene.remove(bar);
        });
        this.bars = [];
    }
}

// Psychedelic Waveform
class PsychedelicWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.particles = null;
        this.time = 0;
        
        this.config = {
            particleCount: 1000,
            size: 0.03,
            speed: 1.0,
            spread: 2.0
        };
        
        this.create();
    }
    
    create() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.particleCount * 3);
        const colors = new Float32Array(this.config.particleCount * 3);
        const sizes = new Float32Array(this.config.particleCount);
        
        for (let i = 0; i < this.config.particleCount; i++) {
            // Spiral pattern
            const t = i / this.config.particleCount;
            const angle = t * Math.PI * 4;
            const radius = t * this.config.spread;
            
            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = Math.sin(angle) * radius;
            positions[i * 3 + 2] = 0;
            
            const color = new THREE.Color().setHSL(t, 1, 0.5);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            
            sizes[i] = this.config.size;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
            size: this.config.size,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }
    
    update(dataArray) {
        this.time += 0.01 * this.config.speed;
        
        const positions = this.particles.geometry.attributes.position.array;
        const sizes = this.particles.geometry.attributes.size.array;
        
        const avgAmplitude = dataArray.reduce((a, b) => a + b) / dataArray.length / 255;
        
        for (let i = 0; i < this.config.particleCount; i++) {
            const t = i / this.config.particleCount;
            const angle = t * Math.PI * 4 + this.time;
            const radius = t * this.config.spread;
            
            const dataIndex = Math.floor(t * dataArray.length);
            const amplitude = (dataArray[dataIndex] / 255) * 0.5;
            
            positions[i * 3] = Math.cos(angle) * (radius + amplitude);
            positions[i * 3 + 1] = Math.sin(angle) * (radius + amplitude);
            
            sizes[i] = this.config.size * (1 + avgAmplitude * 2);
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.size.needsUpdate = true;
        this.particles.rotation.z += 0.002 * this.config.speed;
    }
    
    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.scene.remove(this.particles);
        }
    }
}

// Gradient Bright Waveform
class GradientWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.mesh = null;
        
        this.config = {
            segments: 128,
            amplitude: 1.2,
            smoothness: 0.8,
            brightness: 2.0
        };
        
        this.create();
    }
    
    create() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.segments * 3);
        const colors = new Float32Array(this.config.segments * 3);
        
        const width = 3;
        const step = width / this.config.segments;
        
        for (let i = 0; i < this.config.segments; i++) {
            positions[i * 3] = -width / 2 + i * step;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            
            // Gradient from cyan to magenta
            const t = i / this.config.segments;
            const color = new THREE.Color();
            color.setHSL(0.5 + t * 0.3, 1, 0.5);
            
            colors[i * 3] = color.r * this.config.brightness;
            colors[i * 3 + 1] = color.g * this.config.brightness;
            colors[i * 3 + 2] = color.b * this.config.brightness;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            linewidth: 2
        });
        
        this.mesh = new THREE.Line(geometry, material);
        this.scene.add(this.mesh);
    }
    
    update(dataArray) {
        const positions = this.mesh.geometry.attributes.position.array;
        const colors = this.mesh.geometry.attributes.color.array;
        const segmentSize = Math.floor(dataArray.length / this.config.segments);
        
        for (let i = 0; i < this.config.segments; i++) {
            const dataIndex = i * segmentSize;
            const amplitude = (dataArray[dataIndex] / 255) * this.config.amplitude;
            
            positions[i * 3 + 1] = amplitude;
            
            // Update brightness based on amplitude
            const t = i / this.config.segments;
            const color = new THREE.Color();
            color.setHSL(0.5 + t * 0.3, 1, 0.5);
            
            const brightness = this.config.brightness * (0.5 + amplitude * 0.5);
            colors[i * 3] = color.r * brightness;
            colors[i * 3 + 1] = color.g * brightness;
            colors[i * 3 + 2] = color.b * brightness;
        }
        
        this.mesh.geometry.attributes.position.needsUpdate = true;
        this.mesh.geometry.attributes.color.needsUpdate = true;
    }
    
    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.scene.remove(this.mesh);
        }
    }
}

// Initialize app
const app = new AudioVisualizer();
