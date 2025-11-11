# Guía de Customización Avanzada

## Crear tu propio Waveform

Para agregar un nuevo tipo de waveform, sigue esta plantilla:

```javascript
class MiWaveformCustom {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.mesh = null; // o this.particles, this.group, etc.
        
        // Define tus configuraciones expuestas al usuario
        this.config = {
            miParametro1: 1.0,
            miParametro2: 0.5,
            miColor: '#ff00ff'
        };
        
        this.create();
    }
    
    create() {
        // Crea tu geometría y materiales aquí
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: this.config.miColor 
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
    }
    
    update(dataArray) {
        // Actualiza tu visualización basándote en dataArray
        // dataArray es un Uint8Array con valores de 0-255
        
        // Ejemplo: escalar basado en el promedio
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const scale = 1 + (avg / 255) * this.config.miParametro1;
        this.mesh.scale.set(scale, scale, scale);
        
        // Rotar
        this.mesh.rotation.y += 0.01 * this.config.miParametro2;
    }
    
    dispose() {
        // Limpia recursos
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.scene.remove(this.mesh);
        }
    }
}
```

Luego agrega tu waveform al selector en `app.js`:

```javascript
changeWaveform(type) {
    // ... código existente ...
    
    switch(type) {
        // ... casos existentes ...
        case 'micustom':
            this.currentWaveform = new MiWaveformCustom(this.scene, this.analyser);
            break;
    }
}
```

Y añade la opción al HTML:

```html
<option value="micustom">Mi Waveform Custom</option>
```

## Ejemplos de Waveforms avanzados

### 1. Waveform con Shaders GLSL

