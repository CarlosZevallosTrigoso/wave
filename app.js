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
        
        // Post-processing
        this.composer = null;
        this.bloomPass = null;
        this.bloomEnabled = false;
        
        // Format
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
        
        // Calcular tamaño responsive manteniendo aspect ratio
        const wrapper = this.canvas.parentElement;
        const containerWidth = wrapper.clientWidth;
        const containerHeight = wrapper.clientHeight;
        
        const aspectRatio = width / height;
        const containerRatio = containerWidth / containerHeight;
        
        let displayWidth, displayHeight;
        
        // Usar 85% del espacio disponible para que se vea más grande
        const maxWidth = containerWidth * 0.85;
        const maxHeight = containerHeight * 0.85;
        
        if (containerRatio > aspectRatio) {
            // Container es más ancho - limitar por altura
            displayHeight = maxHeight;
            displayWidth = displayHeight * aspectRatio;
        } else {
            // Container es más alto - limitar por ancho
            displayWidth = maxWidth;
            displayHeight = displayWidth / aspectRatio;
        }
        
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
        if (this.renderer) {
            this.renderer.setSize(displayWidth, displayHeight);
        }
        if (this.composer) {
            this.composer.setSize(displayWidth, displayHeight);
        }
    }
    
    setupThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        
        // Camera
        const aspect = this.exportWidth / this.exportHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.z = 5;
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
    }
    
    setupPostProcessing() {
        // Usar versiones globales de Three.js
        this.composer = new THREE.EffectComposer(this.renderer);
        
        const renderPass = new THREE.RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        
        this.bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(this.canvas.width, this.canvas.height),
            1.5,  // strength
            0.4,  // radius
            0.85  // threshold
        );
        this.bloomPass.enabled = false;
        this.composer.addPass(this.bloomPass);
    }
    
    setupEventListeners() {
        document.getElementById('audioFile').addEventListener('change', (e) => this.loadAudio(e));
        document.getElementById('formatSelect').addEventListener('change', (e) => this.changeFormat(e.target.value));
        document.getElementById('waveformType').addEventListener('change', (e) => this.changeWaveform(e.target.value));
        document.getElementById('playPauseBtn').addEventListener('click', () => this.togglePlayPause());
        document.getElementById('timeline').addEventListener('input', (e) => this.seek(e.target.value));
        document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
        document.getElementById('bloomToggle').addEventListener('change', (e) => this.toggleBloom(e.target.checked));
        
        // Resize listener
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
            
            this.showStatus('Audio cargado correctamente', 'success');
            
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
            case 'gradientorb':
                this.currentWaveform = new GradientOrbWaveform(this.scene, this.analyser);
                break;
            case 'multiwave':
                this.currentWaveform = new MultiWaveWaveform(this.scene, this.analyser);
                break;
            case 'particlesphere':
                this.currentWaveform = new ParticleSphereWaveform(this.scene, this.analyser);
                break;
        }
        
        this.setupConfigUI();
        this.showStatus(`Waveform: ${type}`, 'success');
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
            
            // Si es un color (string que empieza con #)
            if (typeof value === 'string' && value.startsWith('#')) {
                const input = document.createElement('input');
                input.type = 'color';
                input.value = value;
                input.className = 'color-input';
                
                input.addEventListener('input', (e) => {
                    this.currentWaveform.config[key] = e.target.value;
                    if (this.currentWaveform.updateColors) {
                        this.currentWaveform.updateColors();
                    }
                    if (key === 'backgroundColor') {
                        this.scene.background = new THREE.Color(e.target.value);
                    }
                });
                
                item.appendChild(input);
            }
            // Si es un número
            else if (typeof value === 'number') {
                const input = document.createElement('input');
                input.type = 'range';
                input.min = key === 'particleCount' ? 1000 : 
                            key === 'segments' ? 32 : 
                            key === 'waveCount' ? 3 :
                            key === 'lineWidth' ? 0.5 :
                            key.includes('opacity') ? 0 : 0.1;
                input.max = key === 'particleCount' ? 10000 : 
                            key === 'segments' ? 256 : 
                            key === 'waveCount' ? 20 :
                            key === 'lineWidth' ? 10 :
                            key.includes('opacity') ? 1 :
                            key.includes('radius') || key.includes('size') ? 3 : 10;
                input.step = key === 'particleCount' ? 100 : 
                             key === 'segments' || key === 'waveCount' ? 1 :
                             key === 'lineWidth' ? 0.5 : 0.1;
                input.value = value;
                
                const valueDisplay = document.createElement('span');
                valueDisplay.textContent = (key === 'particleCount' || key === 'segments' || key === 'waveCount') ? value : value.toFixed(1);
                
                input.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    this.currentWaveform.config[key] = val;
                    valueDisplay.textContent = (key === 'particleCount' || key === 'segments' || key === 'waveCount') ? val : val.toFixed(1);
                    
                    // Actualizar material si existe el método
                    if (this.currentWaveform.updateMaterial) {
                        this.currentWaveform.updateMaterial();
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
    
    animate() {
        if (!this.isPlaying) return;
        
        requestAnimationFrame(() => this.animate());
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        if (this.currentWaveform) {
            this.currentWaveform.update(this.dataArray);
        }
        
        // Render con o sin post-processing
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
        
        const canvasStream = this.canvas.captureStream(30);
        const audioDestination = this.audioContext.createMediaStreamDestination();
        this.audioSource.connect(audioDestination);
        
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioDestination.stream.getAudioTracks()
        ]);
        
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
        
        this.mediaRecorder.start();
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
        
        this.showStatus('Guardando video...', 'success');
    }
    
    saveRecording() {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `waveform_${Date.now()}.webm`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.showStatus('Video guardado', 'success');
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

// Particle Morph Waveform
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
            colorCycle: 0.5,
            opacity: 0.9,
            backgroundColor: '#000000'
        };
        
        this.create();
        this.scene.background = new THREE.Color(this.config.backgroundColor);
    }
    
    create() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.particleCount * 3);
        const colors = new Float32Array(this.config.particleCount * 3);
        const sizes = new Float32Array(this.config.particleCount);
        
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
            opacity: this.config.opacity,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }
    
    updateMaterial() {
        if (this.particles && this.particles.material) {
            this.particles.material.opacity = this.config.opacity;
            this.particles.material.size = this.config.size;
        }
    }
    
    update(dataArray) {
        if (!dataArray || dataArray.length === 0) return;
        
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
            
            const dataIdx = Math.floor((i / this.config.particleCount) * dataArray.length);
            const amplitude = dataArray[dataIdx] / 255;
            
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
            
            const hue = ((i / this.config.particleCount) + 
                        this.time * this.config.colorCycle * 0.1 + 
                        amplitude * 0.2) % 1;
            const color = new THREE.Color().setHSL(hue, 1, 0.5);
            colors[i3] = color.r * (1 + amplitude);
            colors[i3 + 1] = color.g * (1 + amplitude);
            colors[i3 + 2] = color.b * (1 + amplitude);
            
            sizes[i] = this.config.size * (0.5 + amplitude * 2 + avgAmplitude);
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.color.needsUpdate = true;
        this.particles.geometry.attributes.size.needsUpdate = true;
    }
    
    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.scene.remove(this.particles);
        }
    }
}

