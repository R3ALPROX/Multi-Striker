const {SlashCommandBuilder,PermissionFlagsBits}=require("discord.js");
const {saveManual,getSlots,restoreMissingStructure,verifySnapshot,promoteSecondary}=require("../core/recovery/backup");

const slotChoices=[
  {name:"MAIN — latest verified",value:"main"},
  {name:"PREV — previous trusted",value:"previous"},
  {name:"SECONDARY — untrusted review",value:"secondary"},
  {name:"MANUAL — moderator saved",value:"manual"}
];
function stamp(s){return s?.capturedAt?new Date(s.capturedAt).toISOString():"empty";}
module.exports={
 data:new SlashCommandBuilder()
  .setName("backup")
  .setDescription("View, save, or restore VORHEX backups")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s=>s.setName("list").setDescription("Show available backup slots"))
  .addSubcommand(s=>s.setName("manual").setDescription("Save or replace the moderator-controlled MANUAL backup")
    .addBooleanOption(o=>o.setName("confirm").setDescription("Confirm saving/replacing MANUAL").setRequired(true)))
  .addSubcommand(s=>s.setName("promote").setDescription("Promote SECONDARY to MAIN after manual review")\n    .addBooleanOption(o=>o.setName("confirm").setDescription("Confirm you reviewed SECONDARY and trust its server state").setRequired(true)))\n  .addSubcommand(s=>s.setName("restore").setDescription("Restore missing server structure from a selected backup")
    .addStringOption(o=>o.setName("slot").setDescription("Backup to restore from").setRequired(true).addChoices(...slotChoices))
    .addBooleanOption(o=>o.setName("confirm").setDescription("Confirm this structural recovery operation").setRequired(true))),
 async execute(i){
  if(!i.guild||!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
    return i.reply({content:"Manage Server permission required.",ephemeral:true});
  const sub=i.options.getSubcommand(),guild=i.guild;
  if(sub==="list"){
    const slots=getSlots(guild.id);
    const lines=["main","previous","secondary","manual"].map(key=>{
      const s=slots[key];
      if(!s)return "**"+key.toUpperCase()+"** — empty";
      const check=verifySnapshot(s,guild.id);
      return "**"+key.toUpperCase()+"** — "+(check.ok&&s.integrityHash===check.hash?"integrity OK":"INTEGRITY CHECK FAILED")+"; trust: "+(s.trust||"unknown")+"; captured: "+stamp(s);
    });
    return i.reply({content:lines.join("\n"),ephemeral:true});
  }
  if(sub==="manual"){
    if(!i.options.getBoolean("confirm"))return i.reply({content:"Cancelled. MANUAL was not changed.",ephemeral:true});
    await i.deferReply({ephemeral:true});
    try{
      const saved=await saveManual(guild,i.user.id);
      return i.editReply("MANUAL backup saved and integrity-checked. It is separate from automatic rotation. Hash: "+saved.hash);
    }catch(error){return i.editReply("MANUAL backup failed: "+error.message);}
  }
  if(sub==="promote"){
    if(!i.options.getBoolean("confirm"))return i.reply({content:"Cancelled. MAIN was not changed.",ephemeral:true});
    const result=promoteSecondary(guild.id,i.user.id);
    if(!result.ok)return i.reply({content:"Promotion refused: "+result.reason,ephemeral:true});
    return i.reply({content:"SECONDARY was promoted to MAIN after your explicit confirmation. Previous MAIN was retained in PREV when valid. Hash: "+result.hash,ephemeral:true});
  }
  if(sub==="restore"){
    const slot=i.options.getString("slot");
    if(!i.options.getBoolean("confirm"))return i.reply({content:"Cancelled. No recovery was attempted.",ephemeral:true});
    await i.deferReply({ephemeral:true});
    const result=await restoreMissingStructure(guild,slot).catch(error=>({ok:false,reason:error.message}));
    if(!result.ok)return i.editReply("Recovery not applied. Source: "+slot.toUpperCase()+". Reason: "+(result.reason||"unknown"));
    return i.editReply("Recovery attempt finished using "+slot.toUpperCase()+". Roles recreated: "+result.restoredRoles.length+"; channels recreated: "+result.restoredChannels.length+"; skipped: "+result.skipped.length+".\n\nThis restores missing roles/channels only; it does not restore messages, member role assignments, integrations, webhooks, or channel permission overwrites. Check the server permissions after recovery.");
  }
 }
};