const { verifyMember } = require("./service");

function registerVerificationEvents(client) {
    client.on("interactionCreate", async interaction => {
        if (!interaction.isButton() || interaction.customId !== "multi_striker_verify") return;

        try {
            const result = await verifyMember(interaction);
            await interaction.reply({ content: result.message, ephemeral: true });
        } catch (error) {
            console.error("Verification error:", error);
            if (!interaction.replied) {
                await interaction.reply({ content: "Verification failed. Ask a server administrator to check the bot's role hierarchy.", ephemeral: true });
            }
        }
    });
}

module.exports = { registerVerificationEvents };
