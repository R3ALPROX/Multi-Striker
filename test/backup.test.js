const test=require("node:test");
const assert=require("node:assert/strict");
const {verifySnapshot}=require("../core/recovery/backup");

function snapshot(roles){
  return {schema:1,guildId:"12345678901234567",guildName:"Test",capturedAt:1,roles,channels:[]};
}
const role=(id,name="Member")=>({id,name,permissions:"0",managed:false});

test("backup verification permits duplicate Discord role names",()=>{
  const result=verifySnapshot(snapshot([role("11111111111111111"),role("22222222222222222")]),"12345678901234567");
  assert.equal(result.ok,true);
});

test("backup verification rejects duplicate role IDs",()=>{
  const result=verifySnapshot(snapshot([role("11111111111111111"),role("11111111111111111","Other")]),"12345678901234567");
  assert.equal(result.ok,false);
  assert.equal(result.reason,"invalid_or_duplicate_role_id");
});

test("backup verification rejects a snapshot from another guild",()=>{
  const result=verifySnapshot(snapshot([]),"99999999999999999");
  assert.equal(result.ok,false);
  assert.equal(result.reason,"invalid_schema_or_guild");
});
