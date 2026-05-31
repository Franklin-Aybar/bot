const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const { DisTube } = require('distube');
const { YouTubePlugin } = require('@distube/youtube');
const express = require('express');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ── Servidor Express para Render (Evita el Port Timeout) ──
const app = express();
app.get('/', (req, res) => res.send('✅ Engine Online'));
app.listen(process.env.PORT || 3000, () => console.log('✅ Servidor HTTP iniciado'));

// ── Cliente de Discord ──
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ── Configuración DisTube 24/7 Total ──
const distube = new DisTube(client, {
    emitNewSongOnly: false,
    leaveOnEmpty: false,     // 24/7: No se sale si el canal se queda vacío
    leaveOnFinish: false,    // 24/7: No se sale si termina la cola de canciones
    leaveOnStop: false,      // 24/7: No se sale si detienen la música con comandos
    plugins: [new YouTubePlugin()]
});

// ── Eventos de Audio ──
distube.on('playSong', (queue, song) => {
    queue.textChannel?.send({
        embeds: [
            new EmbedBuilder()
                .setColor('#2ECC71')
                .setDescription(`🔊 **Reproduciendo ahora:** [${song.name}](${song.url})`)
                .setThumbnail(song.thumbnail ?? null)
                .setFooter({ text: `⏱ Duración: ${song.formattedDuration ?? '?'}  •  👤 Pedida por: ${song.user?.username ?? 'Desconocido'}` })
        ]
    });
});

distube.on('addSong', (queue, song) => {
    queue.textChannel?.send({
        embeds: [
            new EmbedBuilder()
                .setColor('#3498DB')
                .setDescription(`📋 **Añadida a la cola:** [${song.name}](${song.url})`)
                .setThumbnail(song.thumbnail ?? null)
                .setFooter({ text: `⏱ Lista posición: #${queue.songs.length}` })
        ]
    });
});

distube.on('finish', queue => {
    queue.textChannel?.send('🎵 **Cola terminada:** Modo 24/7 activo. Me quedo en el canal de voz esperando más pistas.');
});

distube.on('error', (error, queue) => {
    console.error('[DisTube Error]', error.message);
});

// ── Comandos Slash ──
const commands = [
    {
        name: 'play',
        description: '🎵 Reproduce una canción o URL',
        options: [{ name: 'cancion', type: 3, description: 'Nombre o enlace', required: true }]
    },
    { name: 'skip',   description: '⏭ Salta la canción actual' },
    { name: 'stop',   description: '⏹ Detiene la música y limpia la lista' },
    { name: 'queue',  description: '📋 Muestra la lista de reproducción' },
    { name: 'np',     description: '🎶 Muestra qué está sonando' }
];

// ── Conexión y Registro ──
client.once('ready', async () => {
    console.log(`✅ Conectado como ${client.user.tag}`);
    client.user.setActivity('Música Chipeo 🔊', { type: 2 });

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos de barra registrados globalmente');
    } catch (e) {
        console.error(e);
    }
});

// ── Manejador de Comandos Slash ──
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guildId, member, channel } = interaction;

    if (commandName === 'play') {
        const voiceChannel = member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '⚠️ Entra a un canal de voz primero.', ephemeral: true });
        }

        const query = interaction.options.getString('cancion');
        await interaction.deferReply();

        try {
            await distube.play(voiceChannel, query, {
                member,
                textChannel: channel,
            });
            await interaction.editReply('🎵 ¡Procesando pista!');
        } catch (e) {
            console.error(e);
            await interaction.editReply('❌ No se pudo reproducir el audio.');
        }
        return;
    }

    const queue = distube.getQueue(guildId);

    if (commandName === 'skip') {
        if (!queue) return interaction.reply({ content: '❌ No hay música activa.', ephemeral: true });
        try {
            await queue.skip();
            return interaction.reply('⏭ **Pista saltada.**');
        } catch (e) {
            return interaction.reply({ content: '❌ No hay más pistas en la cola.', ephemeral: true });
        }
    }

    if (commandName === 'stop') {
        if (!queue) return interaction.reply({ content: '❌ No hay música activa.', ephemeral: true });
        await queue.stop();
        return interaction.reply('⏹ **Lista limpia y reproducción detenida.**');
    }

    if (commandName === 'queue') {
        if (!queue || !queue.songs.length) return interaction.reply({ content: '📭 La cola está vacía.', ephemeral: true });
        const songs = queue.songs;
        let desc = `▶️ **Sonando:** [${songs[0].name}](${songs[0].url})\n\n`;
        desc += songs.slice(1, 11).map((s, i) => `\`${i + 1}.\` [${s.name}](${s.url})`).join('\n');
        return interaction.reply({
            embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('📋 Lista de Espera').setDescription(desc)]
        });
    }

    if (commandName === 'np') {
        if (!queue || !queue.songs.length) return interaction.reply({ content: '❌ No hay nada sonando.', ephemeral: true });
        return interaction.reply({
            embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🎶 Sonando Ahora').setDescription(`**[${queue.songs[0].name}](${queue.songs[0].url})**`)]
        });
    }
});

client.login(TOKEN);
