const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const play = require('play-dl');
const { MusicQueue } = require('../../utils/MusicQueue');
const { detectSpotifyType, getTrack, getPlaylist, getAlbum } = require('../../utils/spotify');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('🎵 Reproduce música de YouTube o Spotify')
    .addStringOption(opt =>
      opt.setName('cancion')
        .setDescription('Nombre, URL de YouTube o URL de Spotify')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const input = interaction.options.getString('cancion');
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    // Verificar que el usuario esté en un canal de voz
    if (!voiceChannel) {
      return interaction.editReply('❌ Debes estar en un canal de voz primero!');
    }

    // Verificar permisos del bot
    const perms = voiceChannel.permissionsFor(interaction.client.user);
    if (!perms.has('Connect') || !perms.has('Speak')) {
      return interaction.editReply('❌ No tengo permisos para unirme a tu canal de voz!');
    }

    const guildId = interaction.guildId;
    let queue = client.queues.get(guildId);

    // Conectar al canal de voz si no hay conexión
    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      queue = new MusicQueue({
        guildId,
        voiceChannel,
        textChannel: interaction.channel,
        connection,
      });

      client.queues.set(guildId, queue);

      // Limpiar la cola cuando el bot se desconecte
      connection.on('stateChange', (_, newState) => {
        if (newState.status === 'destroyed') {
          client.queues.delete(guildId);
        }
      });
    }

    const requestedBy = member.user.username;

    try {
      // ── Spotify ────────────────────────────────────────────────────────────
      const spotifyType = detectSpotifyType(input);

      if (spotifyType) {
        let songs = [];

        if (spotifyType === 'track') {
          songs = await getTrack(input, requestedBy);
        } else if (spotifyType === 'playlist') {
          songs = await getPlaylist(input, requestedBy);
        } else if (spotifyType === 'album') {
          songs = await getAlbum(input, requestedBy);
        }

        if (!songs.length) return interaction.editReply('❌ No encontré canciones en ese enlace de Spotify.');

        songs.forEach(s => queue.add(s));

        if (songs.length === 1) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x1db954)
                .setTitle('✅ Añadido a la cola')
                .setDescription(`**${songs[0].title}** — ${songs[0].artist}`)
                .setThumbnail(songs[0].thumbnail)
                .setFooter({ text: `Pedido por ${requestedBy}` }),
            ],
          });
        } else {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x1db954)
                .setTitle(`✅ ${songs.length} canciones añadidas`)
                .setDescription(songs.slice(0, 10).map((s, i) => `${i + 1}. ${s.title} — ${s.artist}`).join('\n') + (songs.length > 10 ? `\n...y ${songs.length - 10} más` : ''))
                .setFooter({ text: `Pedido por ${requestedBy}` }),
            ],
          });
        }

        if (!queue.playing) queue.play();
        return;
      }

      // ── YouTube URL ────────────────────────────────────────────────────────
      const ytValidate = play.yt_validate(input);

      if (ytValidate === 'video') {
        const info = await play.video_info(input);
        const details = info.video_details;

        const song = {
          title: details.title,
          artist: details.channel?.name || 'Desconocido',
          duration: formatSeconds(details.durationInSec),
          thumbnail: details.thumbnails?.[0]?.url || null,
          url: details.url,
          source: 'youtube',
          requestedBy,
        };

        queue.add(song);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('✅ Añadido a la cola')
              .setDescription(`**[${song.title}](${song.url})**`)
              .addFields({ name: '⏱', value: song.duration, inline: true })
              .setThumbnail(song.thumbnail)
              .setFooter({ text: `Pedido por ${requestedBy}` }),
          ],
        });

        if (!queue.playing) queue.play();
        return;
      }

      if (ytValidate === 'playlist') {
        const playlist = await play.playlist_info(input, { incomplete: true });
        const videos = await playlist.all_videos();

        const songs = videos.map(v => ({
          title: v.title,
          artist: v.channel?.name || 'Desconocido',
          duration: formatSeconds(v.durationInSec),
          thumbnail: v.thumbnails?.[0]?.url || null,
          url: v.url,
          source: 'youtube',
          requestedBy,
        }));

        songs.forEach(s => queue.add(s));
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle(`✅ Playlist añadida — ${songs.length} canciones`)
              .setDescription(`**${playlist.title}**`)
              .setFooter({ text: `Pedido por ${requestedBy}` }),
          ],
        });

        if (!queue.playing) queue.play();
        return;
      }

      // ── Búsqueda por nombre ────────────────────────────────────────────────
      const results = await play.search(input, { limit: 1, source: { youtube: 'video' } });
      if (!results.length) return interaction.editReply('❌ No encontré nada con esa búsqueda.');

      const video = results[0];
      const song = {
        title: video.title,
        artist: video.channel?.name || 'Desconocido',
        duration: formatSeconds(video.durationInSec),
        thumbnail: video.thumbnails?.[0]?.url || null,
        url: video.url,
        source: 'youtube',
        requestedBy,
      };

      queue.add(song);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xc43646)
            .setTitle('✅ Añadido a la cola')
            .setDescription(`**[${song.title}](${song.url})**`)
            .addFields(
              { name: '👤 Canal', value: song.artist, inline: true },
              { name: '⏱ Duración', value: song.duration, inline: true },
            )
            .setThumbnail(song.thumbnail)
            .setFooter({ text: `Pedido por ${requestedBy}` }),
        ],
      });

      if (!queue.playing) queue.play();

    } catch (err) {
      console.error('❌ /play error:', err);
      interaction.editReply('❌ Ocurrió un error buscando esa canción. Intenta de nuevo.');
    }
  },
};

function formatSeconds(sec) {
  if (!sec) return '?';
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
