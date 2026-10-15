const profiles=new Map();

async function inspect(member){
  const user=await member.user.fetch(true).catch(()=>member.user);
  const flags=user.flags;
  const profile={
    guildId:member.guild.id,
    memberId:member.id,
    username:user.tag||user.username,
    accountId:user.id,
    isBot:Boolean(user.bot),
    accountCreatedAt:user.createdAt?.toISOString?.()||null,
    accountAgeDays:user.createdAt?Math.floor((Date.now()-user.createdAt.getTime())/86400000):null,
    publicFlags:flags?.toArray?.()||[],
    verifiedBot:Boolean(user.bot&&flags?.toArray?.().includes("VerifiedBot")),
    verifiedBotDeveloper:Boolean(user.bot&&flags?.has?.("VerifiedDeveloper")),
    profileFetched:true,
    inspectedAt:Date.now()
  };

  if(user.bot){
    profile.applicationSignals={
      botAccount:true,
      discordVerifiedBot:profile.verifiedBot,
      verifiedDeveloper:profile.verifiedBotDeveloper,
      applicationDashboardAccessible:"not available for arbitrary third-party applications",
      commandInspection:"not available without the target application's authorization context"
    };
    profile.decision=profile.verifiedBot?"ALLOW":"REVIEW";
  }else{
    profile.humanSignals={
      botAccount:false,
      accountAgeDays:profile.accountAgeDays,
      publicFlags:profile.publicFlags
    };
    profile.decision="HUMAN_VERIFICATION_REQUIRED";
  }

  profiles.set(`${member.guild.id}:${member.id}`,profile);
  return profile;
}

function getProfile(guildId,memberId){
  return profiles.get(`${guildId}:${memberId}`)||null;
}

function remove(guildId,memberId){
  profiles.delete(`${guildId}:${memberId}`);
}

module.exports={inspect,getProfile,remove};