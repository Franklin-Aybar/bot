const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior,
} = require('@discordjs/voice');
const play = require('play-dl');

// ── Clase que representa la cola de un servidor ───────────────────────────────
class MusicQueue {
  constructor({ guildId, voiceChannel, textChannel, connection }) {
    this.guildId = guildId;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.connection = connection;
    this.songs = [];
    this.volume = 1;
    this.loop = false;  // 'off' | 'song' | 'queue'
    this.loopMode = 'off';
    this.playing = false;

    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });

    this.connection.subscribe(this.player);

    // Cuando termina una canción → siguiente
    this.player.on(AudioPlayerStatus.Idle, () => {
      this._onSongEnd();
    });

    this.player.on('error', err => {
      console.error('❌ Error en el player:', err.message);
      this._onSongEnd();
    });

    // Desconectar si la voz se destruye
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });
  }

  // Agrega canción(es) a la cola
  add(song) {
    this.songs.push(song);
  }

  // Reproduce la canción actual (índice 0)
  async play() {
    if (this.songs.length === 0) {
      this.destroy();
      return;
    }

    const song = this.songs[0];
    this.playing = true;

    try {
      let stream;

      if (song.source === 'spotify') {
        // Busca en YouTube el equivalente de Spotify
        const searched = await play.search(`${song.title} ${song.artist}`, { limit: 1 });
        if (!searched.length) throw new Error('No se encontró en YouTube');
        stream = await play.stream(searched[0].url, { quality: 2 });
      } else {
        stream = await play.stream(song.url, { quality: 2 });
      }

      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });
      resource.volume.setVolume(this.volume);

      this.player.play(resource);

      this.textChannel.send({
        embeds: [buildNowPlayingEmbed(song)],
      }).catch(() => {});

    } catch (err) {
      console.error('❌ Error reproduciendo:', err.message);
      this.textChannel.send(`❌ No pude reproducir **${song.title}**. Saltando...`).catch(() => {});
      this.songs.shift();
      this.play();
    }
  }

  _onSongEnd() {
    if (this.loopMode === 'song') {
      // Repite la misma canción
      this.play();
    } else if (this.loopMode === 'queue') {
      // Mueve la canción al final
      this.songs.push(this.songs.shift());
      this.play();
    } else {
      this.songs.shift();
      this.play();
    }
  }

  skip() {
    this.player.stop(true);
  }

  stop() {
    this.songs = [];
    this.player.stop(true);
    this.destroy();
  }

  setVolume(vol) {
    this.volume = vol / 100;
    if (this.player.state.resource) {
      this.player.state.resource.volume.setVolume(this.volume);
    }
  }

  pause() {
    this.player.pause();
  }

  resume() {
    this.player.unpause();
  }

  destroy() {
    this.playing = false;
    try { this.connection.destroy(); } catch {}
  }
}

// ── Embed "Now Playing" ───────────────────────────────────────────────────────
function buildNowPlayingEmbed(song) {
  const { EmbedBuilder } = require('discord.js');
  return new EmbedBuilder()
    .setColor(0xc43646)
    .setTitle('🎵 Reproduciendo ahora')
    .setDescription(`**[${song.title}](${song.url || 'https://discord.com'})**`)
    .addFields(
      { name: '👤 Artista', value: song.artist || 'Desconocido', inline: true },
      { name: '⏱ Duración', value: song.duration || '?', inline: true },
      { name: '📥 Pedido por', value: song.requestedBy || 'Desconocido', inline: true },
    )
    .setThumbnail(song.thumbnail || null)
    .setFooter({ text: 'Chipeo Music Bot 🎶' });
}

module.exports = { MusicQueue, buildNowPlayingEmbed };
