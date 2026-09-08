const test = require("node:test");
const assert = require("node:assert/strict");
const {scanText}=require("../core/botSecurity/codeScanner");

test("source scanner flags dynamic execution without executing source",()=>{
 const findings=scanText("const x = eval(input);","index.js");
 assert.ok(findings.some(f=>f.id==="dynamic_code"&&f.severity==="HIGH"));
});

test("source scanner does not confuse verified developer with verified bot",()=>{
 const source="const verifiedBot=false; const verifiedDeveloper=true;";
 const findings=scanText(source,"index.js");
 assert.equal(findings.some(f=>f.id==="verified"),false);
});

test("scanner treats clean source as no high-risk pattern found",()=>{
 const findings=scanText("module.exports = { ping: true };","index.js");
 assert.equal(findings.length,0);
});
