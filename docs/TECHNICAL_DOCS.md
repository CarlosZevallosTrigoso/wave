# Documentación Técnica - Waveforms Creativos

## Visión General de los Efectos

Esta aplicación implementa cuatro visualizaciones de audio ultra-creativas inspiradas en referencias visuales de motion design contemporáneo. Cada efecto combina técnicas de gráficos computacionales con análisis de audio en tiempo real.

## 1. Slit-Scan Sphere

### Inspiración Visual
Esfera compuesta por capas horizontales difuminadas con efecto de motion blur, creando una ilusión de profundidad y movimiento temporal similar a la técnica de fotografía slit-scan.

### Implementación Técnica

**Geometría**: 
- 30 capas de anillos (RingGeometry) posicionadas verticalmente
- Cada capa calcula su radio basado en la ecuación de esfera: `r = sqrt(1 - y²)`
- Las capas se distribuyen uniformemente en el eje Y

**Efectos Reactivos**:
- **Motion Blur**: Desplazamiento vertical de capas usando `sin(time + layerIndex)` modulado por amplitud de audio
- **Scaling**: Cada capa escala dinámicamente según su frecuencia correspondiente + promedio de graves
- **Color Shifting**: HSL color mapping con hue progresivo y brightness reactivo a la amplitud
- **Opacity Pulsing**: Transparencia modulada por la intensidad de audio (0.6 - 1.0)

**Análisis de Audio**:
```javascript
// Bass detection para escala general
const bassData = dataArray.slice(0, floor(length * 0.1));
const bassAvg = average(bassData) / 255;

// Frecuencias individuales por capa
const dataIdx = floor(layerProgress * dataArray.length);
const amplitude = dataArray[dataIdx] / 255;
```

**Blending Mode**: AdditiveBlending para crear glow y superposición luminosa

---

## 2. Liquid Blur

### Inspiración Visual
Formas orgánicas fluidas con blur intenso, reminiscente de fotografía con larga exposición o efectos de difusión química. Colores vibrantes con transiciones suaves.

### Implementación Técnica

**Geometría Base**:
- 5 esferas (SphereGeometry) con alta densidad de vértices (32x32 segments)
- Posiciones originales almacenadas en `geometry.userData.originalPositions`

**Deformación de Vértices**:
Cada vértice se deforma usando una función combinada:
```javascript
const distortion = sin(time * 2 + x * 3) * 
                  cos(time * 1.5 + y * 3) * 
                  amplitude * 0.3;

newPosition = originalPosition * (1 + distortion);
```

**Movimiento Orgánico**:
- Rotación orbital: Los blobs orbitan el centro en patrones circulares
- Cada blob tiene un `phase` único para crear asimetría
- Radio orbital modulado por amplitud promedio de audio

**Efectos de Color**:
- HSL color cycling con hue basado en índice + amplitud
- Brightness multiplicado por un factor configurable (2.5x default)
- Opacity variable (0.5 - 0.9) para transparencias fluidas

**Scaling Reactivo**:
```javascript
const scale = 0.8 + bassAvg * 1.5 + avgAmplitude * 0.5;
```
Triple influencia: base + graves + promedio general

---

## 3. Particle Morph

### Inspiración Visual
Esfera de partículas tipo LED matrix con deformación ondulante, similar a visualizaciones de sonido en instalaciones inmersivas y conciertos electrónicos.

### Implementación Técnica

**Distribución Fibonacci**:
Las 8000 partículas se distribuyen uniformemente usando la esfera de Fibonacci:
```javascript
const phi = acos(1 - 2 * (i + 0.5) / particleCount);
const theta = PI * (1 + sqrt(5)) * i;

x = radius * sin(phi) * cos(theta);
y = radius * sin(phi) * sin(theta);
z = radius * cos(phi);
```
Este algoritmo garantiza distribución uniforme sin agrupamiento polar.