```javascript
class ShaderWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        
        this.config = {
            frequency: 1.0,
            amplitude: 0.5,
            speed: 1.0
        };
        
        // Shader personalizado
        const vertexShader = `
            uniform float time;
            uniform float frequency;
            uniform float amplitude;
            varying vec2 vUv;
            
            void main() {
                vUv = uv;
                vec3 pos = position;
                float wave = sin(pos.x * frequency + time) * amplitude;
                pos.y += wave;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `;
        
        const fragmentShader = `
            uniform float time;
            varying vec2 vUv;
            
            void main() {
                vec3 color = vec3(
                    0.5 + 0.5 * sin(time + vUv.x * 10.0),
                    0.5 + 0.5 * sin(time + vUv.y * 10.0 + 2.0),
                    0.5 + 0.5 * sin(time + vUv.x * 10.0 + 4.0)
                );
                gl_FragColor = vec4(color, 1.0);
            }
        `;
        
        const geometry = new THREE.PlaneGeometry(4, 2, 128, 64);
        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                time: { value: 0 },
                frequency: { value: this.config.frequency },
                amplitude: { value: this.config.amplitude }
            }
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
        this.time = 0;
    }
    
    update(dataArray) {
        this.time += 0.01 * this.config.speed;
        
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length / 255;
        
        this.mesh.material.uniforms.time.value = this.time;
        this.mesh.material.uniforms.frequency.value = this.config.frequency * (1 + avg);
        this.mesh.material.uniforms.amplitude.value = this.config.amplitude * (1 + avg * 2);
    }
    
    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.scene.remove(this.mesh);
    }
}
```

### 2. Waveform 3D con profundidad

```javascript
class Wave3D {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        
        this.config = {
            gridSize: 32,
            amplitude: 1.0,
            rotation: 0.5
        };
        
        const size = this.config.gridSize;
        const geometry = new THREE.PlaneGeometry(4, 4, size - 1, size - 1);
        
        const material = new THREE.MeshNormalMaterial({
            wireframe: false,
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 4;
        this.scene.add(this.mesh);
        
        this.positions = geometry.attributes.position.array;
    }
    
    update(dataArray) {
        const segmentSize = Math.floor(dataArray.length / this.config.gridSize);
        
        for (let i = 0; i < this.config.gridSize; i++) {
            for (let j = 0; j < this.config.gridSize; j++) {
                const idx = (i * this.config.gridSize + j) * 3;
                const dataIdx = Math.floor((i * this.config.gridSize + j) / 
                    (this.config.gridSize * this.config.gridSize) * dataArray.length);
                
                const amplitude = (dataArray[dataIdx] / 255) * this.config.amplitude;
                this.positions[idx + 2] = amplitude;
            }
        }
        
        this.mesh.geometry.attributes.position.needsUpdate = true;
        this.mesh.geometry.computeVertexNormals();
        this.mesh.rotation.z += 0.001 * this.config.rotation;
    }
    
    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.scene.remove(this.mesh);
    }
}
```

### 3. Waveform con Text (tipografía reactiva)

```javascript
class TextWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.letters = [];
        
        this.config = {
            text: 'AUDIO',
            size: 0.4,
            spacing: 0.6,
            reactivity: 2.0
        };
        
        // Cargar fuente (requiere THREE.FontLoader)
        // Para simplificar, usamos geometría básica
        this.createText();
    }
    
    createText() {
        const text = this.config.text;
        const letterSpacing = this.config.spacing;
        const startX = -(text.length * letterSpacing) / 2;
        
        for (let i = 0; i < text.length; i++) {
            const geometry = new THREE.BoxGeometry(
                this.config.size, 
                this.config.size, 
                this.config.size
            );
            
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(i / text.length, 1, 0.5)
            });
            
            const letter = new THREE.Mesh(geometry, material);
            letter.position.x = startX + i * letterSpacing;
            
            this.letters.push(letter);
            this.scene.add(letter);
        }
    }
    
    update(dataArray) {
        const segmentSize = Math.floor(dataArray.length / this.letters.length);
        
        this.letters.forEach((letter, i) => {
            const dataIdx = i * segmentSize;
            const amplitude = (dataArray[dataIdx] / 255) * this.config.reactivity;
            
            letter.scale.y = 1 + amplitude;
            letter.position.y = amplitude * 0.5;
            
            // Color shift
            const hue = (i / this.letters.length + amplitude * 0.1) % 1;
            letter.material.color.setHSL(hue, 1, 0.5);
        });
    }
    
    dispose() {
        this.letters.forEach(letter => {
            letter.geometry.dispose();
            letter.material.dispose();
            this.scene.remove(letter);
        });
        this.letters = [];
    }
}
```

## Trabajar con diferentes análisis de frecuencia

### Obtener bandas específicas:

```javascript
update(dataArray) {
    // Frecuencias bajas (bass): 0-255 Hz aproximadamente
    const bassStart = 0;
    const bassEnd = Math.floor(dataArray.length * 0.1);
    const bassData = dataArray.slice(bassStart, bassEnd);
    const bassAvg = bassData.reduce((a, b) => a + b) / bassData.length;
    
    // Frecuencias medias (mid): 256-2047 Hz
    const midStart = bassEnd;
    const midEnd = Math.floor(dataArray.length * 0.5);
    const midData = dataArray.slice(midStart, midEnd);
    const midAvg = midData.reduce((a, b) => a + b) / midData.length;
    
    // Frecuencias altas (treble): 2048+ Hz
    const trebleStart = midEnd;
    const trebleData = dataArray.slice(trebleStart);
    const trebleAvg = trebleData.reduce((a, b) => a + b) / trebleData.length;
    
    // Usar cada banda para diferentes efectos
    this.mesh.scale.x = 1 + (bassAvg / 255);
    this.mesh.scale.y = 1 + (midAvg / 255);
    this.mesh.rotation.z += (trebleAvg / 255) * 0.01;
}
```

### Detectar beats:

```javascript
class BeatDetector {
    constructor() {
        this.history = [];
        this.maxHistory = 43; // ~1 segundo a 43 FPS
        this.threshold = 1.3;
    }
    
    detect(dataArray) {
        const bassData = dataArray.slice(0, Math.floor(dataArray.length * 0.1));
        const energy = bassData.reduce((a, b) => a + b) / bassData.length;
        
        this.history.push(energy);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        
        const average = this.history.reduce((a, b) => a + b) / this.history.length;
        
        return energy > average * this.threshold;
    }
}

// Uso en waveform:
class BeatReactiveWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.beatDetector = new BeatDetector();
        // ...
    }
    
    update(dataArray) {
        if (this.beatDetector.detect(dataArray)) {
            // Hacer algo cuando hay beat
            this.mesh.scale.set(1.5, 1.5, 1.5);
        } else {
            // Regresar a escala normal
            this.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        }
    }
}
```

## Integrar post-processing

Para efectos visuales adicionales, usa EffectComposer:

```javascript
// En el constructor de AudioVisualizer, después de setupThreeJS():
setupPostProcessing() {
    // Requiere importar:
    // - EffectComposer
    // - RenderPass
    // - UnrealBloomPass, etc.
    
    this.composer = new THREE.EffectComposer(this.renderer);
    
    const renderPass = new THREE.RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    
    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(this.canvas.width, this.canvas.height),
        1.5, // strength
        0.4, // radius
        0.85 // threshold
    );
    this.composer.addPass(bloomPass);
}

// En animate(), reemplazar:
// this.renderer.render(this.scene, this.camera);
// Con:
this.composer.render();
```

## Tips de optimización

### 1. Reutilizar geometrías:

```javascript
// MAL: crear geometría nueva cada frame
update(dataArray) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    // ...
}

// BIEN: modificar geometría existente
create() {
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
}

update(dataArray) {
    const positions = this.geometry.attributes.position.array;
    // modificar positions
    this.geometry.attributes.position.needsUpdate = true;
}
```

### 2. Object pooling para partículas:

```javascript
class ParticlePool {
    constructor(count) {
        this.pool = [];
        for (let i = 0; i < count; i++) {
            const particle = new THREE.Mesh(
                sharedGeometry,
                sharedMaterial.clone()
            );
            particle.visible = false;
            this.pool.push(particle);
        }
    }
    
    get() {
        return this.pool.find(p => !p.visible);
    }
    
    release(particle) {
        particle.visible = false;
    }
}
```

### 3. Limitar updates complejos:

```javascript
update(dataArray) {
    this.frameCount++;
    
    // Actualizar sólo cada N frames
    if (this.frameCount % 2 === 0) {
        this.expensiveCalculation();
    }
}
```

## Debugging y desarrollo

### Ver estadísticas de rendimiento:

```javascript
// Agregar Stats.js
const stats = new Stats();
document.body.appendChild(stats.dom);

// En animate():
stats.begin();
// ... código de renderizado ...
stats.end();
```

### Console log de frecuencias:

```javascript
update(dataArray) {
    if (Math.random() < 0.1) { // 10% de frames
        console.log('Frecuencias:', {
            min: Math.min(...dataArray),
            max: Math.max(...dataArray),
            avg: dataArray.reduce((a,b) => a+b) / dataArray.length
        });
    }
}
```

¡Experimenta y crea tus propias visualizaciones únicas! 🎨✨
