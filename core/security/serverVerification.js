const {inspect}=require("./verification");

async function verifyGuild(guild){
  const results=[];
  await guild.members.fetch().catch(()=>null);

  for(const member of guild.members.cache.values()){
    if(member.user?.bot){
      results.push(await inspect(member));
    }
  }

  return {
    guildId:guild.id,
    guildName:guild.name,
    checkedMembers:guild.memberCount,
    checkedBots:results.length,
    botResults:results,
    verifiedAt:Date.now()
  };
}

async function verifyAllGuilds(client){
  const results=[];
  for(const guild of client.guilds.cache.values()){
    try{
      results.push(await verifyGuild(guild));
    }catch(error){
      console.error(`[VORHEX] Server verification failed for ${guild.id}:`,error);
    }
  }
  return results;
}

module.exports={verifyGuild,verifyAllGuilds};