const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ── Helper: verificar que hay cola activa ─────────────────────────────────────
function getQueue(interaction, client) {
  const queue = client.queues.get(interaction.guildId);
  if (!queue || !queue.songs.length) {
    interaction.reply({ content: '❌ No hay música reproduciéndose ahora mismo.', ephemeral: true });
    return null;
  }
  return queue;
}

// ─────────────────────────────────────────────────────────────────────────────
// /skip
// ─────────────────────────────────────────────────────────────────────────────
const skip = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('⏭ Salta a la siguiente canción'),

  async execute(interaction, client) {
    const queue = getQueue(interaction, client);
    if (!queue) return;

    const skipped = queue.songs[0]?.title || 'Canción actual';
    queue.skip();
    interaction.reply(`⏭ Saltando **${skipped}**...`);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// /stop
// ─────────────────────────────────────────────────────────────────────────────
const stop = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('⏹ Detiene la música y desconecta el bot'),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue) return interaction.reply({ content: '❌ No hay música activa.', ephemeral: true });

    queue.stop();
    client.queues.delete(interaction.guildId);
    interaction.reply('⏹ Música detenida. ¡Hasta luego!');
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// /pause
// ─────────────────────────────────────────────────────────────────────────────
const pause = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('⏸ Pausa la reproducción'),

  async execute(interaction, client) {
    const queue = getQueue(interaction, client);
    if (!queue) return;

    queue.pause();
    interaction.reply('⏸ Música pausada. Usa **/resume** para continuar.');
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// /resume
// ─────────────────────────────────────────────────────────────────────────────
const resume = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('▶️ Reanuda la reproducción'),

  async execute(interaction, client) {
    const queue = getQueue(interaction, client);
    if (!queue) return;

    queue.resume();
    interaction.reply('▶️ ¡Música reanudada!');
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// /queue
// ─────────────────────────────────────────────────────────────────────────────
const queue = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('📋 Muestra la cola de reproducción')
    .addIntegerOption(opt =>
      opt.setName('pagina')
        .setDescription('Página de la cola')
        .setMinValue(1)
    ),

  async execute(interaction, client) {
    const q = client.queues.get(interaction.guildId);
    if (!q || !q.songs.length) {
      return interaction.reply({ content: '❌ La cola está vacía.', ephemeral: true });
    }

    const page = (interaction.options.getInteger('pagina') || 1) - 1;
    const pageSize = 10;
    const totalPages = Math.ceil(q.songs.length / pageSize);
    const start = page * pageSize;
    const songs = q.songs.slice(start, start + pageSize);

    const list = songs.map((s, i) => {
      const num = start + i + 1;
      const prefix = num === 1 ? '🎵 **Ahora:**' : `${num}.`;
      return `${prefix} ${s.title} — \`${s.duration || '?'}\``;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xc43646)
      .setTitle(`📋 Cola de reproducción — ${q.songs.length} canción(es)`)
      .setDescription(list)
      .setFooter({ text: `Página ${page + 1}/${totalPages} • Loop: ${q.loopMode}` });

    interaction.reply({ embeds: [embed] });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// /nowplaying
// ─────────────────────────────────────────────────────────────────────────────
const nowplaying = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('🎵 Muestra la canción que suena ahora'),

  async execute(interaction, client) {
    const q = getQueue(interaction, client);
    if (!q) return;

    const song = q.songs[0];
    const embed = new EmbedBuilder()
      .setColor(0xc43646)
      .setTitle('🎵 Reproduciendo ahora')
      .setDescription(`**${song.title}**`)
      .addFields(
        { name: '👤 Artista', value: song.artist || 'Desconocido', inline: true },
        { name: '⏱ Duración', value: song.duration || '?', inline: true },
        { name: '🔁 Loop', value: q.loopMode, inline: true },
        { name: '📥 Pedido por', value: song.requestedBy || '?', inline: true },
      )
      .setThumbnail(song.thumbnail || null)
      .setFooter({ text: `${q.songs.length} canción(es) en cola` });

    interaction.reply({ embeds: [embed] });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// /volume
// ─────────────────────────────────────────────────────────────────────────────
const volume = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('🔊 Ajusta el volumen (0–150)')
    .addIntegerOption(opt =>
      opt.setName('nivel')
        .setDescription('Volumen entre 0 y 150')
        .setMinValue(0)
        .setMaxValue(150)
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const q = getQueue(interaction, client);
    if (!q) return;

    const level = interaction.options.getInteger('nivel');
    q.setVolume(level);
    interaction.reply(`🔊 Volumen ajustado a **${level}%**`);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// /loop
// ─────────────────────────────────────────────────────────────────────────────
const loop = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('🔁 Cambia el modo de repetición')
    .addStringOption(opt =>
      opt.setName('modo')
        .setDescription('Modo de loop')
        .setRequired(true)
        .addChoices(
          { name: '❌ Off', value: 'off' },
          { name: '🔂 Canción', value: 'song' },
          { name: '🔁 Cola', value: 'queue' },
        )
    ),

  async execute(interaction, client) {
    const q = getQueue(interaction, client);
    if (!q) return;

    q.loopMode = interaction.options.getString('modo');

    const messages = {
      off: '❌ Loop desactivado.',
      song: '🔂 Repitiendo la canción actual.',
      queue: '🔁 Repitiendo toda la cola.',
    };

    interaction.reply(messages[q.loopMode]);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// /shuffle
// ─────────────────────────────────────────────────────────────────────────────
const shuffle = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('🔀 Mezcla la cola aleatoriamente'),

  async execute(interaction, client) {
    const q = getQueue(interaction, client);
    if (!q) return;

    if (q.songs.length < 2) return interaction.reply({ content: '❌ No hay suficientes canciones para mezclar.', ephemeral: true });

    // Mantén la canción actual (índice 0) y mezcla el resto
    const current = q.songs.shift();
    q.songs.sort(() => Math.random() - 0.5);
    q.songs.unshift(current);

    interaction.reply(`🔀 Cola mezclada — ${q.songs.length} canciones`);
  },
};

module.exports = { skip, stop, pause, resume, queue, nowplaying, volume, loop, shuffle };
