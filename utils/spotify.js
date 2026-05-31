const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

let tokenExpiry = 0;

// Renueva el token automáticamente
async function ensureToken() {
  if (Date.now() < tokenExpiry) return;
  const data = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(data.body['access_token']);
  tokenExpiry = Date.now() + data.body['expires_in'] * 1000 - 60_000;
}

// Detecta si una URL es de Spotify y de qué tipo
function detectSpotifyType(url) {
  if (!url.includes('spotify.com')) return null;
  if (url.includes('/track/')) return 'track';
  if (url.includes('/playlist/')) return 'playlist';
  if (url.includes('/album/')) return 'album';
  return null;
}

// Extrae el ID de la URL
function extractId(url) {
  const match = url.match(/spotify\.com\/(?:intl-[a-z]+\/)?(?:track|playlist|album)\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// Formatea duración en ms → "3:45"
function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Convierte un track de Spotify a objeto canción
function trackToSong(track, requestedBy) {
  return {
    title: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    duration: formatDuration(track.duration_ms),
    thumbnail: track.album?.images?.[0]?.url || null,
    url: track.external_urls?.spotify || '',
    source: 'spotify',
    requestedBy,
  };
}

// ── Funciones públicas ─────────────────────────────────────────────────────────

async function getTrack(url, requestedBy) {
  await ensureToken();
  const id = extractId(url);
  const { body } = await spotifyApi.getTrack(id);
  return [trackToSong(body, requestedBy)];
}

async function getPlaylist(url, requestedBy) {
  await ensureToken();
  const id = extractId(url);
  const songs = [];
  let offset = 0;
  let total = 1;

  while (offset < total && offset < 100) { // máximo 100 canciones
    const { body } = await spotifyApi.getPlaylistTracks(id, { offset, limit: 50 });
    total = body.total;
    for (const item of body.items) {
      if (item.track) songs.push(trackToSong(item.track, requestedBy));
    }
    offset += 50;
  }
  return songs;
}

async function getAlbum(url, requestedBy) {
  await ensureToken();
  const id = extractId(url);
  const { body } = await spotifyApi.getAlbum(id);
  return body.tracks.items.map(t => ({
    title: t.name,
    artist: t.artists.map(a => a.name).join(', '),
    duration: formatDuration(t.duration_ms),
    thumbnail: body.images?.[0]?.url || null,
    url: t.external_urls?.spotify || '',
    source: 'spotify',
    requestedBy,
  }));
}

module.exports = { detectSpotifyType, getTrack, getPlaylist, getAlbum };
