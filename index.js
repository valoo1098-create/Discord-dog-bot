const {
  Client,
  GatewayIntentBits
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
let promenades = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    leashes = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    leashes = {};
  }
}

function save() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(leashes, null, 2)
  );
}

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  client.user.setActivity("-dogadd @membre");
});


// ==============================
// COMMANDES
// ==============================

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  // ==============================
  // -dogadd
  // ==============================

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

    // Si le propriétaire est déjà en vocal,
    // le membre rejoint automatiquement.
    if (message.member.voice.channel) {
      try {
        await member.voice.setChannel(
          message.member.voice.channel
        );
      } catch (error) {
        console.error(error);
      }
    }

    return message.reply(
      `🐕 ${member} est maintenant attaché à ${message.author}.`
    );
  }


  // ==============================
  // -dogremove
  // ==============================

  if (command === "-dogremove") {
    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Utilise : `-dogremove @membre`");
    }

    const guildLeashes = leashes[message.guild.id] || {};

    if (guildLeashes[member.id] !== message.author.id) {
      return message.reply("❌ Cette personne n'est pas attachée à toi.");
    }

    delete guildLeashes[member.id];

    save();

    return message.reply(
      `✅ ${member} n'est plus attaché à toi.`
    );
  }


  // ==============================
  // -doglist
  // ==============================

  if (command === "-doglist") {
    const guildLeashes = leashes[message.guild.id] || {};

    const dogs = Object.entries(guildLeashes)
      .filter(([_, ownerId]) => ownerId === message.author.id)
      .map(([dogId]) => {
        const member = message.guild.members.cache.get(dogId);

        return member
          ? `🐕 ${member}`
          : `🐕 <@${dogId}>`;
      });

    if (dogs.length === 0) {
      return message.reply("📋 Tu n'as personne dans ta liste.");
    }

    return message.reply(
      `📋 **Ta liste :**\n${dogs.join("\n")}`
    );
  }


  // ==============================
  // -dogclear
  // ==============================

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


  // ==============================
  // -promenade
  // ==============================

  if (command === "-promenade") {
    if (promenades[message.author.id]) {
      return message.reply(
        "🚶 Une promenade est déjà active."
      );
    }

    if (!message.member.voice.channel) {
      return message.reply(
        "❌ Tu dois être dans une vocal pour commencer la promenade."
      );
    }

    const guildLeashes = leashes[message.guild.id] || {};

    const dogs = Object.entries(guildLeashes)
      .filter(([_, ownerId]) => ownerId === message.author.id)
      .map(([dogId]) => dogId);

    if (dogs.length === 0) {
      return message.reply(
        "❌ Tu n'as personne dans ta liste."
      );
    }

    promenades[message.author.id] = true;

    message.reply(
      "🚶 **Promenade activée !** Tes membres attachés te suivront toutes les 20 secondes."
    );

    const promenade = async () => {
      while (promenades[message.author.id]) {
        const owner = message.guild.members.cache.get(
          message.author.id
        );

        if (!owner || !owner.voice.channel) {
          promenades[message.author.id] = false;
          break;
        }

        const currentLeashes =
          leashes[message.guild.id] || {};

        const currentDogs = Object.entries(currentLeashes)
          .filter(([_, ownerId]) => ownerId === message.author.id)
          .map(([dogId]) => dogId);

        for (const dogId of currentDogs) {
          const dog = message.guild.members.cache.get(dogId);

          if (!dog) continue;

          if (dog.voice.channelId !== owner.voice.channelId) {
            try {
              await dog.voice.setChannel(
                owner.voice.channel
              );
            } catch (error) {
              console.error(
                `❌ Impossible de déplacer ${dog.user.tag}:`,
                error
              );
            }
          }
        }

        await new Promise(resolve =>
          setTimeout(resolve, 20000)
        );
      }
    };

    promenade();
  }
});


// ==============================
// SUIVI VOCAL AUTOMATIQUE
// ==============================

client.on("voiceStateUpdate", async (oldState, newState) => {
  const guildId = newState.guild.id;
  const guildLeashes = leashes[guildId];

  if (!guildLeashes) return;

  const ownerId = newState.member.id;

  const dogs = Object.entries(guildLeashes)
    .filter(([_, id]) => id === ownerId)
    .map(([dogId]) => dogId);

  if (dogs.length === 0) return;

  // Le propriétaire rejoint ou change de vocal.
  // Ses membres attachés le rejoignent immédiatement.
  if (newState.channelId) {
    for (const dogId of dogs) {
      const dog = newState.guild.members.cache.get(dogId);

      if (!dog) continue;

      if (dog.voice.channelId === newState.channelId) {
        continue;
      }

      try {
        await dog.voice.setChannel(
          newState.channel
        );

        console.log(
          `🐕 ${dog.user.tag} suit ${newState.member.user.tag}`
        );
      } catch (error) {
        console.error(
          `❌ Impossible de déplacer ${dog.user.tag}:`,
          error
        );
      }
    }
  }
});


// ==============================
// CONNEXION
// ==============================

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("❌ DISCORD_TOKEN est manquant.");
  process.exit(1);
}

client.login(token);
