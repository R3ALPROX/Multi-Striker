const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require("discord.js");
const { getGuildConfig, updateGuildConfig } = require("../config/manager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("verify")
        .setDescription("Configure Multi Striker verification")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName("setup").setDescription("Create or update verification")
                .addChannelOption(option => option.setName("channel").setDescription("Verification channel").addChannelTypes(ChannelType.GuildText).setRequired(true))
                .addRoleOption(option => option.setName("verified-role").setDescription("Role granted after verification").setRequired(true))
                .addRoleOption(option => option.setName("unverified-role").setDescription("Optional role removed after verification"))
        )
        .addSubcommand(sub => sub.setName("status").setDescription("Show verification status"))
        .addSubcommand(sub => sub.setName("disable").setDescription("Disable verification")),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === "status") {
            const config = getGuildConfig(interaction.guild.id);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle("Verification Status")
                    .addFields(
                        { name: "Enabled", value: config.verification.enabled ? "Yes" : "No", inline: true },
                        { name: "Channel", value: config.verification.channelId ? `<#${config.verification.channelId}>` : "Not set", inline: true },
                        { name: "Verified role", value: config.verification.verifiedRoleId ? `<@&${config.verification.verifiedRoleId}>` : "Not set" }
                    )
                    .setTimestamp()],
                flags: MessageFlags.Ephemeral
            });
        }

        if (sub === "disable") {
            updateGuildConfig(interaction.guild.id, { verification: { enabled: false } });
            return interaction.reply({ content: "Verification disabled.", flags: MessageFlags.Ephemeral });
        }

        const channel = interaction.options.getChannel("channel", true);
        const verifiedRole = interaction.options.getRole("verified-role", true);
        const unverifiedRole = interaction.options.getRole("unverified-role");

        if (!verifiedRole.editable) {
            return interaction.reply({ content: "Move Multi Striker's role above the verified role first.", flags: MessageFlags.Ephemeral });
        }

        updateGuildConfig(interaction.guild.id, {
            verification: {
                enabled: true,
                channelId: channel.id,
                verifiedRoleId: verifiedRole.id,
                unverifiedRoleId: unverifiedRole?.id || null
            }
        });

        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle("Server Verification")
                .setDescription("Press the button below to complete verification and receive access.")
                .setTimestamp()],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("multi_striker_verify")
                    .setLabel("Verify")
                    .setEmoji("🛡️")
                    .setStyle(ButtonStyle.Success)
            )]
        });

        return interaction.reply({ content: `Verification configured in ${channel}.`, flags: MessageFlags.Ephemeral });
    }
};
