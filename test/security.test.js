const test=require("node:test");
const assert=require("node:assert/strict");
const {assess}=require("../core/intelligence/threatEngine");
const {correlate}=require("../core/intelligence/correlation");
const {recordAndAssess}=require("../core/intelligence/slowAttack");

test("threat engine clamps risk and classifies critical activity",()=>{const out=assess([{weight:100},{weight:30}]);assert.equal(out.risk,100);assert.equal(out.level,"CRITICAL");});
test("slow attack engine detects multi-vector activity",async()=>{const guildId="test-slow-"+Date.now();for(let i=0;i<4;i++)await recordAndAssess(guildId,{executorId:"actor",actionType:["channelDelete","roleDelete","dangerousPermission","webhookCreate"][i],time:Date.now()});const out=correlate(guildId);assert.equal(out.eventCount,4);assert.equal(out.actors.length,1);});
test("coordinated actor correlation detects distributed actors",async()=>{const guildId="test-coord-"+Date.now();for(let i=0;i<6;i++)await recordAndAssess(guildId,{executorId:"actor-"+(i%3),actionType:"channelDelete",time:Date.now()});const out=correlate(guildId);assert.equal(out.coordinated,true);});
