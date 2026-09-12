# VORHEX

**KRYPTBLADE defensive Discord security system.**

## Architecture

Observer → Identity → Risk Engine → Policy Gate → Containment → Recovery → Incident Reporting.

Human-facing product, command, feature, channel and role names are centralized in `core/identity/registry.js` so branding can be changed without hunting through feature modules.

## Included foundation

- Anti-nuke audit-log monitoring
- Destructive-action burst detection
- Automatic containment with hierarchy/owner safety checks
- Automatic panic mode
- Join-velocity raid mode and join isolation
- Bot admission risk assessment
- Discord verification provenance when available
- Member risk assessment
- Quarantine with rollback on partial failure
- Identity profiles: usernames, global names, avatars, account creation time, guild observations, incidents and observed bans
- Static source scanner for code supplied to the system; it never executes untrusted source
- Owner DM alerts with cooldown
- Structured security logs
- Adaptive risk engine
- Self-protection monitoring
- Configuration persistence
- Slash-command auto-registration per guild

## Important Discord limits

VORHEX cannot override Discord role hierarchy, protected-owner rules, missing permissions, API latency, or information Discord does not expose. `Administrator` is powerful but does not remove Discord hierarchy constraints. Detection is designed to be fast and fail-safe, not magically zero-latency.

## Run

Set `DISCORD_TOKEN` in the hosting environment. Enable the privileged intents required by the configured features in the Discord Developer Portal. Never commit tokens or credentials.

Node.js 20+ is required.
