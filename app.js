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
        this.canvasStream = null;
        this.chunkCount = 0;
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.currentWaveform = null;
        
        this.composer = null;
        this.bloomPass = null;
        this.bloomEnabled = false;
        
        this.currentFormat = '1080x1080';
        this.exportWidth = 1080;
        this.exportHeight = 1080;
        
        this.init();
        this.setupEventListeners();
    }
    
    init() {
        this.setupThreeJS();
        this.setupPostProcessing();
        this.updateCanvasSize();
    }
    
    updateCanvasSize() {
        const [width, height] = this.currentFormat.split('x').map(Number);
        this.exportWidth = width;
        this.exportHeight = height;
        
        const wrapper = this.canvas.parentElement;
        const bgLayer = document.getElementById('bg-layer');
        const containerWidth = wrapper.clientWidth;
        const containerHeight = wrapper.clientHeight;
        
        const aspectRatio = width / height;
        const containerRatio = containerWidth / containerHeight;
        
        let displayWidth, displayHeight;
        
        const maxWidth = containerWidth * 0.85;
        const maxHeight = containerHeight * 0.85;
        
        if (containerRatio > aspectRatio) {
            displayHeight = maxHeight;
            displayWidth = displayHeight * aspectRatio;
        } else {
            displayWidth = maxWidth;
            displayHeight = displayWidth / aspectRatio;
        }
        
        // Actualizar tamaño del canvas
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
        // Actualizar tamaño del fondo para que coincida exactamente con el canvas
        bgLayer.style.width = displayWidth + 'px';
        bgLayer.style.height = displayHeight + 'px';
        
        if (this.renderer) {
            this.renderer.setSize(displayWidth, displayHeight);
        }
        if (this.composer) {
            this.composer.setSize(displayWidth, displayHeight);
        }
    }
    
    setupThreeJS() {
        this.scene = new THREE.Scene();
        // Eliminamos el fondo negro fijo para permitir transparencia CSS
        // this.scene.background = new THREE.Color(0x000000); 
        
        const aspect = this.exportWidth / this.exportHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.z = 5;
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            preserveDrawingBuffer: true,
            alpha: true // IMPORTANTE: Permite fondo transparente
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        // Render transparente por defecto
        this.renderer.setClearColor(0x000000, 0); 
    }
    
    setupPostProcessing() {
        this.composer = new THREE.EffectComposer(this.renderer);
        
        const renderPass = new THREE.RenderPass(this.scene, this.camera);
        // Asegurar que el RenderPass limpie correctamente
        renderPass.clear = true; 
        this.composer.addPass(renderPass);
        
        this.bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(this.canvas.width, this.canvas.height),
            1.5, 0.4, 0.85
        );
        this.bloomPass.enabled = false;
        this.composer.addPass(this.bloomPass);
    }
    
    setupEventListeners() {
        // Audio Upload
        document.getElementById('audioFile').addEventListener('change', (e) => this.loadAudio(e));
        
        // --- DRAG AND DROP IMPLEMENTATION ---
        const dropZone = document.querySelector('.app-container');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        dropZone.addEventListener('dragover', () => {
            dropZone.classList.add('drag-active');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-active');
        });

        dropZone.addEventListener('drop', (e) => {
            dropZone.classList.remove('drag-active');
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                // Reutilizamos la lógica de carga simulando el evento
                const mockEvent = { target: { files: files } };
                this.loadAudio(mockEvent);
            }
        });
        // ------------------------------------

        // Fondo de Imagen y Opacidad
        document.getElementById('bgFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                document.getElementById('bg-layer').style.backgroundImage = `url(${url})`;
            }
        });

        document.getElementById('bgOpacity').addEventListener('input', (e) => {
            document.getElementById('bg-layer').style.opacity = e.target.value;
        });

        // Controles existentes
        document.getElementById('formatSelect').addEventListener('change', (e) => this.changeFormat(e.target.value));
        document.getElementById('waveformType').addEventListener('change', (e) => this.changeWaveform(e.target.value));
        document.getElementById('playPauseBtn').addEventListener('click', () => this.togglePlayPause());
        document.getElementById('timeline').addEventListener('input', (e) => this.seek(e.target.value));
        document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
        document.getElementById('bloomToggle').addEventListener('change', (e) => this.toggleBloom(e.target.checked));
        
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
            const aspect = this.exportWidth / this.exportHeight;
            this.camera.aspect = aspect;
            this.camera.updateProjectionMatrix();
        });
    }
    
    toggleBloom(enabled) {
        this.bloomEnabled = enabled;
        this.bloomPass.enabled = enabled;
        this.showStatus(enabled ? 'Bloom activado' : 'Bloom desactivado', 'success');
    }
    
    async loadAudio(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.showStatus('Cargando audio...');
        
        try {
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
            
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 512;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            
            if (this.audioSource) {
                this.audioSource.disconnect();
            }
            this.audioSource = this.audioContext.createMediaElementSource(this.audioElement);
            this.audioSource.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            document.getElementById('duration').textContent = this.formatTime(this.audioElement.duration);
            document.getElementById('playPauseBtn').disabled = false;
            document.getElementById('timeline').disabled = false;
            document.getElementById('recordBtn').disabled = false;
            
            const waveformType = document.getElementById('waveformType').value;
            this.changeWaveform(waveformType);
            
            this.showStatus('Audio cargado correctamente: ' + file.name, 'success');
            
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

            // Auto-play al cargar (opcional)
            this.togglePlayPause();
            
        } catch (error) {
            console.error('Error loading audio:', error);
            this.showStatus('Error al cargar el audio', 'error');
        }
    }
    
    changeFormat(format) {
        this.currentFormat = format;
        this.updateCanvasSize();
        
        const aspect = this.exportWidth / this.exportHeight;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        
        if (this.currentWaveform) {
            const waveformType = document.getElementById('waveformType').value;
            this.changeWaveform(waveformType);
        }
    }
    
    changeWaveform(type) {
        if (this.currentWaveform) {
            this.currentWaveform.dispose();
            this.scene.clear();
        }
        
        switch(type) {
            case 'particlemorph':
                this.currentWaveform = new ParticleMorphWaveform(this.scene, this.analyser);
                break;
            case 'multiwave':
                this.currentWaveform = new MultiWaveWaveform(this.scene, this.analyser);
                break;
            case 'barsmirror':
                this.currentWaveform = new BarsMirrorWaveform(this.scene, this.analyser);
                break;
            case 'particlesphere':
                this.currentWaveform = new ParticleSphereWaveform(this.scene, this.analyser);
                break;
            case 'pulse':
                this.currentWaveform = new PulseCircleWaveform(this.scene, this.analyser);
                break;
        }
        
        this.setupConfigUI();
        this.showStatus('Waveform: ' + type, 'success');
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
            
            if (typeof value === 'boolean') {
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = value;
                input.className = 'config-checkbox';
                
                input.addEventListener('change', (e) => {
                    this.currentWaveform.config[key] = e.target.checked;
                    if (this.currentWaveform.updateColors) {
                        this.currentWaveform.updateColors();
                    }
                    this.setupConfigUI();
                });
                
                item.appendChild(input);
            }
            else if (typeof value === 'string' && value.startsWith('#')) {
                if ((key === 'color1' || key === 'color2') && 
                    this.currentWaveform.config.useCustomColors === false) {
                    return;
                }
                
                const input = document.createElement('input');
                input.type = 'color';
                input.value = value;
                input.className = 'color-input';
                
                input.addEventListener('input', (e) => {
                    this.currentWaveform.config[key] = e.target.value;
                    if (this.currentWaveform.updateColors) {
                        this.currentWaveform.updateColors();
                    }
                    // Si es backgroundColor, ya no cambiamos la escena (porque usamos transparente),
                    // sino que podríamos cambiar el fondo CSS si no hay imagen.
                    // Por simplicidad, el backgroundColor aquí solo afectará si la clase lo usa internamente.
                });
                
                item.appendChild(input);
            }
            else if (typeof value === 'number') {
                const input = document.createElement('input');
                input.type = 'range';
                input.min = key === 'particleCount' ? 1000 : 
                            key === 'waveCount' ? 3 :
                            key === 'barCount' ? 16 :
                            key === 'objectScale' ? 0.1 :
                            key === 'circleRadius' ? 0.1 :
                            key === 'positionX' || key === 'positionY' ? -3 :
                            key.includes('opacity') ? 0 : 0.1;
                input.max = key === 'particleCount' ? 20000 : 
                            key === 'waveCount' ? 20 :
                            key === 'barCount' ? 256 :
                            key === 'objectScale' ? 3 :
                            key === 'circleRadius' ? 3 :
                            key === 'positionX' || key === 'positionY' ? 3 :
                            key.includes('opacity') ? 1 : 5;
                input.step = key === 'particleCount' ? 500 : 
                             key === 'waveCount' ? 1 :
                             key === 'barCount' ? 8 :
                             key === 'objectScale' ? 0.1 :
                             key === 'circleRadius' ? 0.1 : 0.1;
                input.value = value;
                
                const valueDisplay = document.createElement('span');
                valueDisplay.textContent = (key === 'particleCount' || key === 'waveCount' || key === 'barCount') ? value : value.toFixed(1);
                
                input.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    this.currentWaveform.config[key] = val;
                    valueDisplay.textContent = (key === 'particleCount' || key === 'waveCount' || key === 'barCount') ? val : val.toFixed(1);
                    
                    if (this.currentWaveform.updateConfig) {
                        this.currentWaveform.updateConfig();
                    }
                });
                
                item.appendChild(input);
                item.appendChild(valueDisplay);
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
    
    // --- NUEVA LÓGICA DE BANDAS DE FRECUENCIA ---
    getFrequencyBands(dataArray) {
        const length = dataArray.length;
        // Analyser fftSize 512 da 256 bins. 
        // Bajos: aprox 0-10% (0-200Hz)
        const bassEnd = Math.floor(length * 0.1);
        // Agudos: aprox 70-100% (kHz altos)
        const trebleStart = Math.floor(length * 0.7);

        let bassSum = 0;
        for(let i=0; i<bassEnd; i++) bassSum += dataArray[i];
        const bass = bassSum / bassEnd / 255; // 0 a 1

        let trebleSum = 0;
        for(let i=trebleStart; i<length; i++) trebleSum += dataArray[i];
        const treble = trebleSum / (length - trebleStart) / 255; // 0 a 1
        
        // Promedio general
        const avg = dataArray.reduce((a,b) => a+b, 0) / length / 255;

        return { bass, treble, avg };
    }
    
    animate() {
        if (!this.isPlaying) return;
        
        requestAnimationFrame(() => this.animate());
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Calcular bandas
        const bands = this.getFrequencyBands(this.dataArray);
        
        if (this.currentWaveform) {
            // Pasamos las bandas calculadas al update
            this.currentWaveform.update(this.dataArray, bands);
        }
        
        if (this.bloomEnabled) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
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
        
        this.canvasStream = this.canvas.captureStream(60);
        const audioDestination = this.audioContext.createMediaStreamDestination();
        this.audioSource.connect(audioDestination);
        
        const combinedStream = new MediaStream([
            ...this.canvasStream.getVideoTracks(),
            ...audioDestination.stream.getAudioTracks()
        ]);
        
        let options;
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            options = { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 6000000 };
        } else {
            options = { videoBitsPerSecond: 6000000 };
        }
        
        this.mediaRecorder = new MediaRecorder(combinedStream, options);
        this.chunkCount = 0;
        
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.recordedChunks.push(event.data);
                this.chunkCount++;
            }
        };
        
        this.mediaRecorder.onstop = () => {
            this.saveRecording();
            if (this.canvasStream) {
                this.canvasStream.getTracks().forEach(track => track.stop());
                this.canvasStream = null;
            }
        };
        
        this.mediaRecorder.start(1000);
        this.isRecording = true;
        
        document.getElementById('recordBtn').classList.add('recording');
        document.getElementById('recordBtn').querySelector('.text').textContent = 'Grabando...';
        
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
        document.getElementById('recordBtn').querySelector('.text').textContent = 'Grabar Video';
        this.showStatus('Procesando video...', 'success');
    }
    
    saveRecording() {
        if (this.recordedChunks.length === 0) return;
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'waveform_' + Date.now() + '.webm';
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); }, 100);
        this.showStatus('Video guardado: ' + sizeMB + ' MB', 'success');
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ':' + secs.toString().padStart(2, '0');
    }
    
    showStatus(message, type = '') {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = 'status ' + type;
    }
}

