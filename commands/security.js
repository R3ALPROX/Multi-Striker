const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const { runSecurityAudit } = require("../core/security/audit");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("security")
        .setDescription("Inspect Multi Striker security status")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName("audit").setDescription("Run a server security audit")
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const audit = await runSecurityAudit(interaction.guild);
        const rolesPerPage = 5;
        const rolePages = Math.max(1, Math.ceil(audit.roles.length / rolesPerPage));
        const totalPages = 2 + rolePages;
        let page = 0;

        function buildEmbed() {
            if (page === 0) {
                const icon = audit.score >= 85 ? "🟢" : audit.score >= 65 ? "🟡" : "🔴";
                return new EmbedBuilder()
                    .setTitle("Multi Striker Security Audit")
                    .setDescription(`${icon} **${audit.status}**\n\nA contextual scan of permissions, administrators and role distribution.`)
                    .addFields(
                        { name: "Score", value: `${audit.score}/100`, inline: true },
                        { name: "Members", value: String(audit.guild.memberCount), inline: true },
                        { name: "Roles", value: String(audit.guild.roleCount), inline: true },
                        { name: "Administrators", value: String(audit.administrators.count), inline: true },
                        { name: "High-risk roles", value: String(audit.roles.filter(r => r.level === "high").length), inline: true },
                        { name: "Medium-risk roles", value: String(audit.roles.filter(r => r.level === "medium").length), inline: true }
                    )
                    .setFooter({ text: "Page 1/" + totalPages + " • Multi Striker" })
                    .setTimestamp();
            }

            if (page === 1) {
                const everyone = audit.everyone.dangerousPermissions.length
                    ? audit.everyone.dangerousPermissions.map(p => "• `" + p + "`").join("\n")
                    : "None detected.";
                const admins = audit.administrators.members.length
                    ? audit.administrators.members.slice(0, 15).map(m => "• " + m.name).join("\n")
                    : "None detected.";

                return new EmbedBuilder()
                    .setTitle("Global Security")
                    .addFields(
                        { name: "@everyone dangerous permissions", value: everyone.slice(0, 1024) },
                        { name: "Administrator accounts", value: admins.slice(0, 1024) },
                        {
                            name: "Bot permissions",
                            value: `Administrator: **${audit.bot.administrator ? "YES" : "NO"}**\nDangerous capabilities: ${audit.bot.dangerousPermissions.join(", ") || "None"}`
                        }
                    )
                    .setFooter({ text: "Page 2/" + totalPages + " • Multi Striker" })
                    .setTimestamp();
            }

            const rolePage = page - 2;
            const roles = audit.roles.slice(rolePage * rolesPerPage, (rolePage + 1) * rolesPerPage);
            const embed = new EmbedBuilder()
                .setTitle(`Contextual Role Analysis • ${rolePage + 1}/${rolePages}`)
                .setDescription("Powerful permissions are evaluated together with how widely the role is distributed. A role name alone is never treated as proof of safety.")
                .setFooter({ text: `Page ${page + 1}/${totalPages} • Multi Striker` })
                .setTimestamp();

            for (const role of roles) {
                embed.addFields({
                    name: `${role.level === "high" ? "🔴" : role.level === "medium" ? "🟡" : "🟢"} ${role.name}`,
                    value: `Risk: **${role.level}** (${role.score}/100)\nMembers: **${role.memberCount}**\nDangerous permissions: ${role.dangerous.length ? role.dangerous.join(", ") : "None"}`
                });
            }
            return embed;
        }

        function buildButtons() {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("security_prev").setLabel("Previous").setEmoji("⬅️").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId("security_next").setLabel("Next").setEmoji("➡️").setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1),
                new ButtonBuilder().setCustomId("security_close").setLabel("Close").setEmoji("✖️").setStyle(ButtonStyle.Danger)
            );
        }

        const message = await interaction.editReply({ embeds: [buildEmbed()], components: [buildButtons()] });
        const collector = message.createMessageComponentCollector({ time: 10 * 60 * 1000 });

        collector.on("collect", async button => {
            if (button.user.id !== interaction.user.id) {
                return button.reply({ content: "Only the person who ran this audit can control these buttons.", flags: MessageFlags.Ephemeral });
            }
            if (button.customId === "security_close") {
                collector.stop("closed");
                return button.update({ content: "Security audit closed.", embeds: [], components: [] });
            }
            if (button.customId === "security_prev") page--;
            if (button.customId === "security_next") page++;
            await button.update({ embeds: [buildEmbed()], components: [buildButtons()] });
        });

        collector.on("end", (_, reason) => {
            if (reason === "closed") return;
            interaction.editReply({ components: [] }).catch(() => {});
        });
    }
};
