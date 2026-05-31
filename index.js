const { Client, GatewayIntentBits } = require('discord.js');
const { Connectors } = require('shoukaku');
const { Kazagumo } = require('kazagumo');

// Configuración del cliente con los Intents necesarios para canales de voz y mensajes
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Nodos Lavalink públicos estables de respaldo para streaming continuo sin lag
const Nodes = [
    {
        name: 'Node-Primary',
        url: 'lavalink.iquis.top:443',
        auth: 'lavalink',
        secure: true
    },
    {
        name: 'Node-Secondary',
        url: 'lavalink.juice-host.xyz:443',
        auth: 'youshallnotpass',
        secure: true
    }
];

// Inicialización de Kazagumo para la abstracción de audio
const kazagumo = new Kazagumo({
    plugins: [],
    defaultSearchEngine: 'youtube'
}, new Connectors.DiscordJS(client), Nodes);

// Confirmación de inicio del bot
client.on('ready', () => {
    console.log(`[BOT] Conectado exitosamente como: ${client.user.tag}`);
    client.user.setActivity('Música 24/7 🔊', { type: 2 });
});

// Manejo de eventos de reproducción de audio
kazagumo.on('playerStart', (player, track) => {
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
        channel.send(`🔊 **Reproduciendo ahora:** \`${track.title}\` - Pedida en el canal.`);
    }
});

// Sistema Mantenimiento 24/7 - Evita que el bot abandone el canal al terminar la lista
kazagumo.on('queueEnd', (player) => {
    // No hacemos nada para que el reproductor se mantenga conectado permanentemente
});

kazagumo.on('playerError', (player, error) => {
    console.error(`[Lavalink Error] En el reproductor del servidor ${player.guildId}:`, error);
});

// Manejador de comandos basados en prefijo clásico
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const args = message.content.split(/ +/);
    const command = args.shift().toLowerCase();

    // COMANDO !PLAY
    if (command === '!play') {
        const query = args.join(' ');
        if (!query) return message.reply('❌ Especifica el nombre o URL de la pista.');

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Necesitas ingresar a un canal de voz primero.');

        try {
            const result = await kazagumo.search(query);
            if (!result.tracks.length) return message.reply('❌ No se encontraron resultados válidos.');

            // Crear o recuperar la instancia del reproductor de voz en el servidor
            const player = await kazagumo.createPlayer({
                guildId: message.guild.id,
                textId: message.channel.id,
                voiceId: voiceChannel.id,
                deaf: true
            });

            if (result.type === 'PLAYLIST') {
                for (const track of result.tracks) {
                    player.queue.add(track);
                }
                message.reply(`📥 **Lista añadida:** \`${result.playlistName}\` con **${result.tracks.length}** pistas.`);
            } else {
                player.queue.add(result.tracks[0]);
                message.reply(`➕ **Añadida a la cola:** \`${result.tracks[0].title}\``);
            }

            if (!player.playing && !player.paused) player.play();

        } catch (error) {
            console.error(error);
            message.reply('❌ Error interno al procesar el audio del nodo.');
        }
    }

    // COMANDO !SKIP
    if (command === '!skip') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply('❌ No hay audio reproduciéndose en este momento.');
        player.skip();
        return message.reply('⏭️ **Pista saltada.** Enrutando siguiente canción.');
    }

    // COMANDO !STOP
    if (command === '!stop') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply('❌ El bot no se encuentra activo en ningún canal.');
        player.destroy();
        return message.reply('🛑 **Desconectado:** Se limpió la cola y el bot abandonó el canal.');
    }

    // COMANDO !QUEUE
    if (command === '!queue') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player || !player.queue.length) return message.reply('📭 La cola de reproducción está vacía.');
        
        const current = player.queue.current ? `▶️ **Sonando:** ${player.queue.current.title}\n\n` : '';
        const tracks = player.queue.slice(0, 10).map((t, i) => `**${i + 1}.** \`${t.title}\``).join('\n');
        
        return message.reply(`${current}📋 **Próximas pistas:**\n${tracks}${player.queue.length > 10 ? `\n... y ${player.queue.length - 10} más.` : ''}`);
    }
});

// Autenticación del cliente
const TOKEN = process.env.DISCORD_TOKEN || 'MTQzMzYyNTMxMTM599kwNzM0OA.GowTEI.fHueMMYQB1CNkUNWhaeGa4Tk-AE75ROx2Do_PE';
client.login(TOKEN);
