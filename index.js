const express = require('express');
const app = express();
app.get('/', (req, res) => {
  res.send('Le bot est en ligne !');
});
app.listen(3000, () => {
  console.log('🌐 Connecté en Localhost:3000');
});

require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const LOG_DIR = './pointeuse_logs';
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

const jobs = [
  "avocat", "lm_auto", "prp_logistique", "justice", "pompiers",
  "gendarme", "mcdo", "bar", "concessionnaire", "orpi", "samu"
];
const PDG_ROLE = "PDG";
const pointage = new Map();

client.once(Events.ClientReady, () => {
  console.log(`✅ Bot opérationnel : ${client.user.tag}`);
});

// ✅ Répond aux mentions du bot
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.mentions.has(client.user)) {
    message.reply("👋 Je suis réveillé ! Merci !");
  }
});

// Commandes slash
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const username = interaction.user.username;
  const member = await interaction.guild.members.fetch(userId);
  const now = new Date();

  // 📘 /help
  if (interaction.commandName === 'help') {
    return interaction.reply({
      content:
        "**📘 Liste des commandes :**\n" +
        jobs.map(j => `- \`/pointer_${j}\` / \`/depointer_${j}\``).join('\n') +
        `\n- \`/historique\` (PDG uniquement)\n- \`/help\` (affiche ce message)`,
      ephemeral: true
    });
  }

  // 📊 /historique
  if (interaction.commandName === 'historique') {
    if (!member.roles.cache.some(role => role.name === PDG_ROLE)) {
      return interaction.reply({ content: '⛔ Tu dois être PDG pour utiliser cette commande.', ephemeral: true });
    }

    const job = interaction.options.getString('job');
    const periode = interaction.options.getString('periode');
    const fileName = path.join(LOG_DIR, `${job}.csv`);

    if (!fs.existsSync(fileName)) {
      return interaction.reply({ content: `❌ Aucun pointage trouvé pour le job **${job}**.`, ephemeral: true });
    }

    let dateLimite = new Date();
    if (periode === 'jour') {
      dateLimite.setHours(0, 0, 0, 0);
    } else if (periode === 'semaine') {
      const diff = (dateLimite.getDay() + 6) % 7;
      dateLimite.setDate(dateLimite.getDate() - diff);
      dateLimite.setHours(0, 0, 0, 0);
    } else if (periode === 'mois') {
      dateLimite = new Date(dateLimite.getFullYear(), dateLimite.getMonth(), 1);
    }

    const lines = fs.readFileSync(fileName, 'utf-8').split('\n').filter(Boolean);
    const filtered = lines.filter(line => {
      const parts = line.split(',');
      const dateLog = new Date(parts[4]);
      return dateLog >= dateLimite;
    });

    if (filtered.length === 0) {
      return interaction.reply({ content: `ℹ️ Aucun pointage pour **${job}** cette période (${periode}).`, ephemeral: true });
    }

    let entrees = 0, sorties = 0;
    const sessions = {}, noms = new Set();

    filtered.forEach(line => {
      const [uid, name, , type, time] = line.split(',');
      noms.add(name);
      if (!sessions[uid]) sessions[uid] = { total: 0, lastIn: null };

      if (type === 'Entrée') {
        entrees++;
        sessions[uid].lastIn = new Date(time);
      } else if (type === 'Sortie' && sessions[uid].lastIn) {
        sorties++;
        const duration = new Date(time) - sessions[uid].lastIn;
        sessions[uid].total += duration;
        sessions[uid].lastIn = null;
      }
    });

    const totalMs = Object.values(sessions).reduce((sum, s) => sum + s.total, 0);
    const totalH = Math.floor(totalMs / 3600000);
    const totalM = Math.floor((totalMs % 3600000) / 60000);

    return interaction.reply({
      content: `📊 **Historique ${periode} – ${job}**\n` +
               `👥 Employés : ${Array.from(noms).join(', ')}\n` +
               `✅ Entrées : ${entrees} | 🚪 Sorties : ${sorties}\n` +
               `🕒 Temps total travaillé : ${totalH}h ${totalM}min\n` +
               `📁 Total de logs : ${filtered.length}`
    });
  }

  // 👷 Commandes pointer/depointer
  const job = jobs.find(j => interaction.commandName === `pointer_${j}` || interaction.commandName === `depointer_${j}`);
  if (!job) return;

  const isDepointer = interaction.commandName === `depointer_${job}`;
  const fileName = path.join(LOG_DIR, `${job}.csv`);
  const roleName = job.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const hasRole = member.roles.cache.some(role => role.name.toLowerCase() === roleName.toLowerCase());

  if (!hasRole) {
    return interaction.reply({
      content: `⛔ Tu n'as pas le rôle **${roleName}** pour utiliser cette commande.`,
      ephemeral: true
    });
  }

  if (isDepointer) {
    if (!pointage.has(userId)) {
      return interaction.reply({
        content: `⚠️ Tu n'as pas pointé. Utilise \`/pointer_${job}\` pour pointer d'abord.`,
        ephemeral: true
      });
    }

    const entry = pointage.get(userId);
    pointage.delete(userId);
    fs.appendFileSync(fileName, `${userId},${username},${job},Sortie,${now.toISOString()}\n`);

    const duration = now - entry.time;
    const h = Math.floor(duration / 3600000).toString().padStart(2, '0');
    const m = Math.floor((duration % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((duration % 60000) / 1000).toString().padStart(2, '0');

    return interaction.reply(`👋 ${username} a **dépointé** à ${now.toLocaleTimeString()} (Durée : ${h}:${m}:${s}) pour **${roleName}**.`);
  } else {
    if (pointage.has(userId)) {
      return interaction.reply({
        content: `⚠️ Tu as déjà pointé. Utilise \`/depointer_${job}\` pour dépointer.`,
        ephemeral: true
      });
    }

    pointage.set(userId, { time: now, job });
    fs.appendFileSync(fileName, `${userId},${username},${job},Entrée,${now.toISOString()}\n`);
    return interaction.reply(`✅ ${username} a **pointé** à ${now.toLocaleTimeString()} en tant que **${roleName}**.`);
  }
});

client.login(process.env.DISCORD_TOKEN);
