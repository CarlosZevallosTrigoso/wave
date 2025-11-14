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
        
        this.fps = 30;
        this.frameInterval = 1000 / this.fps;
        this.lastFrameTime = 0;
        
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
        
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
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
        
        const aspect = this.exportWidth / this.exportHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.z = 5;
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            preserveDrawingBuffer: true,
            alpha: true
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x1a1a1a, 1);
        
        this.currentCanvasColor = 0x1a1a1a;
    }
    
    setupPostProcessing() {
        this.composer = new THREE.EffectComposer(this.renderer);
        
        const renderPass = new THREE.RenderPass(this.scene, this.camera);
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
        document.getElementById('audioFile').addEventListener('change', (e) => this.loadAudio(e));
        
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
                const mockEvent = { target: { files: files } };
                this.loadAudio(mockEvent);
            }
        });

        document.getElementById('bgFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                document.getElementById('bg-layer').style.backgroundImage = `url(${url})`;
                this.renderer.setClearColor(0x000000, 0);
            }
        });

        document.getElementById('canvasBgColor').addEventListener('input', (e) => {
            const color = new THREE.Color(e.target.value);
            this.currentCanvasColor = color.getHex();
            this.renderer.setClearColor(this.currentCanvasColor, 1);
        });

        document.getElementById('bgOpacity').addEventListener('input', (e) => {
            document.getElementById('bg-layer').style.opacity = e.target.value;
        });

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
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.75;
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
            case 'frequencyrings':
                this.currentWaveform = new FrequencyRingsWaveform(this.scene, this.analyser);
                break;
            case 'meshwave':
                this.currentWaveform = new MeshWaveWaveform(this.scene, this.analyser);
                break;
            case 'pixeldiffusion':
                this.currentWaveform = new PixelDiffusionWaveform(this.scene, this.analyser);
                break;
            case 'sprayparticles':
                this.currentWaveform = new SprayParticlesWaveform(this.scene, this.analyser);
                break;
            case 'wavegrid':
                this.currentWaveform = new WaveGridWaveform(this.scene, this.analyser);
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
            if (key === 'backgroundColor') return;
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
                    
                    if (key === 'backgroundColor') {
                        document.querySelector('.canvas-area').style.backgroundColor = e.target.value;
                    } else {
                        if (this.currentWaveform.updateColors) {
                            this.currentWaveform.updateColors();
                        }
                    }
                });
                
                item.appendChild(input);
            }
            else if (typeof value === 'number') {
                const input = document.createElement('input');
                input.type = 'range';
                input.min = key === 'particleCount' ? 1000 : 
                            key === 'waveCount' ? 1 :
                            key === 'barCount' ? 16 :
                            key === 'ringCount' ? 3 :
                            key === 'gridSize' ? 8 :
                            key === 'textureResolution' ? 64 :
                            key === 'pixelSize' ? 2 :
                            key === 'diffusionPower' ? 0.5 :
                            key === 'maxRadius' ? 1 :
                            key === 'radiusPower' ? 1 :
                            key === 'objectScale' ? 0.1 :
                            key === 'circleRadius' ? 0.1 :
                            key === 'ringThickness' ? 0.01 :
                            key === 'positionX' || key === 'positionY' ? -3 :
                            key.includes('opacity') ? 0 : 0.1;
                input.max = key === 'particleCount' ? 20000 : 
                            key === 'waveCount' ? 20 :
                            key === 'barCount' ? 256 :
                            key === 'ringCount' ? 15 :
                            key === 'gridSize' ? 64 :
                            key === 'textureResolution' ? 512 :
                            key === 'pixelSize' ? 16 :
                            key === 'diffusionPower' ? 3 :
                            key === 'maxRadius' ? 5 :
                            key === 'radiusPower' ? 5 :
                            key === 'objectScale' ? 3 :
                            key === 'circleRadius' ? 3 :
                            key === 'ringThickness' ? 0.3 :
                            key === 'positionX' || key === 'positionY' ? 3 :
                            key.includes('opacity') ? 1 : 5;
                input.step = key === 'particleCount' ? 500 : 
                             key === 'waveCount' ? 1 :
                             key === 'barCount' ? 8 :
                             key === 'ringCount' ? 1 :
                             key === 'gridSize' ? 4 :
                             key === 'textureResolution' ? 32 :
                             key === 'pixelSize' ? 1 :
                             key === 'diffusionPower' ? 0.1 :
                             key === 'maxRadius' ? 0.2 :
                             key === 'radiusPower' ? 0.2 :
                             key === 'objectScale' ? 0.1 :
                             key === 'circleRadius' ? 0.1 :
                             key === 'ringThickness' ? 0.01 : 0.1;
                input.value = value;
                
                const valueDisplay = document.createElement('span');
                valueDisplay.textContent = (key === 'particleCount' || key === 'waveCount' || key === 'barCount' || key === 'ringCount' || key === 'gridSize' || key === 'textureResolution' || key === 'pixelSize') ? value : value.toFixed(key === 'ringThickness' ? 2 : 1);
                
                input.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    this.currentWaveform.config[key] = val;
                    valueDisplay.textContent = (key === 'particleCount' || key === 'waveCount' || key === 'barCount' || key === 'ringCount' || key === 'gridSize' || key === 'textureResolution' || key === 'pixelSize') ? val : val.toFixed(key === 'ringThickness' ? 2 : 1);
                    
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
            if (this.audioContext.state === 'suspended') this.audioContext.resume();
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
    
    getFrequencyBands(dataArray) {
        const length = dataArray.length;
        
        const subBassEnd = Math.floor(length * 0.05);
        const bassEnd = Math.floor(length * 0.15);
        const lowMidEnd = Math.floor(length * 0.3);
        const midEnd = Math.floor(length * 0.5);
        const highMidEnd = Math.floor(length * 0.75);

        let subBassSum = 0;
        for(let i = 0; i < subBassEnd; i++) subBassSum += dataArray[i];
        const subBass = subBassSum / subBassEnd / 255;
        
        let bassSum = 0;
        for(let i = subBassEnd; i < bassEnd; i++) bassSum += dataArray[i];
        const bass = bassSum / (bassEnd - subBassEnd) / 255;
        
        let lowMidSum = 0;
        for(let i = bassEnd; i < lowMidEnd; i++) lowMidSum += dataArray[i];
        const lowMid = lowMidSum / (lowMidEnd - bassEnd) / 255;
        
        let midSum = 0;
        for(let i = lowMidEnd; i < midEnd; i++) midSum += dataArray[i];
        const mid = midSum / (midEnd - lowMidEnd) / 255;
        
        let highMidSum = 0;
        for(let i = midEnd; i < highMidEnd; i++) highMidSum += dataArray[i];
        const highMid = highMidSum / (highMidEnd - midEnd) / 255;
        
        let trebleSum = 0;
        for(let i = highMidEnd; i < length; i++) trebleSum += dataArray[i];
        const treble = trebleSum / (length - highMidEnd) / 255;
        
        const avg = dataArray.reduce((a, b) => a + b, 0) / length / 255;
        
        const boost = 1.5;
        
        return {
            subBass: Math.min(subBass * boost, 1),
            bass: Math.min(bass * boost, 1),
            lowMid: Math.min(lowMid * boost, 1),
            mid: Math.min(mid * boost, 1),
            highMid: Math.min(highMid * boost, 1),
            treble: Math.min(treble * boost, 1),
            avg: avg
        };
    }
    
    animate(currentTime = 0) {
        if (!this.isPlaying) return;
        requestAnimationFrame((time) => this.animate(time));
        
        const elapsed = currentTime - this.lastFrameTime;
        if (elapsed < this.frameInterval) return;
        this.lastFrameTime = currentTime - (elapsed % this.frameInterval);
        
        this.analyser.getByteFrequencyData(this.dataArray);
        const bands = this.getFrequencyBands(this.dataArray);
        if (this.currentWaveform) {
            this.currentWaveform.update(this.dataArray, bands);
        }
        if (this.bloomEnabled) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    toggleRecording() {
        if (this.isRecording) this.stopRecording();
        else this.startRecording();
    }
    
    startRecording() {
        if (!this.canvas || !this.audioElement) return;
        
        this.recordedChunks = [];
        
        this.canvasStream = this.canvas.captureStream(30);
        
        let options = { 
            videoBitsPerSecond: 5000000,
            mimeType: 'video/webm;codecs=vp8'
        };
        
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm';
        }
        
        this.mediaRecorder = new MediaRecorder(this.canvasStream, options);
        this.chunkCount = 0;
        
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.recordedChunks.push(event.data);
                this.chunkCount++;
                
                if (this.chunkCount % 20 === 0) {
                    const totalSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
                    console.log(`📹 ${this.chunkCount} chunks | ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
                }
            }
        };
        
        this.mediaRecorder.onerror = (event) => {
            console.error('❌ Error:', event.error);
            this.showStatus('Error en la grabación', 'error');
        };
        
        this.mediaRecorder.onstop = () => {
            console.log('⏹️ Total chunks:', this.chunkCount);
            
            setTimeout(() => {
                this.saveRecording();
                if (this.canvasStream) {
                    this.canvasStream.getTracks().forEach(track => track.stop());
                    this.canvasStream = null;
                }
            }, 500);
        };
        
        this.mediaRecorder.start(100);
        this.isRecording = true;
        
        document.getElementById('recordBtn').classList.add('recording');
        document.getElementById('recordBtn').querySelector('.text').textContent = 'Grabando...';
        
        if (!this.isPlaying) this.togglePlayPause();
        
        this.showStatus('🔴 Grabando video (sin audio)', 'success');
        console.log('🎬 Grabación iniciada:', options);
    }
    
    stopRecording() {
        if (!this.mediaRecorder || !this.isRecording) return;
        
        this.isRecording = false;
        document.getElementById('recordBtn').classList.remove('recording');
        document.getElementById('recordBtn').querySelector('.text').textContent = 'Grabar Video';
        
        this.showStatus('⏹️ Finalizando...', 'success');
        
        if (this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.requestData();
            setTimeout(() => {
                if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                    this.mediaRecorder.stop();
                }
            }, 200);
        }
    }
    
    saveRecording() {
        if (this.recordedChunks.length === 0) {
            this.showStatus('Error: Sin datos de video', 'error');
            return;
        }
        
        console.log('💾 Guardando', this.recordedChunks.length, 'chunks');
        
        try {
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
            
            if (blob.size === 0) {
                this.showStatus('Error: Video vacío', 'error');
                return;
            }
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'waveform_' + Date.now() + '.webm';
            a.click();
            
            setTimeout(() => { 
                URL.revokeObjectURL(url); 
                this.recordedChunks = [];
            }, 1000);
            
            this.showStatus(`Video guardado: ${sizeMB} MB (solo visual)`, 'success');
            console.log('✅ Video guardado');
            
        } catch (error) {
            console.error('Error guardando:', error);
            this.showStatus('Error al guardar', 'error');
        }
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

// ================= WAVEFORMS =================

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
            color2: '#00ffff'
        };
        this.create();
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
            colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
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
                colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
            }
        } else {
            for (let i = 0; i < this.config.particleCount; i++) {
                const hue = (i / this.config.particleCount + 0.5) % 1;
                const color = new THREE.Color().setHSL(hue, 1, 0.5);
                colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
            }
        }
        this.particles.geometry.attributes.color.needsUpdate = true;
    }
    updateConfig() {
        if (this.particles) {
            const currentCount = this.particles.geometry.attributes.position.count;
            if (Math.abs(currentCount - this.config.particleCount) > 1000) {
                console.log(`🔄 Recreando geometría: ${currentCount} → ${this.config.particleCount}`);
                this.particles.geometry.dispose();
                this.particles.material.dispose();
                this.scene.remove(this.particles);
                this.create();
                return;
            }
            
            this.particles.scale.set(this.config.objectScale, this.config.objectScale, this.config.objectScale);
            this.particles.material.opacity = this.config.opacity;
            this.particles.material.size = 0.02 * this.config.objectScale;
            this.particles.position.x = this.config.positionX;
            this.particles.position.y = this.config.positionY;
        }
    }
    update(dataArray, bands) {
        if (!dataArray) return;
        const { subBass, bass, mid, treble } = bands;
        this.time += 0.01 * this.config.morphSpeed * (1 + treble * 0.5);
        const positions = this.particles.geometry.attributes.position.array;
        const originalPositions = this.particles.geometry.userData.originalPositions;
        const colors = this.particles.geometry.attributes.color.array;
        
        for (let i = 0; i < this.config.particleCount; i++) {
            const i3 = i * 3;
            const x = originalPositions[i3]; const y = originalPositions[i3 + 1]; const z = originalPositions[i3 + 2];
            const dataIdx = Math.floor((i / this.config.particleCount) * dataArray.length);
            const amplitude = dataArray[dataIdx] / 255;
            
            const angle = Math.atan2(y, x);
            const lowFreqKick = (subBass + bass) * 1.5; 
            const wave1 = Math.sin(angle * 3 + this.time * 2) * amplitude * this.config.waveIntensity * (1 + lowFreqKick);
            const wave2 = Math.cos(angle * 5 - this.time * 1.5) * amplitude * this.config.waveIntensity * (1 + mid * 0.5);
            
            const deformation = (wave1 + wave2) * 0.3;
            const distance = Math.sqrt(x * x + y * y + z * z);
            const newDistance = distance + deformation + (bass * 0.3);
            const scale = newDistance / distance;
            
            positions[i3] = x * scale; positions[i3 + 1] = y * scale; positions[i3 + 2] = z * scale;
            
            if (!this.config.useCustomColors) {
                const hue = ((i / this.config.particleCount) + this.time * this.config.colorCycle * 0.1 + amplitude * 0.2) % 1;
                const lightness = 0.5 + (treble * 0.4);
                const color = new THREE.Color().setHSL(hue, 1.0, lightness);
                colors[i3] = color.r; colors[i3 + 1] = color.g; colors[i3 + 2] = color.b;
            }
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.color.needsUpdate = true;
    }
    dispose() { if (this.particles) { this.particles.geometry.dispose(); this.particles.material.dispose(); this.scene.remove(this.particles); } }
}

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
            lineWidth: 2.0,
            positionX: 0.0,
            positionY: 0.0,
            lineColor: '#ffffff'
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
                opacity: this.config.opacity
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
            
            const lineThickness = this.config.lineWidth * 0.5;
            wave.scale.set(this.config.objectScale, this.config.objectScale, lineThickness);
            
            wave.position.x = this.config.positionX;
            wave.position.y = newYPos + this.config.positionY;
        });
    }
    
    update(dataArray, bands) {
        if (!dataArray) return;
        this.time += 0.02 * this.config.speed;
        const { subBass, bass, mid, treble } = bands;
        const lowFreq = subBass + bass;
        
        this.waves.forEach((wave, waveIdx) => {
            const positions = wave.geometry.attributes.position.array;
            const segments = wave.userData.segments;
            const baseY = wave.userData.baseY;
            
            for (let i = 0; i < segments; i++) {
                const x = (i / (segments - 1)) * 4 - 2;
                const dataIdx = Math.floor((i / segments) * dataArray.length);
                const amplitude = dataArray[dataIdx] / 255;
                const wave1 = Math.sin(x * 2 + this.time + waveIdx * 0.5) * amplitude * (1 + mid * 0.3);
                const wave2 = Math.sin(x * 3 - this.time * 0.7 + waveIdx * 0.3) * amplitude * 0.5 * (1 + treble * 0.2);
                const displacement = (wave1 + wave2) * this.config.waveIntensity * 0.3 * (1 + lowFreq);
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
            barColor: '#ffffff'
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
            particleColor: '#ffffff'
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
            const currentCount = this.particles.geometry.attributes.position.count;
            if (Math.abs(currentCount - this.config.particleCount) > 1000) {
                console.log(`🔄 Recreando geometría: ${currentCount} → ${this.config.particleCount}`);
                this.particles.geometry.dispose();
                this.particles.material.dispose();
                this.scene.remove(this.particles);
                this.create();
                return;
            }
            
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
        const { subBass, bass, mid } = bands;
        const lowFreq = (subBass + bass) * 0.8;
        const positions = this.particles.geometry.attributes.position.array;
        const originalPositions = this.particles.geometry.userData.originalPositions;
        for (let i = 0; i < this.config.particleCount; i++) {
            const i3 = i * 3;
            const x = originalPositions[i3]; const y = originalPositions[i3 + 1]; const z = originalPositions[i3 + 2];
            const dataIdx = Math.floor((i / this.config.particleCount) * dataArray.length);
            const amplitude = dataArray[dataIdx] / 255;
            const distance = Math.sqrt(x * x + y * y + z * z);
            const expansion = amplitude * this.config.expansionIntensity * 0.3 * (1 + mid * 0.2) + lowFreq * 0.5;
            const newDistance = distance + expansion;
            const scale = newDistance / distance;
            positions[i3] = x * scale; positions[i3 + 1] = y * scale; positions[i3 + 2] = z * scale;
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
    }
    dispose() { if (this.particles) { this.particles.geometry.dispose(); this.particles.material.dispose(); this.scene.remove(this.particles); } }
}

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
            circleColor: '#ffffff'
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
        const { subBass, bass, mid } = bands;
        const lowFreq = (subBass * 1.2 + bass) * 0.5;
        const pulse = 1.0 + (lowFreq * this.config.pulseIntensity * 0.9) + (mid * 0.1);
        this.circle.scale.set(pulse * this.config.objectScale, pulse * this.config.objectScale, this.config.objectScale);
    }
    dispose() { if (this.circle) { this.circle.geometry.dispose(); this.circle.material.dispose(); this.scene.remove(this.circle); } }
}

class FrequencyRingsWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.rings = [];
        this.time = 0;
        this.config = {
            ringCount: 8,
            objectScale: 1.0,
            expansionIntensity: 1.5,
            ringThickness: 0.05,
            spacing: 0.3,
            rotationSpeed: 0.5,
            positionX: 0.0,
            positionY: 0.0,
            ringColor: '#00ffff'
        };
        this.create();
    }
    create() {
        this.rings.forEach(ring => {
            ring.geometry.dispose();
            ring.material.dispose();
            this.scene.remove(ring);
        });
        this.rings = [];
        
        const color = new THREE.Color(this.config.ringColor);
        
        for (let i = 0; i < this.config.ringCount; i++) {
            const radius = (i + 1) * this.config.spacing;
            const geometry = new THREE.TorusGeometry(
                radius,
                this.config.ringThickness,
                16,
                64
            );
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.7,
                wireframe: false
            });
            const ring = new THREE.Mesh(geometry, material);
            ring.userData = {
                index: i,
                baseRadius: radius,
                frequencyBand: i / (this.config.ringCount - 1)
            };
            this.rings.push(ring);
            this.scene.add(ring);
        }
        this.updateConfig();
    }
    updateColors() {
        const color = new THREE.Color(this.config.ringColor);
        this.rings.forEach(ring => ring.material.color = color);
    }
    updateConfig() {
        if (this.rings.length !== this.config.ringCount) {
            this.create();
            return;
        }
        this.rings.forEach((ring, i) => {
            const radius = (i + 1) * this.config.spacing;
            ring.userData.baseRadius = radius;
            ring.scale.set(this.config.objectScale, this.config.objectScale, this.config.objectScale);
            ring.position.x = this.config.positionX;
            ring.position.y = this.config.positionY;
            
            ring.geometry.dispose();
            ring.geometry = new THREE.TorusGeometry(radius, this.config.ringThickness, 16, 64);
        });
    }
    update(dataArray, bands) {
        if (!dataArray) return;
        this.time += 0.01 * this.config.rotationSpeed;
        
        const { subBass, bass, lowMid, mid, highMid, treble } = bands;
        const freqArray = [subBass, bass, lowMid, mid, highMid, treble];
        
        this.rings.forEach((ring, i) => {
            const bandIndex = Math.floor((i / this.config.ringCount) * freqArray.length);
            const intensity = freqArray[bandIndex] || 0;
            
            const expansion = 1.0 + (intensity * this.config.expansionIntensity * 0.3);
            ring.scale.set(
                expansion * this.config.objectScale,
                expansion * this.config.objectScale,
                this.config.objectScale
            );
            
            ring.rotation.z = this.time + (i * 0.2);
            
            ring.material.opacity = 0.5 + (intensity * 0.5);
            
            ring.position.x = this.config.positionX;
            ring.position.y = this.config.positionY;
        });
    }
    dispose() {
        this.rings.forEach(ring => {
            ring.geometry.dispose();
            ring.material.dispose();
            this.scene.remove(ring);
        });
        this.rings = [];
    }
}

class MeshWaveWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.mesh = null;
        this.time = 0;
        this.config = {
            gridSize: 32,
            objectScale: 1.0,
            waveIntensity: 1.5,
            rotationSpeed: 0.3,
            positionX: 0.0,
            positionY: 0.0,
            meshColor: '#ff00ff',
            wireframe: true
        };
        this.create();
    }
    create() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.scene.remove(this.mesh);
        }
        
        const size = this.config.gridSize;
        const geometry = new THREE.PlaneGeometry(4, 4, size - 1, size - 1);
        
        const positions = geometry.attributes.position.array;
        geometry.userData.originalPositions = new Float32Array(positions);
        
        const color = new THREE.Color(this.config.meshColor);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: this.config.wireframe,
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 3;
        this.scene.add(this.mesh);
        this.updateConfig();
    }
    updateColors() {
        if (this.mesh) {
            this.mesh.material.color = new THREE.Color(this.config.meshColor);
        }
    }
    updateConfig() {
        if (!this.mesh) return;
        
        const currentSize = Math.sqrt(this.mesh.geometry.attributes.position.count);
        if (Math.abs(currentSize - this.config.gridSize) > 0.1) {
            this.create();
            return;
        }
        
        this.mesh.material.wireframe = this.config.wireframe;
        this.mesh.scale.set(this.config.objectScale, this.config.objectScale, this.config.objectScale);
        this.mesh.position.x = this.config.positionX;
        this.mesh.position.y = this.config.positionY;
    }
    update(dataArray, bands) {
        if (!dataArray || !this.mesh) return;
        
        this.time += 0.02 * this.config.rotationSpeed;
        const { bass, mid, treble } = bands;
        
        const positions = this.mesh.geometry.attributes.position.array;
        const originalPositions = this.mesh.geometry.userData.originalPositions;
        const size = this.config.gridSize;
        
        for (let i = 0; i < positions.length / 3; i++) {
            const i3 = i * 3;
            const x = originalPositions[i3];
            const y = originalPositions[i3 + 1];
            
            const freqIndex = Math.floor(((x + 2) / 4) * dataArray.length);
            const amplitude = dataArray[freqIndex] / 255;
            
            const wave1 = Math.sin(x * 2 + this.time) * amplitude;
            const wave2 = Math.cos(y * 2 - this.time * 0.7) * amplitude * 0.5;
            const wave3 = Math.sin((x + y) * 1.5 + this.time * 1.5) * bass;
            
            const z = (wave1 + wave2 + wave3) * this.config.waveIntensity * 0.5 + (mid * 0.3);
            
            positions[i3 + 2] = z;
        }
        
        this.mesh.geometry.attributes.position.needsUpdate = true;
        this.mesh.geometry.computeVertexNormals();
        
        this.mesh.rotation.y = this.time * 0.2;
        
        this.mesh.position.x = this.config.positionX;
        this.mesh.position.y = this.config.positionY;
    }
    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.scene.remove(this.mesh);
        }
    }
}

class PixelDiffusionWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.plane = null;
        this.texture = null;
        this.canvas = null;
        this.ctx = null;
        this.time = 0;
        this.config = {
            textureResolution: 256,
            pixelSize: 4,
            diffusionPower: 1.5,
            objectScale: 2.0,
            positionX: 0.0,
            positionY: 0.0,
            color1: '#000000',
            color2: '#ffffff'
        };
        this.create();
    }
    
    create() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.config.textureResolution;
        this.canvas.height = this.config.textureResolution;
        this.ctx = this.canvas.getContext('2d');
        
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.minFilter = THREE.NearestFilter;
        this.texture.magFilter = THREE.NearestFilter;
        
        const geometry = new THREE.PlaneGeometry(1, 1);
        const material = new THREE.MeshBasicMaterial({ 
            map: this.texture,
            side: THREE.DoubleSide
        });
        
        this.plane = new THREE.Mesh(geometry, material);
        this.scene.add(this.plane);
        this.updateConfig();
    }
    
    updateColors() {
        // Los colores se actualizan dinámicamente en update()
    }
    
    updateConfig() {
        if (!this.plane) return;
        
        const needsRecreate = 
            this.canvas.width !== this.config.textureResolution ||
            this.canvas.height !== this.config.textureResolution;
            
        if (needsRecreate) {
            this.plane.geometry.dispose();
            this.plane.material.dispose();
            if (this.texture) this.texture.dispose();
            this.scene.remove(this.plane);
            this.create();
            return;
        }
        
        this.plane.scale.set(this.config.objectScale, this.config.objectScale, 1);
        this.plane.position.x = this.config.positionX;
        this.plane.position.y = this.config.positionY;
    }
    
    update(dataArray, bands) {
        if (!dataArray || !this.ctx) return;
        
        const { bass, mid, treble, avg } = bands;
        const numRows = this.config.textureResolution / this.config.pixelSize;
        const numCols = this.config.textureResolution / this.config.pixelSize;
        
        const c1 = new THREE.Color(this.config.color1);
        const c2 = new THREE.Color(this.config.color2);
        
        this.ctx.fillStyle = `rgb(${c2.r * 255}, ${c2.g * 255}, ${c2.b * 255})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const audioBoost = 1 + (bass * 0.5);
        
        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                const normalizedY = row / (numRows - 1);
                const dataIdx = Math.floor((col / numCols) * dataArray.length);
                const amplitude = dataArray[dataIdx] / 255;
                
                const baseProbability = Math.pow(1 - normalizedY, this.config.diffusionPower);
                const blackProbability = baseProbability * (1 + amplitude * 0.5) * audioBoost;
                
                if (Math.random() < blackProbability) {
                    this.ctx.fillStyle = `rgb(${c1.r * 255}, ${c1.g * 255}, ${c1.b * 255})`;
                    this.ctx.fillRect(
                        col * this.config.pixelSize, 
                        row * this.config.pixelSize, 
                        this.config.pixelSize, 
                        this.config.pixelSize
                    );
                }
            }
        }
        
        this.texture.needsUpdate = true;
        this.plane.rotation.z = Math.sin(this.time * 0.5) * treble * 0.1;
        this.time += 0.01;
    }
    
    dispose() {
        if (this.plane) {
            this.plane.geometry.dispose();
            this.plane.material.dispose();
            this.scene.remove(this.plane);
        }
        if (this.texture) this.texture.dispose();
    }
}

class SprayParticlesWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.particles = null;
        this.time = 0;
        this.config = {
            particleCount: 50000,
            maxRadius: 3.0,
            radiusPower: 3.0,
            objectScale: 1.0,
            expansionIntensity: 1.5,
            rotationSpeed: 0.5,
            opacity: 0.8,
            positionX: 0.0,
            positionY: 0.0,
            particleColor: '#ffffff'
        };
        this.create();
    }
    
    createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        return new THREE.CanvasTexture(canvas);
    }
    
    create() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.particleCount * 3);

        for (let i = 0; i < this.config.particleCount; i++) {
            const i3 = i * 3;
            const phi = Math.acos(2 * Math.random() - 1);
            const theta = Math.random() * 2 * Math.PI;
            const r = Math.pow(Math.random(), this.config.radiusPower) * this.config.maxRadius;

            positions[i3 + 0] = r * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = r * Math.cos(phi);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.userData.originalPositions = new Float32Array(positions);

        const color = new THREE.Color(this.config.particleColor);
        const material = new THREE.PointsMaterial({
            color: color,
            size: 0.1,
            map: this.createParticleTexture(),
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: this.config.opacity,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
        this.updateConfig();
    }
    
    updateColors() {
        if (this.particles) {
            this.particles.material.color = new THREE.Color(this.config.particleColor);
        }
    }
    
    updateConfig() {
        if (!this.particles) return;
        
        const currentCount = this.particles.geometry.attributes.position.count;
        if (Math.abs(currentCount - this.config.particleCount) > 5000) {
            console.log(`🔄 Recreando geometría: ${currentCount} → ${this.config.particleCount}`);
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.scene.remove(this.particles);
            this.create();
            return;
        }
        
        this.particles.scale.set(this.config.objectScale, this.config.objectScale, this.config.objectScale);
        this.particles.material.opacity = this.config.opacity;
        this.particles.position.x = this.config.positionX;
        this.particles.position.y = this.config.positionY;
    }
    
    update(dataArray, bands) {
        if (!dataArray || !this.particles) return;
        
        const { bass, mid, treble } = bands;
        this.time += 0.01;
        
        const positions = this.particles.geometry.attributes.position.array;
        const originalPositions = this.particles.geometry.userData.originalPositions;
        
        const expansion = 1.0 + (bass * this.config.expansionIntensity * 0.3);
        
        for (let i = 0; i < this.config.particleCount; i++) {
            const i3 = i * 3;
            positions[i3] = originalPositions[i3] * expansion;
            positions[i3 + 1] = originalPositions[i3 + 1] * expansion;
            positions[i3 + 2] = originalPositions[i3 + 2] * expansion;
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        
        this.particles.rotation.y += 0.0005 * this.config.rotationSpeed * (1 + mid * 0.5);
        this.particles.rotation.x += 0.0002 * this.config.rotationSpeed * (1 + treble * 0.5);
    }
    
    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.scene.remove(this.particles);
        }
    }
}

class WaveGridWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.particles = null;
        this.time = 0;
        this.config = {
            gridSize: 60,
            spacing: 0.2,
            amplitude: 0.8,
            frequency: 0.5,
            objectScale: 1.0,
            waveSpeed: 1.5,
            positionX: 0.0,
            positionY: 0.0,
            particleColor: '#ffffff'
        };
        this.create();
    }
    
    create() {
        const totalParticles = this.config.gridSize * this.config.gridSize;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(totalParticles * 3);

        const offsetX = (this.config.gridSize - 1) * this.config.spacing / 2;
        const offsetY = (this.config.gridSize - 1) * this.config.spacing / 2;

        let index = 0;
        for (let i = 0; i < this.config.gridSize; i++) {
            for (let j = 0; j < this.config.gridSize; j++) {
                const x = i * this.config.spacing - offsetX;
                const y = j * this.config.spacing - offsetY;
                const z = 0;

                positions[index + 0] = x;
                positions[index + 1] = y;
                positions[index + 2] = z;

                index += 3;
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.userData.originalPositions = new Float32Array(positions);

        const color = new THREE.Color(this.config.particleColor);
        const material = new THREE.PointsMaterial({
            color: color,
            size: 0.08
        });

        this.particles = new THREE.Points(geometry, material);
        this.particles.rotation.x = -Math.PI / 2;

        this.scene.add(this.particles);
        this.updateConfig();
    }
    
    updateColors() {
        if (this.particles) {
            this.particles.material.color = new THREE.Color(this.config.particleColor);
        }
    }
    
    updateConfig() {
        if (!this.particles) return;
        
        const currentSize = Math.sqrt(this.particles.geometry.attributes.position.count);
        if (Math.abs(currentSize - this.config.gridSize) > 5) {
            console.log(`🔄 Recreando grid: ${currentSize} → ${this.config.gridSize}`);
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.scene.remove(this.particles);
            this.create();
            return;
        }
        
        this.particles.scale.set(this.config.objectScale, this.config.objectScale, this.config.objectScale);
        this.particles.position.x = this.config.positionX;
        this.particles.position.y = this.config.positionY;
    }
    
    update(dataArray, bands) {
        if (!dataArray || !this.particles) return;
        
        const { bass, mid, treble } = bands;
        this.time += 0.02 * this.config.waveSpeed;
        
        const positions = this.particles.geometry.attributes.position.array;
        const originalPositions = this.particles.geometry.userData.originalPositions;
        
        const audioBoost = 1 + (bass * 0.8) + (mid * 0.3);
        
        let index = 0;
        for (let i = 0; i < this.config.gridSize; i++) {
            for (let j = 0; j < this.config.gridSize; j++) {
                const x = originalPositions[index];
                const y = originalPositions[index + 1];
                
                const dataIdx = Math.floor(((i / this.config.gridSize) + (j / this.config.gridSize)) / 2 * dataArray.length);
                const amplitude = dataArray[dataIdx] / 255;

                const height = Math.sin((x * this.config.frequency) + this.time * 1.5) * this.config.amplitude * audioBoost + 
                               Math.cos((y * this.config.frequency / 2) + this.time * 0.8) * this.config.amplitude * 0.5 * audioBoost +
                               amplitude * 0.5;

                positions[index + 1] = height;
                
                index += 3;
            }
        }

        this.particles.geometry.attributes.position.needsUpdate = true;
    }
    
    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.scene.remove(this.particles);
        }
    }
}

const app = new AudioVisualizer();