// Gradient Orb Waveform - Esfera 2D con degradado y dither
class GradientOrbWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.mesh = null;
        this.time = 0;
        
        this.config = {
            segments: 128,
            radius: 1.5,
            waveIntensity: 0.8,
            ditherAmount: 0.3,
            backgroundColor: '#1a2a1a'
        };
        
        this.create();
        this.scene.background = new THREE.Color(this.config.backgroundColor);
    }
    
    create() {
        const geometry = new THREE.CircleGeometry(this.config.radius, this.config.segments);
        
        // Shader personalizado para gradiente con dither
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                amplitude: { value: 0 },
                ditherAmount: { value: this.config.ditherAmount }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform float amplitude;
                uniform float ditherAmount;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                // Función de dither simple
                float dither(vec2 uv) {
                    return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
                }
                
                void main() {
                    vec2 center = vec2(0.5, 0.5);
                    float dist = distance(vUv, center);
                    
                    // Gradiente radial con múltiples anillos
                    float rings = sin(dist * 12.0 - time * 2.0 + amplitude * 3.0) * 0.5 + 0.5;
                    
                    // Colores del gradiente
                    vec3 color1 = vec3(0.1, 0.3, 0.8); // Azul
                    vec3 color2 = vec3(0.9, 0.9, 0.95); // Blanco/gris claro
                    vec3 color3 = vec3(1.0, 0.4, 0.2); // Naranja/rojo
                    vec3 color4 = vec3(0.15, 0.25, 0.15); // Verde oscuro (fondo)
                    
                    // Mezclar colores basado en distancia
                    vec3 color;
                    if (dist < 0.3) {
                        color = mix(color1, color2, dist / 0.3);
                    } else if (dist < 0.6) {
                        color = mix(color2, color3, (dist - 0.3) / 0.3);
                    } else {
                        color = mix(color3, color4, (dist - 0.6) / 0.4);
                    }
                    
                    // Aplicar dither
                    float ditherValue = dither(vUv * 200.0) * ditherAmount;
                    color += vec3(ditherValue);
                    
                    // Fade out en los bordes
                    float alpha = 1.0 - smoothstep(0.85, 1.0, dist);
                    
                    // Aplicar rings para efecto de ondas
                    color *= rings * 0.3 + 0.7;
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
    }
    
    update(dataArray) {
        if (!dataArray || dataArray.length === 0) return;
        
        this.time += 0.02;
        
        const avgAmplitude = dataArray.reduce((a, b) => a + b) / dataArray.length / 255;
        const bassData = dataArray.slice(0, Math.floor(dataArray.length * 0.2));
        const bassAvg = bassData.reduce((a, b) => a + b, 0) / bassData.length / 255;
        
        // Actualizar uniforms del shader
        this.mesh.material.uniforms.time.value = this.time;
        this.mesh.material.uniforms.amplitude.value = avgAmplitude * this.config.waveIntensity;
        this.mesh.material.uniforms.ditherAmount.value = this.config.ditherAmount;
        
        // Pulsar el tamaño con el bass
        const scale = 1.0 + bassAvg * 0.2;
        this.mesh.scale.set(scale, scale, scale);
    }
    
    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.scene.remove(this.mesh);
        }
        this.scene.background = new THREE.Color(0x000000);
    }
}

