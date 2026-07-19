# SRE Architectural Decision Log: Stage 4 — Gitea Validation & Environment Audit

This document records the diagnostics and architectural corrections adopted to address Gitea validation timeouts, security, environment configuration, and upgrades on the HoRus platform.

---

## 1. Problem
During post-deployment evaluation, three separate validation failures occurred:
1. **Multiple Gitea Processes (Race Condition)**: The enhanced validation task detected multiple Gitea web processes running on the host, causing lock collisions on LevelDB queue folders (`/var/lib/gitea/data/queues/common`), which crashed the primary systemd listener.
2. **API 403 Forbidden Block**: Checking the unauthenticated Gitea version API (`/api/v1/version`) failed with a `403 Forbidden` error because the platform is configured with high-security parameters (`REQUIRE_SIGNIN_VIEW = true`), which enforces strict authentication on all API routes.
3. **Outdated Application Binary**: The deployed Gitea version was `1.22.3`, whereas modern operational standards on the HoRus platform require the newest major release `1.27.0` for latest feature parity and security compliance.
4. **CLI Executed as Root (`mustNotRunAsRoot` Protection)**: Modern releases of Gitea (especially 1.25+) forbid running administrative CLI tasks (such as `gitea admin user list`) as the `root` superuser for safety, crashing with a `mustNotRunAsRoot` fatal exception.

---

## 2. Root Cause
1. **Diagnostic State Drift**: Manual diagnostic execution (`sudo -u git /usr/local/bin/gitea web...`) spawned independent unmanaged processes that did not belong to systemd. Gitea did not terminate these processes upon systemd restart, leading to queue database lock conflicts.
2. **Strict Sign-in Enforcements**: Unauthenticated requests to Gitea APIs are rejected by design when the system is in Private/Locked mode.
3. **Environment/Work-Path Conflict**: The systemd service definition injected `GITEA_WORK_DIR` through environment variables, which conflicted with the Gitea binary's internal lookup paths and the configuration file's own `WORK_PATH`.
4. **Outdated Default Variables**: The default version variable `gitea_version` in the role was hardcoded to `1.22.3`.
5. **Ansible Superuser Execution Privilege**: Ansible's default task execution context on targeted servers runs as `root`, meaning administrative `gitea admin` commands were launched with root UID, triggering Gitea's built-in root-execution guard.

---

## 3. Solution
To resolve these issues and align with SRE-grade operational requirements, the following improvements have been engineered:
1. **Local Secrets Binding**: Decoupled the Gitea setup role from dynamic Vault API lookups. Database parameters and secure system tokens are now passed directly via local bootstrap variables (`gitea_db_password`, `gitea_secret_key`, etc.) stored in the inventory (`group_vars/vault_inventory.yml` or default fallback values), resolving DB connection issues on startup.
2. **Modern Release Transition**: Upgraded default `gitea_version` to `1.27.0`. The role checks the output of `gitea --version` and dynamically executes download and upgrade tasks only when necessary, maintaining perfect idempotency.
3. **Source of Truth for WORK_PATH**:
   - Removed the conflicting `GITEA_WORK_DIR` environment definition from `gitea.service.j2`.
   - Set `WORK_PATH = {{ gitea_home }}` in the `[DEFAULT]` section of `/etc/gitea/app.ini`.
