# 🎵 Chipeo Music Bot

Bot de música para Discord con soporte de **YouTube** y **Spotify**.

---

## 🚀 Instalación

### 1. Instalar dependencias

```bash
npm install
```

> **Requisito:** Tener [Node.js 18+](https://nodejs.org) instalado.
> En Linux/Mac también necesitas `ffmpeg` instalado en el sistema:
> ```bash
> # Ubuntu/Debian
> sudo apt install ffmpeg
>
> # Mac
> brew install ffmpeg
> ```

---

### 2. Configurar el archivo `.env`

Copia el archivo de ejemplo y rellénalo:

```bash
cp .env.example .env
```

Abre `.env` y completa:

| Variable | Cómo obtenerla |
|---|---|
| `DISCORD_TOKEN` | [discord.com/developers/applications](https://discord.com/developers/applications) → Tu app → Bot → Token |
| `GUILD_ID` | Click derecho en tu servidor → "Copiar ID" (activa Modo Desarrollador en Ajustes) |
| `SPOTIFY_CLIENT_ID` | [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → Crea una app |
| `SPOTIFY_CLIENT_SECRET` | Misma página de Spotify |

---

### 3. Invitar el bot a tu servidor

En el [Portal de Desarrolladores](https://discord.com/developers/applications):
1. Ve a tu app → **OAuth2** → **URL Generator**
2. Marca los scopes: `bot`, `applications.commands`
3. Permisos del bot: `Connect`, `Speak`, `Send Messages`, `Embed Links`, `Read Message History`
4. Copia la URL generada y ábrela en el navegador

---

### 4. Ejecutar el bot

```bash
# Producción
npm start

# Desarrollo (reinicio automático)
npm run dev
```

---

## 🎮 Comandos

| Comando | Descripción |
|---|---|
| `/play <canción>` | Reproduce por nombre, URL de YouTube o URL de Spotify |
| `/skip` | Salta la canción actual |
| `/stop` | Detiene la música y desconecta el bot |
| `/pause` | Pausa la reproducción |
| `/resume` | Reanuda la reproducción |
| `/queue` | Muestra la cola de canciones |
| `/nowplaying` | Muestra la canción actual |
| `/volume <0-150>` | Ajusta el volumen |
| `/loop <off/song/queue>` | Cambia el modo de repetición |
| `/shuffle` | Mezcla la cola aleatoriamente |

### Ejemplos de uso de `/play`

```
/play Bad Bunny Tití me preguntó
/play https://www.youtube.com/watch?v=dQw4w9WgXcQ
/play https://open.spotify.com/track/...
/play https://open.spotify.com/playlist/...
/play https://open.spotify.com/album/...
```

---

## 📁 Estructura del proyecto

```
chipeo-bot/
├── index.js              # Entrada principal
├── .env                  # Variables de entorno (no subir a GitHub!)
├── .env.example          # Plantilla de variables
├── package.json
├── commands/
│   └── music/
│       ├── play.js       # Comando principal de reproducción
│       ├── skip.js
│       ├── stop.js
│       ├── pause.js
│       ├── resume.js
│       ├── queue.js
│       ├── nowplaying.js
│       ├── volume.js
│       ├── loop.js
│       ├── shuffle.js
│       └── controls.js   # Lógica de todos los controles
├── events/
│   ├── ready.js
│   └── error.js
└── utils/
    ├── MusicQueue.js     # Clase de gestión de cola
    └── spotify.js        # Helper de Spotify API
```

---

## 🔧 Solución de problemas

**El bot no se une al canal de voz**
→ Verifica que el bot tenga permisos `Connect` y `Speak` en ese canal.

**Error de Opus / FFmpeg**
→ Instala `@discordjs/opus` manualmente: `npm install @discordjs/opus`
→ En Windows, puede que necesites: `npm install --build-from-source`

**Los slash commands no aparecen**
→ Asegúrate de tener `GUILD_ID` en tu `.env` para que se registren instantáneamente.
→ Sin GUILD_ID, los comandos globales pueden tardar hasta 1 hora en aparecer.

**Error de Spotify**
→ Verifica que el `SPOTIFY_CLIENT_ID` y `SPOTIFY_CLIENT_SECRET` sean correctos.
→ Asegúrate de haber creado la app en [developer.spotify.com](https://developer.spotify.com/dashboard).
