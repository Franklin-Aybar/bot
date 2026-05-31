const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const { Joki } = require('joki-music');
const express = require('express');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ── Servidor Express para Render (Evita el Port Timeout) ──
const app = express();
app.get('/', (req, res) => res.send('✅ Joki Music Engine Online'));
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

// ── Configuración de Joki 24/7 ──
const joki = new Joki(client, {
    leaveOnEmpty: false,     // No se sale si se van los usuarios
    leaveOnFinish: false,    // No se sale si se acaba la lista de canciones
    leaveOnStop: false,      // No se sale si detienen la música
    defaultVolume: 100
});

// ── Eventos de Audio de Joki ──
joki.on('trackStart', (player, track) => {
    const channel = client.channels.cache.get(player.textChannelId);
    if (channel) {
        channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setDescription(`🔊 **Reproduciendo ahora:** [${track.title}](${track.url})`)
                    .setThumbnail(track.thumbnail || null)
                    .setFooter({ text: `⏱ Duración: ${track.duration}  •  👤 Pedida por: ${track.requestedBy?.username || 'System'}` })
            ]
        });
    }
});

joki.on('queueEnd', (player) => {
    const channel = client.channels.cache.get(player.textChannelId);
    if (channel) {
        channel.send('🎵 **Cola terminada:** Modo 24/7 activo. Me quedo en el canal esperando más pistas.');
    }
});

joki.on('error', (player, error) => {
    console.error('[Joki Error]:', error);
});

// ── Lista de Comandos Slash ──
const commands = [
    {
        name: 'play',
        description: '🎵 Reproduce una canción o URL',
        options: [{ name: 'cancion', type: 3, description: 'Nombre o enlace', required: true }]
    },
    { name: 'skip',   description: '⏭ Salta a la siguiente canción' },
    { name: 'stop',   description: '⏹ Detiene la música y limpia la lista' },
    { name: 'queue',  description: '📋 Muestra la lista de reproducción' },
    { name: 'np',     description: '🎶 Muestra la canción actual' }
];

// ── Registro de Comandos en Discord ──
client.once('ready', async () => {
    console.log(`✅ Conectado exitosamente como ${client.user.tag}`);
    client.user.setActivity('Música Joki 🔊', { type: 2 });

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos de barra registrados globalmente');
    } catch (e) {
        console.error('Error registrando comandos:', e);
    }
});

// ── Manejador de Interacciones ──
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guildId, member, channel } = interaction;

    // Comando /play
    if (commandName === 'play') {
        const voiceChannel = member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '⚠️ Debes ingresar a un canal de voz primero.', ephemeral: true });
        }

        const query = interaction.options.getString('cancion');
        await interaction.deferReply();

        try {
            // Crea o recupera el reproductor en el servidor actual
            const player = joki.createPlayer({
                guildId: guildId,
                voiceChannelId: voiceChannel.id,
                textChannelId: channel.id,
                deaf: true
            });

            const result = await joki.search(query);
            if (!result || !result.tracks.length) {
                return interaction.editReply('❌ No se encontraron resultados válidos.');
            }

            if (result.type === 'PLAYLIST') {
                for (const track of result.tracks) {
                    track.requestedBy = interaction.user;
                    player.queue.push(track);
                }
                interaction.editReply(`📥 **Lista añadida:** \`${result.playlistName}\` con **${result.tracks.length}** canciones.`);
            } else {
                const track = result.tracks[0];
                track.requestedBy = interaction.user;
                player.queue.push(track);
                interaction.editReply(`➕ **Añadida:** \`${track.title}\``);
            }

            if (!player.playing) player.play();

        } catch (error) {
            console.error(error);
            interaction.editReply('❌ Ocurrió un error al intentar procesar el audio.');
        }
        return;
    }

    // Obtener reproductor activo
    const player = joki.players.get(guildId);

    if (commandName === 'skip') {
        if (!player || !player.playing) return interaction.reply({ content: '❌ No hay música reproduciéndose.', ephemeral: true });
        player.skip();
        return interaction.reply('⏭ **Pista saltada.**');
    }

    if (commandName === 'stop') {
        if (!player) return interaction.reply({ content: '❌ El bot no está activo.', ephemeral: true });
        player.destroy();
        return interaction.reply('🛑 **Reproducción detenida y cola vaciada.**');
    }

    if (commandName === 'queue') {
        if (!player || !player.queue.length) return interaction.reply({ content: '📭 La lista de reproducción está vacía.', ephemeral: true });
        
        let desc = player.current ? `▶️ **Sonando:** [${player.current.title}](${player.current.url})\n\n` : '';
        desc += player.queue.slice(0, 10).map((t, i) => `\`${i + 1}.\` [${t.title}](${t.url})`).join('\n');
        
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('📋 Lista de Espera')
                    .setDescription(desc)
            ]
        });
    }

    if (commandName === 'np') {
        if (!player || !player.current) return interaction.reply({ content: '❌ No hay nada sonando ahora.', ephemeral: true });
        
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('🎶 Sonando Ahora mismo')
                    .setDescription(`**[${player.current.title}](${player.current.url})**`)
                    .setThumbnail(player.current.thumbnail || null)
            ]
        });
    }
});

client.login(TOKEN);
