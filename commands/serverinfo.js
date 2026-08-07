const {
SlashCommandBuilder,
EmbedBuilder
} = require("discord.js");

module.exports = {

data: new SlashCommandBuilder()
.setName("serverinfo")
.setDescription("Shows information about this server"),

async execute(interaction){

const guild = interaction.guild;

const embed = new EmbedBuilder()
.setTitle(guild.name)
.setThumbnail(guild.iconURL())
.addFields(
{
name:"👥 Members",
value:String(guild.memberCount),
inline:true
},
{
name:"📁 Channels",
value:String(guild.channels.cache.size),
inline:true
}
)
.setColor("Blue");

await interaction.reply({embeds:[embed]});

}

};