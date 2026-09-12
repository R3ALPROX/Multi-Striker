const test=require("node:test");
const assert=require("node:assert/strict");
const {normalize}=require("../core/intelligence/externalVerifier");
const {decideWithExternalVerification}=require("../core/intelligence/supervisor");

test("external verifier is advisory-only",()=>{
  const result=normalize({verdict:"CONFIRMED",confidence:91,reasons:["consistent evidence"]});
  assert.equal(result.verdict,"CONFIRMED");
  assert.equal(result.advisoryOnly,true);
  assert.equal(result.canAct,false);
  assert.equal(result.canExecuteTools,false);
  assert.equal(result.canApproveActions,false);
});

test("external verification cannot become action authority",async()=>{
  const old=global.fetch;
  global.fetch=async()=>({ok:true,json:async()=>({output_text:JSON.stringify({verdict:"CONFIRMED",confidence:88,reasons:["independent consistency check"]})})});
  try{
    const result=await decideWithExternalVerification({destructive:true,repetition:4,privileged:true},{apiKey:"test-key",timeoutMs:100});
    assert.equal(result.actionAuthority,"local_supreme_ai_and_policy_only");
    assert.equal(result.externalCanAct,false);
    assert.equal(result.externalCanApproveActions,false);
    assert.equal(result.externalVerification.advisoryOnly,true);
  }finally{global.fetch=old;}
});
