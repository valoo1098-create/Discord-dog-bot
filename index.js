const {
  Client,
  GatewayIntentBits,
  PermissionsBitField
} = require("discord.js");

const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const PREFIX = "-";
const DATA_FILE = "./leashes.json";

let leashes = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    leashes = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    leashes = {};
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(leashes, null, 2));
}

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  client.user.setActivity("-dogadd @membre");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command === "-dogadd") {
    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Utilise : `-dogadd @membre`");
    }

    if (member.id === message.author.id) {
      return message.reply("❌ Tu ne peux pas te mettre toi-même en laisse.");
    }

    if (!leashes[message.guild.id]) {
      leashes[message.guild.id] = {};
    }

    leashes[message.guild.id][member.id] = message.author.id;
    save();

    return message.reply(
      `🐕 ${member} est maintenant lié à ${message.author}.`
    );
  }

  if (command === "-dogremove") {
    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Utilise : `-dogremove @membre`");
    }

    const guildLeashes = leashes[message.guild.id] || {};

    if (guildLeashes[member.id] !== message.author.id) {
      return message.reply("❌ Cette personne n'est pas liée à toi.");
    }

    delete guildLeashes[member.id];
    save();

    return message.reply(`✅ ${member} n'est plus lié à toi.`);
  }

  if (command === "-doglist") {
    const guildLeashes = leashes[message.guild.id] || {};

    const dogs = Object.entries(guildLeashes)
      .filter(([_, ownerId]) => ownerId === message.author.id)
      .map(([dogId]) => {
        const member = message.guild.members.cache.get(dogId);
        return member ? `🐕 ${member}` : `🐕 <@${dogId}>`;
      });

    if (dogs.length === 0) {
      return message.reply("📋 Tu n'as personne dans ta liste.");
    }

    return message.reply(
      `📋 **Ta liste :**\n${dogs.join("\n")}`
    );
  }

  if (command === "-dogclear") {
    const guildLeashes = leashes[message.guild.id] || {};

    let count = 0;

    for (const [dogId, ownerId] of Object.entries(guildLeashes)) {
      if (ownerId === message.author.id) {
        delete guildLeashes[dogId];
        count++;
      }
    }

    save();

    return message.reply(
      count === 0
        ? "📋 Ta liste est déjà vide."
        : `✅ ${count} personne(s) retirée(s) de ta liste.`
    );
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!newState.channelId) return;

  const guildId = newState.guild.id;
  const guildLeashes = leashes[guildId];

  if (!guildLeashes) return;

  const ownerId = guildLeashes[newState.member.id];

  if (!ownerId) return;

  const owner = newState.guild.members.cache.get(ownerId);

  if (!owner || !owner.voice.channel) return;

  if (newState.channelId === owner.voice.channelId) return;

  try {
    await newState.member.voice.setChannel(owner.voice.channelId);
  } catch (error) {
    console.error("❌ Impossible de déplacer le membre :", error);
  }
});

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("❌ DISCORD_TOKEN est manquant.");
  process.exit(1);
}

client.login(token);
