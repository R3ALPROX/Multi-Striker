const {inspectJoin}=require("./detector");
const {inspectMember}=require("../memberSecurity/detector");
const {inspectBot}=require("../botSecurity/detector");
const {update}=require("../security/adaptiveLevel");
const {evaluateHeatPanic}=require("./heatPanic");
const {inspectJoinGate}=require("../joingate/filter");
const {containVector}=require("../antinuke/vectorContainment");
const {getGuildConfig}=require("../../config/manager");
const {add}=require("../intelligence/memory");
function registerAntiRaidEvents(client){
 client.on("guildMemberAdd",async member=>{try{
  const cfg=getGuildConfig(member.guild.id);const gate=await inspectJoinGate(member);const result=member.user.bot?await inspectBot(member):await inspectMember(member);
  add(member.guild.id,{type:"member_join",memberId:member.id,risk:result.risk||0,flags:gate.flags||[],time:Date.now()});update(member.guild.id,Math.max(result.risk||0,gate.flags?.length?20:0));
  if(member.user.bot&&cfg.joingate.containDangerousBots&&result.risk>=35){await containVector(member.guild,member.id,"Suspicious bot addition detected",{critical:result.risk>=70,bot:true,risk:result.risk});}
  await inspectJoin(member);await evaluateHeatPanic(member.guild);
 }catch(error){console.error("Anti-raid event error:",error);}});
}
module.exports={registerAntiRaidEvents};