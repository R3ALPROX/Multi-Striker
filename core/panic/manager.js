const { lockdown } = require("../lockdown/manager");
const { takeSnapshot } = require("../backups/snapshot");
const { getState, setState } = require("../failsafe/state");
const active = new Map();

async function triggerPanic(guild, reason, details = {}) {
  if (active.has(guild.id)) return active.get(guild.id);
  takeSnapshot(guild);
  await lockdown(guild, "Multi Striker Panic Mode: " + reason);
  const state = { active:true, startedAt:Date.now(), reason, details };
  active.set(guild.id, state);
  setState(guild.id, "LOCKDOWN", "Panic Mode: " + reason);
  return state;
}
function getPanic(guildId){ return active.get(guildId) || null; }
function clearPanic(guildId){ active.delete(guildId); return true; }
module.exports={triggerPanic,getPanic,clearPanic};