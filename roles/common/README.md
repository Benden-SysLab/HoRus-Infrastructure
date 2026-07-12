# Common Role Documentation

This role performs standard system preparation for Debian 13.

## Responsibilities
- APT cache update and safe upgrade.
- Installation of base utility packages.
- Locale and Timezone configuration.
- NTP synchronization via Chrony.
- Creation of base filesystem structure (`/opt`, `/srv`, etc.).
- User management for `abbenden-srv` (admin) and `jenkins-srv` (CI/CD).
- SSH security hardening.
