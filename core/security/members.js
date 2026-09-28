const {ActionRowBuilder,ButtonBuilder,ButtonStyle}=require("discord.js");
const {quarantine,release}=require("./quarantine");
const {inspect,getProfile}=require("./verification");

const HUMAN_VERIFY_ID="vorhex:verify-human";

async function handleJoin(member){
  try{
    const quarantineResult=await quarantine(member);
    if(!quarantineResult)return null;

    const profile=await inspect(member);

    if(profile.isBot){
      if(profile.verifiedBot){
        await release(member);
        return {...profile,decision:"ALLOW",released:true};
      }
      return {...profile,released:false};
    }

    const row=new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(HUMAN_VERIFY_ID)
        .setLabel("Verify")
        .setStyle(ButtonStyle.Success)
    );

    await member.send({
      content:"VORHEX has temporarily quarantined your account while it verifies this server join. Press Verify to confirm that you are a human account.",
      components:[row]
    }).catch(()=>{});

    return {...profile,released:false};
  }catch(error){
    console.error("[VORHEX] Failed to verify new member:",error);
    return null;
  }
}

async function handleHumanVerification(interaction){
  if(interaction.customId!==HUMAN_VERIFY_ID)return false;

  const member=await interaction.guild?.members.fetch(interaction.user.id).catch(()=>null);
  if(!member)return false;

  const profile=getProfile(member.id);
  if(!profile||profile.isBot){
    await interaction.reply({content:"Verification state is invalid. VORHEX will keep this account quarantined for review.",ephemeral:true}).catch(()=>{});
    return true;
  }

  const released=await release(member);
  await interaction.reply({
    content:released
      ?"Human verification completed. Your previous roles have been restored."
      :"VORHEX could not restore the previous roles. The account remains protected.",
    ephemeral:true
  }).catch(()=>{});

  return true;
}

module.exports={handleJoin,handleHumanVerification};