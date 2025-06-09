require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [];

const jobs = [
    "avocat", "lm_auto", "prp_logistique", "justice", "pompiers",
    "gendarme", "mcdo", "bar", "concessionnaire", "orpi", "samu"
];

// Ajouter les commandes /pointer_x et /depointer_x
jobs.forEach(job => {
    commands.push(
        new SlashCommandBuilder()
            .setName(`pointer_${job}`)
            .setDescription(`Pointer en tant que ${job.replace(/_/g, ' ')}`),
        new SlashCommandBuilder()
            .setName(`depointer_${job}`)
            .setDescription(`Dépointer du job ${job.replace(/_/g, ' ')}`)
    );
});

// Commande /historique
commands.push(
    new SlashCommandBuilder()
        .setName('historique')
        .setDescription('Afficher l’historique de pointage')
        .addStringOption(option =>
            option.setName('job')
                  .setDescription('Nom du job')
                  .setRequired(true)
                  .addChoices(...jobs.map(j => ({ name: j, value: j })))
        )
        .addStringOption(option =>
            option.setName('periode')
                  .setDescription('Période souhaitée')
                  .setRequired(true)
                  .addChoices(
                      { name: 'jour', value: 'jour' },
                      { name: 'semaine', value: 'semaine' },
                      { name: 'mois', value: 'mois' }
                  )
        )
);

// Commande /help
commands.push(
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche la liste des commandes disponibles')
);

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 Mise à jour des commandes Slash...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands.map(command => command.toJSON()) }
        );
        console.log('✅ Commandes mises à jour avec succès !');
    } catch (error) {
        console.error('❌ Erreur lors de l’enregistrement des commandes :', error);
    }
})();
