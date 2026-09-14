# VORHEX

**KRYPTBLADE autonomous Discord security system.**

## Operating model

VORHEX is designed to be **start-only for humans**. The only slash command is `/start`. After initialization, monitoring, analysis, verification, containment, recovery, alerts and incident logging run automatically.

**Pipeline:** Observer → Identity → Local Supreme AI → Independent GPT 2.1 verification → Policy Gate → Containment → Recovery → Incident Reporting.

The two AI layers are deliberately separated:

- **Local Supreme AI** — VORHEX's primary decision, policy and action authority.
- **GPT 2.1** — independent external verification. It analyzes supplied defensive evidence using its own reasoning, but can never execute tools, approve actions, or directly control Discord.

GPT 2.1 is automatically used when `OPENAI_API_KEY` is configured. Set `VORHEX_EXTERNAL_VERIFIER=false` only if external verification must be disabled.

Human-facing product, command, feature, channel and role names are centralized in `core/identity/registry.js`.

## Automatic protection

- Anti-nuke audit-log monitoring
- Destructive-action burst detection
- Automatic containment with hierarchy/owner safety checks
- Automatic panic mode
- Join-velocity raid mode and join isolation
- Automatic bot admission risk assessment
- Discord verification provenance when available
- Automatic member risk assessment
- Quarantine with rollback on partial failure
- Identity profiles and observed security history
- Static source scanner for code supplied to the system; it never executes untrusted source
- Owner alerts with cooldown
- Structured security logs and incident reports
- Adaptive risk engine
- Self-protection monitoring
- Configuration persistence
- Automatic GPT 2.1 independent verification

## Run

Set `DISCORD_TOKEN` in the hosting environment. For automatic GPT 2.1 verification, also set `OPENAI_API_KEY`. Enable the privileged intents required by the configured Discord features in the Developer Portal. Never commit tokens or credentials.

Node.js 20+ is required.

## Important Discord limits

VORHEX cannot override Discord role hierarchy, protected-owner rules, missing permissions, API latency, or information Discord does not expose. `Administrator` is powerful but does not remove Discord hierarchy constraints. Automatic detection is fail-safe, not magically zero-latency.