// --- WAVEFORMS ACTUALIZADOS ---

// Particle Morph Waveform (ACTUALIZADO con Reactividad de Bandas)
class ParticleMorphWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.particles = null;
        this.time = 0;
        
        this.config = {
            particleCount: 8000,
            objectScale: 1.0,
            morphSpeed: 1.0,
            waveIntensity: 1.5,
            colorCycle: 0.5,
            opacity: 0.9,
            positionX: 0.0,
            positionY: 0.0,
            useCustomColors: false,
            color1: '#ff0066',
            color2: '#00ffff',
            // backgroundColor: '#000000' // Eliminado para transparencia
        };
        
        this.create();
        // Eliminamos scene.background para permitir transparencia
    }
    
    create() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.particleCount * 3);
        const colors = new Float32Array(this.config.particleCount * 3);
        
        for (let i = 0; i < this.config.particleCount; i++) {
            const phi = Math.acos(1 - 2 * (i + 0.5) / this.config.particleCount);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            
            const radius = 1.2;
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            
            const hue = (i / this.config.particleCount + 0.5) % 1;
            const color = new THREE.Color().setHSL(hue, 1, 0.5);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.userData.originalPositions = new Float32Array(positions);
        
        const material = new THREE.PointsMaterial({
            size: 0.02,
            vertexColors: true,
            transparent: true,
            opacity: this.config.opacity,
            blending: THREE.AdditiveBlending
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
        this.updateColors();
        this.updateConfig();
    }
    
    updateColors() {
        if (!this.particles) return;
        const colors = this.particles.geometry.attributes.color.array;
        
        if (this.config.useCustomColors) {
            const c1 = new THREE.Color(this.config.color1);
            const c2 = new THREE.Color(this.config.color2);
            for (let i = 0; i < this.config.particleCount; i++) {
                const t = i / this.config.particleCount;
                const color = new THREE.Color().lerpColors(c1, c2, t);
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            }
        } else {
            for (let i = 0; i < this.config.particleCount; i++) {
                const hue = (i / this.config.particleCount + 0.5) % 1;
                const color = new THREE.Color().setHSL(hue, 1, 0.5);
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            }
        }
        this.particles.geometry.attributes.color.needsUpdate = true;
    }
    
    updateConfig() {
        if (this.particles) {
            this.particles.scale.set(this.config.objectScale, this.config.objectScale, this.config.objectScale);
            this.particles.material.opacity = this.config.opacity;
            this.particles.material.size = 0.02 * this.config.objectScale;
            this.particles.position.x = this.config.positionX;
            this.particles.position.y = this.config.positionY;
        }
    }
    
    update(dataArray, bands) {
        if (!dataArray || dataArray.length === 0) return;
        
        // Usamos bandas (bands.bass, bands.treble, bands.avg)
        const { bass, treble, avg } = bands;
        
        // La velocidad del morphing aumenta ligeramente con los agudos
        this.time += 0.01 * this.config.morphSpeed * (1 + treble);
        
        const positions = this.particles.geometry.attributes.position.array;
        const originalPositions = this.particles.geometry.userData.originalPositions;
        const colors = this.particles.geometry.attributes.color.array;
        
        for (let i = 0; i < this.config.particleCount; i++) {
            const i3 = i * 3;
            const x = originalPositions[i3];
            const y = originalPositions[i3 + 1];
            const z = originalPositions[i3 + 2];
            
            // Índice para datos crudos
            const dataIdx = Math.floor((i / this.config.particleCount) * dataArray.length);
            const amplitude = dataArray[dataIdx] / 255;
            
            const angle = Math.atan2(y, x);
            
            // === REACTIVIDAD POR BANDAS ===
            // Los BAJOS (bass) afectan la intensidad del golpe/ola principal
            const bassKick = bass * 2.5; 
            
            const wave1 = Math.sin(angle * 3 + this.time * 2) * amplitude * this.config.waveIntensity * (1 + bassKick);
            const wave2 = Math.cos(angle * 5 - this.time * 1.5) * amplitude * this.config.waveIntensity;
            
            const deformation = (wave1 + wave2) * 0.3;
            const distance = Math.sqrt(x * x + y * y + z * z);
            
            // Expansión extra en golpes de bajo fuertes
            const newDistance = distance + deformation + (bass * 0.2);
            
            const scale = newDistance / distance;
            positions[i3] = x * scale;
            positions[i3 + 1] = y * scale;
            positions[i3 + 2] = z * scale;
            
            if (!this.config.useCustomColors) {
                // Los AGUDOS (treble) hacen brillar los colores
                const hue = ((i / this.config.particleCount) + 
                            this.time * this.config.colorCycle * 0.1 + 
                            amplitude * 0.2) % 1;
                
                // Aumentamos la luminosidad (L) con los agudos
                const lightness = 0.5 + (treble * 0.3);
                const color = new THREE.Color().setHSL(hue, 1.0, lightness);
                
                colors[i3] = color.r;
                colors[i3 + 1] = color.g;
                colors[i3 + 2] = color.b;
            }
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.color.needsUpdate = true;
    }
    
    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.scene.remove(this.particles);
        }
    }
}

