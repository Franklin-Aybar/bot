require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ── Cliente ──────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ── Colecciones ───────────────────────────────────────────────────────────────
client.commands = new Collection();
client.queues = new Map(); // queue por servidor

// ── Cargar comandos ───────────────────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);
const slashCommands = [];

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(folderPath, file));
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      slashCommands.push(command.data.toJSON());
    }
  }
}

// ── Cargar eventos ────────────────────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// ── Registrar slash commands ──────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} está online!`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('🔄 Registrando slash commands...');

    // Registra en el servidor específico (instantáneo) o global (hasta 1h)
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
        { body: slashCommands }
      );
      console.log(`✅ Slash commands registrados en el servidor!`);
    } else {
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: slashCommands }
      );
      console.log('✅ Slash commands registrados globalmente!');
    }
  } catch (err) {
    console.error('❌ Error registrando comandos:', err);
  }

  client.user.setActivity('🎵 /play para música', { type: 2 });
});

// ── Manejar slash commands ────────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`❌ Error en /${interaction.commandName}:`, err);
    const msg = { content: '❌ Ocurrió un error ejecutando ese comando.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
