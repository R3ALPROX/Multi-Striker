const {N}=require("../identity/registry");

async function verify(observation={},options={}) {
  const enabled=String(process.env[N.env.externalEnabled]||"").toLowerCase()==="true";
  const apiKey=process.env[N.env.openAiKey];
  if(!enabled||!apiKey){
    return {
      enabled:false,
      available:false,
      verdict:"UNAVAILABLE",
      confidence:0,
      rationale:"External verification is disabled or no API key is configured."
    };
  }

  // Fail closed until an explicitly configured external transport is available.
  // VORHEX never depends on this advisory verifier for startup or security actions.
  return {
    enabled:true,
    available:false,
    verdict:"UNAVAILABLE",
    confidence:0,
    rationale:"External verifier transport is not configured; local security policy remains authoritative."
  };
}

module.exports={verify};