// Multi Wave Waveform (Simplificado background)
class MultiWaveWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.waves = [];
        this.time = 0;
        this.config = {
            waveCount: 12,
            objectScale: 1.0,
            waveIntensity: 1.5,
            spacing: 0.15,
            speed: 1.0,
            opacity: 0.8,
            lineWidth: 3.0,
            positionX: 0.0,
            positionY: 0.0,
            lineColor: '#ffffff',
        };
        this.create();
    }
    
    create() {
        this.waves.forEach(wave => {
            wave.geometry.dispose();
            wave.material.dispose();
            this.scene.remove(wave);
        });
        this.waves = [];
        const segments = 128;
        for (let i = 0; i < this.config.waveCount; i++) {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(segments * 3);
            const yPos = (i - this.config.waveCount / 2) * this.config.spacing;
            for (let j = 0; j < segments; j++) {
                positions[j * 3] = (j / (segments - 1)) * 4 - 2;
                positions[j * 3 + 1] = yPos;
                positions[j * 3 + 2] = 0;
            }
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const color = new THREE.Color(this.config.lineColor);
            const material = new THREE.LineBasicMaterial({
                color: color,
                transparent: true,
                opacity: this.config.opacity,
                linewidth: this.config.lineWidth
            });
            const wave = new THREE.Line(geometry, material);
            wave.userData = { index: i, baseY: yPos, segments: segments };
            this.waves.push(wave);
            this.scene.add(wave);
        }
        this.updateConfig();
    }
    
    updateColors() {
        const color = new THREE.Color(this.config.lineColor);
        this.waves.forEach(wave => wave.material.color = color);
    }
    
    updateConfig() {
        if (this.waves.length !== this.config.waveCount) {
            this.create();
            return;
        }
        this.waves.forEach((wave, i) => {
            const newYPos = (i - this.config.waveCount / 2) * this.config.spacing;
            wave.userData.baseY = newYPos;
            wave.material.opacity = this.config.opacity;
            wave.material.linewidth = this.config.lineWidth;
            wave.scale.set(this.config.objectScale, this.config.objectScale, this.config.objectScale);
            wave.position.x = this.config.positionX;
            wave.position.y = newYPos + this.config.positionY;
        });
    }
    
    update(dataArray, bands) {
        if (!dataArray) return;
        this.time += 0.02 * this.config.speed;
        const { bass } = bands; // Usamos el bajo para amplificar
        
        this.waves.forEach((wave, waveIdx) => {
            const positions = wave.geometry.attributes.position.array;
            const segments = wave.userData.segments;
            const baseY = wave.userData.baseY;
            
            for (let i = 0; i < segments; i++) {
                const x = (i / (segments - 1)) * 4 - 2;
                const dataIdx = Math.floor((i / segments) * dataArray.length);
                const amplitude = dataArray[dataIdx] / 255;
                
                const wave1 = Math.sin(x * 2 + this.time + waveIdx * 0.5) * amplitude;
                const wave2 = Math.sin(x * 3 - this.time * 0.7 + waveIdx * 0.3) * amplitude * 0.5;
                
                // Bass boost
                const displacement = (wave1 + wave2) * this.config.waveIntensity * 0.3 * (1 + bass);
                
                positions[i * 3] = x;
                positions[i * 3 + 1] = baseY + displacement;
            }
            wave.geometry.attributes.position.needsUpdate = true;
            wave.position.x = this.config.positionX;
            wave.position.y = wave.userData.baseY + this.config.positionY;
        });
    }
    
    dispose() {
        this.waves.forEach(wave => {
            wave.geometry.dispose();
            wave.material.dispose();
            this.scene.remove(wave);
        });
        this.waves = [];
    }
}

