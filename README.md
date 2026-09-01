# Multi Striker

A Discord server protection bot focused on four systems:

- Anti-nuke detection and containment
- Anti-raid detection and raid mode
- Server security auditing
- Member verification

## Required Discord permissions

For full protection, the bot should have only the permissions it needs:

- View Audit Log
- Manage Roles
- Moderate Members
- Send Messages
- Embed Links
- Read Message History

Additional permissions may be required for features you explicitly enable.

## Required privileged intent

Enable **Server Members Intent** in the Discord Developer Portal. Multi Striker uses member join events for anti-raid detection and verification.

## Safety model

Multi Striker does not trust a role name by itself. It evaluates configured trusted users/roles and rate-based behavior. Automatic containment is skipped for the server owner, the bot itself, trusted users, and trusted-role members.

Always test hierarchy and permissions in a private test server before relying on automatic containment in a production community.
