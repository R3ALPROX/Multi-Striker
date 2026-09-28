const {quarantine}=require("./quarantine");

async function handleJoin(member){
  try{
    return await quarantine(member);
  }catch(error){
    console.error("[VORHEX] Failed to quarantine new member:",error);
    return null;
  }
}

module.exports={handleJoin};