// Bars Mirror Waveform
class BarsMirrorWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.bars = [];
        this.config = {
            barCount: 64,
            objectScale: 1.0,
            barIntensity: 2.5,
            barSpacing: 0.01,
            positionX: 0.0,
            positionY: 0.0,
            barColor: '#ffffff',
        };
        this.create();
    }
    create() {
        this.bars.forEach(bar => { bar.geometry.dispose(); bar.material.dispose(); this.scene.remove(bar); });
        this.bars = [];
        const barWidth = 0.06;
        const totalWidth = this.config.barCount * (barWidth + this.config.barSpacing);
        const startX = -totalWidth / 2;
        const color = new THREE.Color(this.config.barColor);
        for (let i = 0; i < this.config.barCount; i++) {
            const geometry = new THREE.BoxGeometry(barWidth, 0.1, barWidth);
            const material = new THREE.MeshBasicMaterial({ color: color });
            const bar = new THREE.Mesh(geometry, material);
            bar.position.x = startX + i * (barWidth + this.config.barSpacing);
            bar.userData = { index: i, baseX: bar.position.x };
            this.bars.push(bar);
            this.scene.add(bar);
        }
        this.updateConfig();
    }
    updateColors() { const color = new THREE.Color(this.config.barColor); this.bars.forEach(bar => bar.material.color = color); }
    updateConfig() {
        if (this.bars.length !== this.config.barCount) { this.create(); return; }
        this.bars.forEach(bar => bar.scale.set(this.config.objectScale, this.config.objectScale, this.config.objectScale));
    }
    update(dataArray) {
        if (!dataArray) return;
        this.bars.forEach((bar, i) => {
            const dataIdx = Math.floor((i / this.config.barCount) * dataArray.length);
            const amplitude = dataArray[dataIdx] / 255;
            const height = 0.2 + amplitude * this.config.barIntensity * 3;
            bar.scale.y = height * this.config.objectScale;
            bar.position.x = bar.userData.baseX + this.config.positionX;
            bar.position.y = this.config.positionY;
        });
    }
    dispose() { this.bars.forEach(bar => { bar.geometry.dispose(); bar.material.dispose(); this.scene.remove(bar); }); this.bars = []; }
}

