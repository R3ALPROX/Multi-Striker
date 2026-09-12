const {assess}=require("../intelligence/engine");
const {N}=require("../identity/registry");
const {verify:externalVerify}=require("./externalVerifier");

function decide(observation={}){
  const signals=[];
  if(observation.destructive)signals.push({weight:40,reason:"destructive capability"});
  if(observation.repetition>=3)signals.push({weight:30,reason:"rapid repetition"});
  if(observation.privileged)signals.push({weight:20,reason:"privileged actor"});
  if(observation.newAccount)signals.push({weight:15,reason:"new account"});
  if(observation.verified===true)signals.push({weight:-25,reason:"verified provenance"});
  const result=assess(signals);
  return{...result,feature:N.features.localSupremeAI,decisionId:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,authority:"local"};
}

async function decideWithExternalVerification(observation={},options={}){
  const local=decide(observation);
  const external=await externalVerify(observation,options);
  return {
    ...local,
    externalVerification:external,
    actionAuthority:"local_supreme_ai_and_policy_only",
    externalCanAct:false,
    externalCanApproveActions:false
  };
}

module.exports={decide,decideWithExternalVerification};