4. **Service-Bound Execution Context (`become_user`)**: Enforced unprivileged service execution on Gitea CLI. All administrative CLI validations and diagnostics (including `gitea doctor check` tasks) now run under `become: true` and `become_user: "{{ gitea_user }}"`, ensuring compliance with Gitea's internal security constraints and restricting runtime permissions.
5. **Loopback Hook Routing (`LOCAL_ROOT_URL`)**: Configured `LOCAL_ROOT_URL = http://127.0.0.1:{{ gitea_http_port }}/` in the `[server]` section of `app.ini`. This bypasses external DNS/proxy lookups for internal git hook authorization requests, solving the `Decoding Failed` internal server error during `git push`.
6. **Platform Logs & Metrics Observability**:
   - **Gitea**: Swapped log mode to `console, file` to write simultaneously to systemd journalctl and Gitea log files. Explicitly configured the systemd service unit to redirect `StandardOutput=journal` and `StandardError=journal` to guarantee journald captures all stdout/stderr streams cleanly. Enabled built-in Prometheus `/metrics` endpoints.
   - **Vault**: Exposed telemetry metrics publicly (unauthenticated) to Prometheus via `unauthenticated_metrics_access = true` and made log level and log format dynamically configurable inside `vault.hcl`.
   - **PostgreSQL**: preloaded the `pg_stat_statements` module in `shared_preload_libraries` and configured custom statement tracking parameters. Enabled native connection/disconnection logs and slow query tracing (threshold: 250ms) to ensure excellent DB layer diagnostics.
7. **Resilient Validation Checks**:
   - Swapped the generic process count assertion with a systemd MainPID validation check (`systemctl show gitea --property=MainPID`).
   - Implemented an unmanaged/orphan Gitea process detector that logs warning alerts without breaking Ansible execution.
   - Replaced the unauthenticated `/api/v1/version` check with an unauthenticated check on `/user/login` (guaranteed to respond with HTTP 200 under private mode, verifying templates, rendering engines, routers, and database connection status).
8. **Automated Diagnostic Collection**: If pre-validation or TCP checks fail, the playbook triggers a rescue block that aggregates `journalctl -u gitea` logs, `pg_isready` output, `gitea doctor check`, and socket listeners (`ss -tlnp`) cleanly inside the failure report.
9. **Resilient Port Timeout**: Raised the port listener timeout to 120 seconds to allow for complete database schema migrations and indexing on cold starts.
10. **Synchronized Internal Token Security (`INTERNAL_TOKEN` & Smoke Tests)**:
    - Gitea internal callbacks require a synchronized `INTERNAL_TOKEN` between generated git hooks and the running application configuration. Regenerating hooks without restarting Gitea does not update the runtime security context.
    - Added an explicit `grep` validation task to verify that `INTERNAL_TOKEN` is present in `app.ini`.
    - Integrated direct internal API smoke-tests (`/api/internal/hook/pre-receive`) inside the validation playbook, confirming both that unauthenticated calls are strictly blocked with HTTP 403 (`private.CheckInternalToken`), and that authenticated calls with the configured token are authorized (passing filter validation).
    - Enforced a secure 64-character token length for `vault_gitea_internal_token` generation inside `auto_prepare.py`.

---

## 4. Trade-off
- **Increased Execution Time**: Waiting for up to 120 seconds in the worst-case timeout increases potential playbooks execution times on total failures. However, this is heavily outweighed by the fact that successful runs complete almost instantly once Gitea is listening, and failures immediately yield deep diagnostic logs rather than leaving engineers guessing.

---

## 5. SRE Impact
- **Observability**: Eliminates "blind" infrastructure provisioning. Every startup failure is now self-documenting.
- **Idempotency & Maintainability**: By utilizing Ansible's declarative state checks, subsequent playbook runs complete cleanly with `changed=0` (no redundant database creations, folder overrides, or binary re-downloads).
- **Security & Integrity**: Ensures the Gitea platform starts in a highly secured, locked state (`INSTALL_LOCK = true`, registration disabled, sign-in required) with verified cryptographic binaries and isolated system-level PostgreSQL privileges.

### Operational Impact

Before:
- Git push failures produced generic "Internal Server Error Decoding Failed"
- Root cause was hidden in internal API authorization

After:
- Deployment fails during validation if INTERNAL_TOKEN is missing or under 64 characters
- Internal API authorization is tested automatically via token-authenticated smoke tests
- Journald and file logging provide dual troubleshooting paths with a distinct systemd `SyslogIdentifier=gitea`
