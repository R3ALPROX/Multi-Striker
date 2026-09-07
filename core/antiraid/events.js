const {inspectJoin}=require("./detector");
const {update}=require("../security/adaptiveLevel");
const {evaluateHeatPanic}=require("./heatPanic");
const {inspectJoinGate}=require("../joingate/filter");
const {containVector}=require("../antinuke/vectorContainment");
const {quarantineMember}=require("../quarantine/manager");
const {getGuildConfig}=require("../../config/manager");
const {add}=require("../intelligence/memory");

function registerAntiRaidEvents(client){
 client.on("guildMemberAdd",async member=>{try{
  const cfg=getGuildConfig(member.guild.id);
  const gate=await inspectJoinGate(member);

  if(member.user.bot&&cfg.joingate.containDangerousBots){
   const quarantine=await quarantineMember(member.guild,member.id,"Multi Striker pre-verification bot quarantine").catch(e=>({ok:false,message:e.message}));
   add(member.guild.id,{type:"bot_preverification",memberId:member.id,quarantined:!!quarantine.ok,time:Date.now()});
  }

  const joinRisk=gate.flags?.length?20:0;
  add(member.guild.id,{type:"member_join",memberId:member.id,risk:joinRisk,flags:gate.flags||[],time:Date.now()});
  update(member.guild.id,joinRisk);
  await inspectJoin(member);
  await evaluateHeatPanic(member.guild);
 }catch(error){console.error("Anti-raid event error:",error);}});

 client.on("guildMemberUpdate",async(oldMember,newMember)=>{try{
  if(!newMember.user.bot)return;
  const cfg=getGuildConfig(newMember.guild.id);
  if(!cfg.joingate.containDangerousBots)return;
  const dangerous=["Administrator","ManageGuild","ManageRoles","ManageChannels","BanMembers","KickMembers","ManageWebhooks"];
  const newlyElevated=dangerous.some(p=>!oldMember.permissions.has(p)&&newMember.permissions.has(p));
  if(newlyElevated)await containVector(newMember.guild,newMember.id,"Bot permissions elevated after verification",{critical:true,bot:true}).catch(()=>{});
 }catch(error){console.error("Bot permission escalation guard error:",error);}});
}
module.exports={registerAntiRaidEvents};