**Deformación Ondulante**:
Dos ondas senoidales se combinan para crear patrones complejos:
```javascript
const angle = atan2(y, x);
const wave1 = sin(angle * 3 + time * 2) * amplitude;
const wave2 = cos(angle * 5 - time * 1.5) * amplitude;
const deformation = (wave1 + wave2) * 0.3;

// Aplicar deformación radial
newDistance = originalDistance + deformation;
```

**Sistema de Color Dinámico**:
- Color base cíclico por posición en esfera
- Modulación por amplitud de audio
- Brightness multiplicador basado en intensidad
- Color update per-particle cada frame

**Size Variation**:
```javascript
particleSize = baseSize * (0.5 + amplitude * 2 + avgAmplitude);
```
Variación individual + influencia global

**Performance**:
- BufferGeometry para eficiencia con 8000+ partículas
- PointsMaterial con sizeAttenuation
- AdditiveBlending para glow effect

---

## 4. Echo Ripples

### Inspiración Visual
Ondas concéntricas con efecto de eco/delay, inspirado en visualizaciones de sonar, interferencias moiré y patrones de onda acústica.

### Implementación Técnica

**Sistema de Ondas**:
- 12 ripples concéntricos independientes
- Cada ripple es un LineLoop de 128 segmentos
- Cada ripple tiene un `phase` offset para timing escalonado

**Expansión Temporal**:
```javascript
const progress = ((time + phase) % (PI * 2)) / (PI * 2);
const radius = progress * maxRadius;
const opacity = 1 - progress; // Fade out al expandirse
```

**Distorsión Multi-Onda**:
Tres componentes de distorsión simultáneas:
```javascript
const distortion = 
    sin(angle * 3 - time * 3) * amplitude * 0.2 +  // Onda rápida
    sin(angle * 5 + time * 2) * amplitude * 0.15 + // Onda media
    bassAvg * 0.3;                                   // Pulso de graves
```

**Color Gradiente Complejo**:
El color de cada punto en el ripple considera:
- Índice del ripple en el conjunto
- Posición angular del punto
- Amplitud de audio correspondiente
- Tiempo global para cycling

**Efecto Moiré**:
Rotación lenta del conjunto completo:
```javascript
ripple.rotation.z = time * 0.1;
```
Crea patrones de interferencia visual al superponerse las ondas

**Sincronización Audio**:
- Cada segmento del ripple lee una frecuencia específica
- Los graves afectan toda la forma globalmente
- Las frecuencias medias/altas crean micro-deformaciones

---

## Técnicas Comunes en Todos los Waveforms

### 1. Análisis de Frecuencias Multi-Banda

```javascript
// Graves (0-10% del espectro): ~20-250 Hz
const bassData = dataArray.slice(0, floor(length * 0.1));
const bassAvg = average(bassData) / 255;

// Medios (10-50%): ~250-2kHz
const midData = dataArray.slice(floor(length * 0.1), floor(length * 0.5));
const midAvg = average(midData) / 255;

// Agudos (50-100%): ~2kHz+
const trebleData = dataArray.slice(floor(length * 0.5));
const trebleAvg = average(trebleData) / 255;
```

### 2. Blending Modes para Efectos de Luz

**AdditiveBlending**: 
- Suma los colores en lugar de sobreescribirlos
- Crea efectos de glow y luz brillante
- Usado en todos los waveforms para maximizar impacto visual

### 3. Color Space HSL

Todos los efectos usan HSL (Hue, Saturation, Lightness) porque:
- **Hue**: Fácil de animar cíclicamente (0-1 wraps)
- **Saturation**: Casi siempre 1.0 para colores vibrantes
- **Lightness**: Modulado por amplitud para brightness reactivo

### 4. Temporal Smoothing

Aunque no implementado explícitamente, la naturaleza continua del audio análisis (AnalyserNode con smoothingTimeConstant) suaviza las transiciones.

