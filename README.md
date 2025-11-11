# Audio Waveform Visualizer

Aplicación web para crear visualizaciones de audio reactivas con Four.js, optimizada para GitHub Pages.

## Características

- 🎵 Carga archivos MP3 y genera waveforms reactivos
- 🎨 Cuatro tipos de visualización ultra-creativos:
  - **Slit-Scan Sphere**: Esfera de capas horizontales con efecto motion blur y desplazamiento fluido
  - **Liquid Blur**: Formas orgánicas líquidas con deformación en tiempo real y blur psicodélico
  - **Particle Morph**: Esfera de 8000 partículas con deformación ondulante y colores dinámicos
  - **Echo Ripples**: Ondas concéntricas expansivas con efecto eco y distorsión moiré
- ⚙️ Controles configurables para cada tipo de waveform
- 📐 Dos formatos de salida: 1080x1080px (cuadrado) y 1080x1350px (vertical)
- 🎬 Grabación automática a video WebM con audio sincronizado
- ▶️ Controles de reproducción completos (play, pause, timeline)
- ⚡ Optimizado para rendimiento del navegador con efectos visuales intensos

## Instalación en GitHub Pages

1. **Crear repositorio en GitHub**
   ```bash
   # En tu terminal, navega a la carpeta del proyecto
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/audio-waveform-visualizer.git
   git push -u origin main
   ```

2. **Habilitar GitHub Pages**
   - Ve a tu repositorio en GitHub
   - Settings > Pages
   - En "Source", selecciona "Deploy from a branch"
   - En "Branch", selecciona `main` y `/root`
   - Guarda los cambios

3. **Acceder a tu aplicación**
   - Tu app estará disponible en: `https://TU-USUARIO.github.io/audio-waveform-visualizer/`

## Uso

1. **Cargar audio**: Haz clic en "Seleccionar MP3" y elige un archivo de audio
2. **Seleccionar formato**: Elige entre cuadrado (1080x1080) o vertical (1080x1350)
3. **Elegir waveform**: Selecciona uno de los cuatro tipos de visualización
4. **Configurar**: Ajusta los parámetros en la sección de configuración
5. **Reproducir**: Usa los controles de play/pause y el timeline
6. **Grabar**: Haz clic en el botón "Grabar" para exportar el video
   - El video se descargará automáticamente cuando termine la reproducción
   - Formato: WebM con codec VP9 y audio opus

## Estructura de archivos

```
audio-waveform-visualizer/
├── index.html          # Interfaz HTML
├── style.css           # Estilos de la aplicación
├── app.js              # Lógica principal y clases de waveforms
└── README.md           # Este archivo
```

## Tecnologías utilizadas

- **Three.js r128**: Renderizado 3D/2D con WebGL
- **Web Audio API**: Análisis de frecuencias en tiempo real
- **MediaRecorder API**: Captura y exportación de video
- **Canvas API**: Renderizado optimizado

## Optimizaciones

- Pixel ratio fijo (1) para output consistente
- FFT size de 512 para balance entre detalle y rendimiento
- 30 FPS para grabación de video
- RequestAnimationFrame para animaciones suaves
- Bitrate de 8Mbps para calidad de video óptima

## Configuraciones por waveform

### Slit-Scan Sphere
- Cantidad de capas horizontales
- Radio de la esfera
- Intensidad del efecto blur/motion
- Velocidad de animación
- Desplazamiento de color (hue shift)

### Liquid Blur
- Cantidad de blobs orgánicos
- Tamaño base de cada blob
- Fluidez de las deformaciones
- Brillo e intensidad de color
- Rango de variación cromática

### Particle Morph
- Cantidad de partículas (hasta 8000)
- Tamaño de las partículas
- Velocidad de morfing
- Intensidad de la deformación ondulante
- Velocidad del ciclo de color

### Echo Ripples
- Cantidad de ondas concéntricas
- Radio máximo de expansión
- Intensidad del efecto eco
- Velocidad de propagación
- Grosor de las líneas

## Navegadores compatibles

- Chrome/Edge (recomendado)
- Firefox
- Safari (con algunas limitaciones en grabación)

## Licencia

MIT License - Libre para uso personal y comercial

## Créditos

Desarrollado con Three.js y Web Audio API
