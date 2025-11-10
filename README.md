# Audio Waveform Visualizer

Aplicación web para crear visualizaciones de audio reactivas con Four.js, optimizada para GitHub Pages.

## Características

- 🎵 Carga archivos MP3 y genera waveforms reactivos
- 🎨 Cuatro tipos de visualización:
  - **Circular Multicolor**: Anillo que reacciona al audio con colores del arcoíris
  - **Barra Horizontal**: Barras verticales estilo ecualizador
  - **Psicodélica**: Partículas en espiral con efectos aditivos
  - **Multicolor Degradado Brillante**: Onda con gradiente cyan-magenta brillante
- ⚙️ Controles configurables para cada tipo de waveform
- 📐 Dos formatos de salida: 1080x1080px (cuadrado) y 1080x1350px (vertical)
- 🎬 Grabación automática a video WebM con audio sincronizado
- ▶️ Controles de reproducción completos (play, pause, timeline)
- ⚡ Optimizado para rendimiento del navegador

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

### Circular Multicolor
- Radio del círculo
- Número de segmentos
- Grosor de línea
- Intensidad de reacción

### Barra Horizontal
- Cantidad de barras
- Ancho de barra
- Altura máxima
- Espaciado
- Color base

### Psicodélica
- Cantidad de partículas
- Tamaño de partículas
- Velocidad de rotación
- Expansión/spread

### Multicolor Degradado
- Número de segmentos
- Amplitud máxima
- Suavidad de la onda
- Brillo general

## Navegadores compatibles

- Chrome/Edge (recomendado)
- Firefox
- Safari (con algunas limitaciones en grabación)

## Licencia

MIT License - Libre para uso personal y comercial

## Créditos

Desarrollado con Three.js y Web Audio API