---

## Optimizaciones de Performance

### Memory Management
- Geometrías creadas una vez en `create()`
- Solo `positions`, `colors`, y `sizes` arrays se actualizan
- `needsUpdate` flags usados selectivamente

### Render Optimization
- PixelRatio fijo en 1 para consistency
- Canvas size preciso (1080x1080 o 1080x1350)
- RequestAnimationFrame para sincronización con display

### Audio Processing
- FFT size de 512: balance entre detalle y performance
- FrequencyBinCount de 256 valores
- Análisis optimizado con typed arrays (Uint8Array)

---

## Grabación de Video

### MediaRecorder Configuration
```javascript
{
    mimeType: 'video/webm;codecs=vp9,opus',
    videoBitsPerSecond: 8000000 // 8 Mbps
}
```

### Captura Sincronizada
```javascript
const canvasStream = canvas.captureStream(30); // 30 FPS
const audioStream = audioContext.createMediaStreamDestination();
const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioStream.stream.getAudioTracks()
]);
```

### Export Process
1. Grabación inicia automáticamente con playback
2. Chunks se acumulan en array
3. Al terminar, se crea Blob y download automático
4. Nombre de archivo con timestamp

---

## Extensibilidad

Cada waveform sigue el mismo interface pattern:

```javascript
class MyCustomWaveform {
    constructor(scene, analyser) {
        this.scene = scene;
        this.analyser = analyser;
        this.config = { /* user-adjustable parameters */ };
        this.create();
    }
    
    create() { /* initialize geometry */ }
    update(dataArray) { /* react to audio */ }
    dispose() { /* cleanup resources */ }
}
```

Para agregar nuevos efectos:
1. Crear clase que siga este pattern
2. Agregar case al switch en `changeWaveform()`
3. Agregar option al HTML select

---

## Referencias Técnicas

**Three.js Geometry Types Used**:
- RingGeometry: Slit-Scan layers
- SphereGeometry: Liquid Blur blobs, Particle base
- BufferGeometry: Custom particle systems, ripples
- LineLoop/Line: Echo Ripples, wave forms

**Materials**:
- MeshBasicMaterial: Unlit, performant, color-accurate
- PointsMaterial: Particle systems con size control
- LineBasicMaterial: Stroke rendering

**Web APIs**:
- Web Audio API (AnalyserNode, AudioContext)
- MediaRecorder API (Canvas + Audio capture)
- Canvas API (capture streams)
- Blob API (video export)

---

## Futuras Mejoras Posibles

1. **Post-Processing con EffectComposer**:
   - UnrealBloomPass para glow effect intenso
   - FilmPass para grain texture
   - GlitchPass para efectos glitch reactivos

2. **Shaders GLSL Customizados**:
   - Vertex shaders para deformaciones más complejas
   - Fragment shaders para efectos de color procedurales
   - Compute shaders para física de partículas

3. **Análisis de Audio Avanzado**:
   - Beat detection automático
   - Onset detection para cambios bruscos
   - Pitch detection para melodía
   - Spectral flux para texturas tímbricas

4. **Física Integrada**:
   - Cannon.js o Ammo.js para simulación física
   - Particle springs y constraints
   - Soft body dynamics para Liquid Blur

5. **Machine Learning**:
   - Clasificación de género musical para auto-select waveform
   - Style transfer basado en cover art
   - Emotional analysis del audio para color palette

---

## Créditos y Licencias

**Frameworks**:
- Three.js r128 (MIT License)
- Web Audio API (W3C Standard)

**Técnicas Inspiradas En**:
- Slit-scan photography (experimental film techniques)
- Cymatics (visualización física de sonido)
- Generative art (Processing, openFrameworks communities)
- VJ culture (Resolume, Milkdrop, etc.)

**Desarrollado para**: Creación de contenido audiovisual para redes sociales, performances en vivo, y experimentación artística.
