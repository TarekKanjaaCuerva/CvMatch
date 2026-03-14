# CVMatch — Guía de despliegue en Vercel

## Estructura del proyecto

```
cvmatch/
├── api/
│   └── analyze.js       ← Función serverless (backend seguro)
├── public/
│   └── index.html       ← Frontend completo
├── vercel.json          ← Configuración de Vercel
└── README.md
```

## Paso a paso para publicar

### 1. Consigue tu API Key de Anthropic
- Ve a https://console.anthropic.com
- Regístrate o inicia sesión
- Ve a "API Keys" → "Create Key"
- Copia la key (empieza por `sk-ant-...`)

### 2. Sube el proyecto a GitHub
- Ve a https://github.com y crea una cuenta si no tienes
- Haz clic en "New repository" → Ponle nombre: `cvmatch`
- Sube los archivos (puedes arrastrarlos directamente en la web de GitHub)

### 3. Despliega en Vercel
- Ve a https://vercel.com y regístrate con tu cuenta de GitHub
- Haz clic en "Add New Project"
- Selecciona el repositorio `cvmatch`
- Haz clic en "Deploy" (Vercel detecta la configuración automáticamente)

### 4. Añade la API Key como variable de entorno
- En Vercel, ve a tu proyecto → "Settings" → "Environment Variables"
- Añade:
  - **Name:** `ANTHROPIC_API_KEY`
  - **Value:** tu key `sk-ant-...`
- Haz clic en "Save"
- Ve a "Deployments" → haz clic en los tres puntos del último deploy → "Redeploy"

### 5. ¡Listo!
Tu web estará en `https://cvmatch.vercel.app` (o el nombre que Vercel le asigne).
Puedes configurar un dominio propio desde Settings → Domains.

## Costes estimados

- **Vercel:** Gratis (plan hobby)
- **Anthropic API:** ~0.003€ por análisis (muy barato)
- Con 1.000 análisis/mes → ~3€ de coste de API

## Para monetizar con Google AdSense

1. Ve a https://adsense.google.com y solicita acceso
2. Una vez aprobado, pega el snippet de AdSense en el `<head>` del index.html
3. Los nichos de empleo pagan entre 0.5€ y 2€ por click