// Multi Wave Waveform - Múltiples líneas ondulantes
class MultiWaveWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.waves = [];
        this.time = 0;
        
        this.config = {
            waveCount: 12,
            segments: 128,
            waveIntensity: 1.5,
            spacing: 0.15,
            speed: 1.0,
            lineWidth: 2.0,
            opacity: 0.8,
            lineColor: '#ffffff',
            backgroundColor: '#000000'
        };
        
        this.create();
        this.scene.background = new THREE.Color(this.config.backgroundColor);
    }
    
    create() {
        for (let i = 0; i < this.config.waveCount; i++) {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(this.config.segments * 3);
            const colors = new Float32Array(this.config.segments * 3);
            
            const yPos = (i - this.config.waveCount / 2) * this.config.spacing;
            
            // Convertir color hex a RGB
            const color = new THREE.Color(this.config.lineColor);
            
            for (let j = 0; j < this.config.segments; j++) {
                const x = (j / (this.config.segments - 1)) * 4 - 2;
                positions[j * 3] = x;
                positions[j * 3 + 1] = yPos;
                positions[j * 3 + 2] = 0;
                
                colors[j * 3] = color.r;
                colors[j * 3 + 1] = color.g;
                colors[j * 3 + 2] = color.b;
            }
            
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            const material = new THREE.LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: this.config.opacity,
                linewidth: this.config.lineWidth
            });
            
            const wave = new THREE.Line(geometry, material);
            wave.userData = { 
                index: i,
                baseY: yPos,
                originalPositions: new Float32Array(positions)
            };
            
            this.waves.push(wave);
            this.scene.add(wave);
        }
    }
    
    updateColors() {
        const color = new THREE.Color(this.config.lineColor);
        this.waves.forEach(wave => {
            const colors = wave.geometry.attributes.color.array;
            for (let i = 0; i < this.config.segments; i++) {
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            }
            wave.geometry.attributes.color.needsUpdate = true;
        });
    }
    
    updateMaterial() {
        this.waves.forEach(wave => {
            wave.material.opacity = this.config.opacity;
            wave.material.linewidth = this.config.lineWidth;
        });
    }
    
    update(dataArray) {
        if (!dataArray || dataArray.length === 0) return;
        
        this.time += 0.02 * this.config.speed;
        
        this.waves.forEach((wave, waveIdx) => {
            const positions = wave.geometry.attributes.position.array;
            const originalPositions = wave.userData.originalPositions;
            
            for (let i = 0; i < this.config.segments; i++) {
                const x = originalPositions[i * 3];
                const baseY = wave.userData.baseY;
                
                // Mapear posición X al array de datos de audio
                const dataIdx = Math.floor((i / this.config.segments) * dataArray.length);
                const amplitude = dataArray[dataIdx] / 255;
                
                // Crear ondas con diferentes fases
                const wave1 = Math.sin(x * 2 + this.time + waveIdx * 0.5) * amplitude;
                const wave2 = Math.sin(x * 3 - this.time * 0.7 + waveIdx * 0.3) * amplitude * 0.5;
                const wave3 = Math.sin(x * 5 + this.time * 1.3 + waveIdx * 0.2) * amplitude * 0.3;
                
                const displacement = (wave1 + wave2 + wave3) * this.config.waveIntensity * 0.3;
                
                positions[i * 3 + 1] = baseY + displacement;
            }
            
            wave.geometry.attributes.position.needsUpdate = true;
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

// Particle Sphere Waveform - Esfera de partículas blancas
class ParticleSphereWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.particles = null;
        this.time = 0;
        
        this.config = {
            particleCount: 5000,
            size: 0.03,
            sphereRadius: 1.2,
            expansionIntensity: 1.5,
            opacity: 0.9,
            particleColor: '#ffffff',
            backgroundColor: '#000000'
        };
        
        this.create();
        this.scene.background = new THREE.Color(this.config.backgroundColor);
    }
    
    create() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.particleCount * 3);
        const sizes = new Float32Array(this.config.particleCount);
        
        // Distribución uniforme en una esfera usando algoritmo de Fibonacci
        for (let i = 0; i < this.config.particleCount; i++) {
            const phi = Math.acos(1 - 2 * (i + 0.5) / this.config.particleCount);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            
            const radius = this.config.sphereRadius;
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            
            // Variar ligeramente el tamaño para efecto más orgánico
            sizes[i] = this.config.size * (0.5 + Math.random() * 0.5);
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        geometry.userData.originalPositions = new Float32Array(positions);
        
        const color = new THREE.Color(this.config.particleColor);
        const material = new THREE.PointsMaterial({
            size: this.config.size,
            color: color,
            transparent: true,
            opacity: this.config.opacity,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }
    
    updateColors() {
        if (this.particles && this.particles.material) {
            this.particles.material.color = new THREE.Color(this.config.particleColor);
        }
    }
    
    updateMaterial() {
        if (this.particles && this.particles.material) {
            this.particles.material.opacity = this.config.opacity;
            this.particles.material.size = this.config.size;
        }
    }
    
    update(dataArray) {
        if (!dataArray || dataArray.length === 0) return;
        
        this.time += 0.01;
        
        const positions = this.particles.geometry.attributes.position.array;
        const originalPositions = this.particles.geometry.userData.originalPositions;
        const sizes = this.particles.geometry.attributes.size.array;
        
        const avgAmplitude = dataArray.reduce((a, b) => a + b) / dataArray.length / 255;
        const bassData = dataArray.slice(0, Math.floor(dataArray.length * 0.2));
        const bassAvg = bassData.reduce((a, b) => a + b, 0) / bassData.length / 255;
        
        for (let i = 0; i < this.config.particleCount; i++) {
            const i3 = i * 3;
            const x = originalPositions[i3];
            const y = originalPositions[i3 + 1];
            const z = originalPositions[i3 + 2];
            
            // Mapear partícula al espectro de audio
            const dataIdx = Math.floor((i / this.config.particleCount) * dataArray.length);
            const amplitude = dataArray[dataIdx] / 255;
            
            // Expansión radial basada en audio
            const distance = Math.sqrt(x * x + y * y + z * z);
            const expansion = amplitude * this.config.expansionIntensity * 0.3 + bassAvg * 0.2;
            const newDistance = distance + expansion;
            
            const scale = newDistance / distance;
            positions[i3] = x * scale;
            positions[i3 + 1] = y * scale;
            positions[i3 + 2] = z * scale;
            
            // Variar tamaño de partículas con el audio
            sizes[i] = this.config.size * (0.8 + amplitude * 1.5 + avgAmplitude * 0.5);
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.size.needsUpdate = true;
    }
    
    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.scene.remove(this.particles);
        }
    }
}

// Initialize app
const app = new AudioVisualizer();
