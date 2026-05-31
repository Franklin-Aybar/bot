module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`\n🎵 ================================`);
    console.log(`   Chipeo Music Bot está online!`);
    console.log(`   Logged in as: ${client.user.tag}`);
    console.log(`   Servers: ${client.guilds.cache.size}`);
    console.log(`🎵 ================================\n`);
  },
};