// Particle Sphere Waveform
class ParticleSphereWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.particles = null;
        this.time = 0;
        this.config = {
            particleCount: 5000,
            objectScale: 1.0,
            expansionIntensity: 1.5,
            opacity: 0.9,
            positionX: 0.0,
            positionY: 0.0,
            particleColor: '#ffffff',
        };
        this.create();
    }
    create() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.particleCount * 3);
        for (let i = 0; i < this.config.particleCount; i++) {
            const phi = Math.acos(1 - 2 * (i + 0.5) / this.config.particleCount);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            const radius = 1.2;
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.userData.originalPositions = new Float32Array(positions);
        const color = new THREE.Color(this.config.particleColor);
        const material = new THREE.PointsMaterial({
            size: 0.03,
            color: color,
            transparent: true,
            opacity: this.config.opacity,
            blending: THREE.AdditiveBlending
        });
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
        this.updateConfig();
    }
    updateColors() { if (this.particles) this.particles.material.color = new THREE.Color(this.config.particleColor); }
    updateConfig() {
        if (this.particles) {
            this.particles.scale.set(this.config.objectScale, this.config.objectScale, this.config.objectScale);
            this.particles.material.opacity = this.config.opacity;
            this.particles.material.size = 0.03 * this.config.objectScale;
            this.particles.position.x = this.config.positionX;
            this.particles.position.y = this.config.positionY;
        }
    }
    update(dataArray, bands) {
        if (!dataArray) return;
        this.time += 0.01;
        const { bass } = bands;
        
        const positions = this.particles.geometry.attributes.position.array;
        const originalPositions = this.particles.geometry.userData.originalPositions;
        
        for (let i = 0; i < this.config.particleCount; i++) {
            const i3 = i * 3;
            const x = originalPositions[i3];
            const y = originalPositions[i3 + 1];
            const z = originalPositions[i3 + 2];
            
            const dataIdx = Math.floor((i / this.config.particleCount) * dataArray.length);
            const amplitude = dataArray[dataIdx] / 255;
            
            const distance = Math.sqrt(x * x + y * y + z * z);
            // Expansion fuerte con Bass
            const expansion = amplitude * this.config.expansionIntensity * 0.3 + bass * 0.4;
            const newDistance = distance + expansion;
            
            const scale = newDistance / distance;
            positions[i3] = x * scale;
            positions[i3 + 1] = y * scale;
            positions[i3 + 2] = z * scale;
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
    }
    dispose() { if (this.particles) { this.particles.geometry.dispose(); this.particles.material.dispose(); this.scene.remove(this.particles); } }
}

