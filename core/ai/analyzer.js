// Public AI entry point. Keep this file small so the Brain can evolve independently.
const { analyze } = require("./brain");

function analyzeContext(input = {}) {
  return analyze(input);
}

module.exports = { analyzeContext, analyze };
