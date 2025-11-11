# Guía de Deployment y Optimización

## Deployment rápido en GitHub Pages

### Opción 1: Crear repositorio nuevo

```bash
# 1. Inicializar Git
git init

# 2. Agregar archivos
git add .
git commit -m "Audio Waveform Visualizer - Initial commit"

# 3. Crear repositorio en GitHub y conectarlo
git branch -M main
git remote add origin https://github.com/TU-USUARIO/audio-waveform-visualizer.git
git push -u origin main
```

### Opción 2: Usar gh-pages (alternativa)

```bash
# Instalar gh-pages si quieres usar una rama separada
npm install -g gh-pages

# Publicar directamente
gh-pages -d .
```

## Configuración de GitHub Pages

1. Ve a tu repositorio en GitHub
2. **Settings** → **Pages**
3. Source: **Deploy from a branch**
4. Branch: **main** → **/ (root)**
5. Click **Save**

Tu sitio estará disponible en: `https://TU-USUARIO.github.io/NOMBRE-REPO/`

## Optimizaciones adicionales

### 1. Usar un dominio personalizado (opcional)

En Settings → Pages → Custom domain, puedes agregar tu propio dominio.

Crea un archivo `CNAME` en la raíz con tu dominio:
```
tudominio.com
```

### 2. Comprimir assets para producción

Si quieres optimizar aún más, puedes minificar el JavaScript:

```bash
# Instalar uglify-js
npm install -g uglify-js

# Minificar app.js
uglifyjs app.js -o app.min.js -c -m

# Actualizar index.html para usar app.min.js
```

### 3. Service Worker para PWA (opcional)

Para hacer la app instalable, crea un archivo `sw.js`:

```javascript
const CACHE_NAME = 'waveform-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

Y agregar al `index.html`:

```html
<link rel="manifest" href="manifest.json">
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
</script>
```

### 4. Manifest.json para PWA

```json
{
  "name": "Audio Waveform Visualizer",
  "short_name": "Waveform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#667eea",
  "theme_color": "#667eea",
  "description": "Crea visualizaciones de audio reactivas",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

## Tips de rendimiento

### Para grabación de alta calidad:

1. **Aumentar bitrate**:
   ```javascript
   videoBitsPerSecond: 12000000 // 12 Mbps
   ```

2. **Cambiar FPS**:
   ```javascript
   const canvasStream = this.canvas.captureStream(60); // 60 FPS
   ```

3. **Usar codec H264** (si está disponible):
   ```javascript
   mimeType: 'video/webm;codecs=h264,opus'
   ```

### Para mejor análisis de audio:

1. **Aumentar FFT size**:
   ```javascript
   this.analyser.fftSize = 2048; // Más detalle, más procesamiento
   ```

2. **Ajustar smoothing**:
   ```javascript
   this.analyser.smoothingTimeConstant = 0.8; // 0 a 1
   ```

## Troubleshooting común

### El audio no se reproduce
- Verifica que el navegador tenga permisos de audio
- Algunos navegadores requieren interacción del usuario primero
- Prueba en modo HTTPS (GitHub Pages lo hace automáticamente)

### La grabación no funciona
- Safari tiene soporte limitado de MediaRecorder
- Usa Chrome/Firefox para mejores resultados
- Verifica que el codec 'vp9' esté disponible

### Rendimiento lento
- Reduce el número de partículas/segmentos
- Baja el FFT size a 256
- Reduce los FPS de grabación a 24

### El canvas se ve pixelado
- Verifica que el pixelRatio esté en 1
- Asegúrate de que las dimensiones del canvas sean correctas
- Desactiva antialiasing si hay problemas:
  ```javascript
  antialias: false
  ```

## Mejoras futuras sugeridas

1. **Más tipos de waveforms**:
   - Espectrograma 3D
   - Ondas de Lissajous
   - Visualización de forma de onda tradicional

2. **Efectos adicionales**:
   - Post-processing con shaders GLSL
   - Blur y bloom effects
   - Color grading

3. **Export options**:
   - MP4 además de WebM
   - GIF animado
   - Secuencia de PNG

4. **Presets**:
   - Guardar/cargar configuraciones
   - Biblioteca de presets pre-configurados

5. **Interactividad**:
   - Control por MIDI
   - Respuesta a micrófono en tiempo real
   - Integración con Spotify API

## Recursos adicionales

- [Three.js Documentation](https://threejs.org/docs/)
- [Web Audio API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)

## Contacto y contribuciones

Si encuentras bugs o quieres contribuir mejoras, abre un issue o pull request en el repositorio.

¡Disfruta creando visualizaciones! 🎵🎨