// Pulse Circle Waveform
class PulseCircleWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.circle = null;
        this.time = 0;
        this.config = {
            circleRadius: 1.0,
            objectScale: 1.0,
            pulseIntensity: 1.5,
            positionX: 0.0,
            positionY: 0.0,
            circleColor: '#ffffff',
        };
        this.create();
    }
    create() {
        const geometry = new THREE.CircleGeometry(this.config.circleRadius, 64);
        const color = new THREE.Color(this.config.circleColor);
        const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1.0 });
        this.circle = new THREE.Mesh(geometry, material);
        this.scene.add(this.circle);
        this.updateConfig();
    }
    updateColors() { if (this.circle) this.circle.material.color = new THREE.Color(this.config.circleColor); }
    updateConfig() {
        if (this.circle) {
            this.circle.scale.set(this.config.objectScale, this.config.objectScale, this.config.objectScale);
            this.circle.position.x = this.config.positionX;
            this.circle.position.y = this.config.positionY;
        }
    }
    update(dataArray, bands) {
        if (!dataArray) return;
        this.time += 0.01;
        const { bass } = bands;
        // Pulse reacciona puramente a los bajos
        const pulse = 1.0 + (bass * this.config.pulseIntensity * 0.8);
        this.circle.scale.set(pulse * this.config.objectScale, pulse * this.config.objectScale, this.config.objectScale);
    }
    dispose() { if (this.circle) { this.circle.geometry.dispose(); this.circle.material.dispose(); this.scene.remove(this.circle); } }
}

const app = new AudioVisualizer();
