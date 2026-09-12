const N={
  product:{name:"VORHEX",org:"KRYPTBLADE",tagline:"Defensive Discord Security System"},
  commands:{start:{name:"start",description:"Initialize or audit VORHEX security"},security:{name:"security",description:"Inspect live security posture"},antinuke:{name:"antinuke",description:"Configure destructive-action protection"},antiraid:{name:"antiraid",description:"Configure join-velocity protection"},verify:{name:"verify",description:"Inspect a member or bot"},config:{name:"config",description:"Manage VORHEX configuration"},ping:{name:"ping",description:"Check security system health"},serverinfo:{name:"serverinfo",description:"Inspect server security metadata"}},
  features:{panic:"panic_mode",raid:"raid_mode",quarantine:"quarantine",antiNuke:"anti_nuke",botGuard:"bot_guard",memberGuard:"member_guard",identity:"identity_profiles",adaptive:"adaptive_risk",audit:"audit_monitor",incident:"incident_reporting",recovery:"recovery_snapshots",selfProtection:"self_protection",network:"evidence_network",codeScan:"static_code_analysis",externalVerifier:"realtime_gpt_3_verifier",localSupremeAI:"local_supreme_ai"},
  ai:{local:{name:"Local Supreme AI",authority:"decision_and_policy",canAct:true,canExecuteTools:true,canApproveActions:true},external:{name:"Realtime GPT 3.0",authority:"verification_only",canAct:false,canExecuteTools:false,canApproveActions:false,transport:"realtime_websocket",defaultModel:"gpt-realtime-2.1"}},
  env:{discordToken:"DISCORD_TOKEN",externalEnabled:"VORHEX_EXTERNAL_VERIFIER",openAiKey:"OPENAI_API_KEY",realtimeModel:"OPENAI_REALTIME_MODEL",realtimeUrl:"OPENAI_REALTIME_URL",verifierTimeout:"OPENAI_VERIFIER_TIMEOUT_MS"},
  channels:{logs:"security-logs"},
  roles:{quarantine:"Quarantined"},
  containmentModes:{quarantine:"quarantine",timeout:"timeout",ban:"ban"},
  labels:{system:"SYSTEM",moderation:"MODERATION",raid:"RAID",security:"SECURITY",critical:"CRITICAL",high:"HIGH",medium:"MEDIUM",low:"LOW",monitor:"MONITOR",review:"REVIEW",contain:"CONTAIN",blocked:"BLOCKED"},
  actions:{channelDelete:"channel_delete",channelCreate:"channel_create",roleDelete:"role_delete",roleCreate:"role_create",roleUpdate:"role_update",memberBan:"member_ban",memberKick:"member_kick",memberRoleUpdate:"member_role_update",botAdd:"bot_add",webhookCreate:"webhook_create",webhookUpdate:"webhook_update",webhookDelete:"webhook_delete",integrationChange:"integration_change",guildUpdate:"guild_update",overwriteChange:"permission_overwrite"},
  configKeys:{enabled:"enabled",panicThreshold:"panic_threshold",raidWindowMs:"raid_window_ms",raidJoinLimit:"raid_join_limit",action:"action",logChannelId:"log_channel_id",verificationEnabled:"verification_enabled",verifiedRoleId:"verified_role_id"}
};
module.exports={N};
