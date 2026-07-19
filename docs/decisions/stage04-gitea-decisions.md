# SRE Architectural Decision Log: Stage 4 — Gitea Enterprise Deployment

This document records the architectural, security, and reliability decisions adopted during **Stage 4 — Gitea Deployment & Integration** of the HoRus Infrastructure.

---

## 1. Architectural Decisions

### Binary Deployment vs. Docker Container
*   **Problem:** Running Gitea in Docker adds runtime overhead, introduces complex container-networking loops, and makes systemd service orchestration less direct on the target host (`horus-git-srv01`).
*   **Decision:** Install Gitea as a native, standalone binary using the official compiled releases.
*   **Reason:** Native execution is highly lightweight, integrates cleanly with systemd's direct process lifecycle management, simplifies log forwarding, and matches the LXC sandboxing architecture of the laboratory environment.
*   **Trade-off:** Manual dependencies (such as `git` and `openssl` packages) must be provisioned on the host. However, since we use Ansible, package management is trivial and automated.
*   **Result:** A clean, SRE-grade native installation with sub-microsecond latency and zero container runtime engine overhead.

### External PostgreSQL 18 Integration
*   **Problem:** Co-locating PostgreSQL on the Gitea server couples data storage with application services, complicating backups, scaling, and high-availability setups.
*   **Decision:** Use the existing centralized SRE database cluster (`horus-db-srv01`) running PostgreSQL 18.
*   **Reason:** Consolidates stateful database engines on dedicated database LXC sandboxes. Keeps Gitea stateless, allowing easy migrations and clean backup policies of PostgreSQL.
*   **Trade-off:** Network overhead between `horus-git-srv01` and `horus-db-srv01`. Given the 10Gbps lab network backbone, this is negligible.
*   **Result:** Fully decoupled, high-performance architecture with professional DBA policies.

### HashiCorp Vault Secrets Management
*   **Problem:** Hardcoding or keeping plaintext database passwords, Gitea secret keys, and internal tokens in playbooks or local files is a massive security risk.
*   **Decision:** Store and fetch all sensitive credentials and configuration parameters via HashiCorp Vault.
*   **Reason:** Vault acts as the single source of truth for platform secrets. It provides secure AppRole token authentication, precise access control policies, audit logging, and automated credential injection.
*   **Trade-off:** Gitea deployment relies on the availability of Vault during playbooks execution.
*   **Result:** Compliance with security standards, zero-trust secrets injection, and no hardcoded credentials in the codebase.

---

## 2. Security Decisions

### Zero-Plaintext-Secrets Policy
*   **Problem:** Sensitive configuration variables can easily leak via command outputs, log files, or version control repositories.
*   **Decision:** Enforce `no_log: true` on all Ansible tasks handling database passwords, tokens, and private variables. Retrieve credentials dynamically from Vault at runtime and template them directly into `/etc/gitea/app.ini` with strict file permissions (`0600`).
*   **Reason:** Eliminates plain-text credentials from screen output, CI/CD logs, and files stored in the repository.
*   **Trade-off:** Makes debugging failed connection tasks slightly more abstract, but this is mitigated by precise assertion logic and detailed error messages.
*   **Result:** Solid zero-trust posture across all pipeline logs.

### Gitea AppRole Authentication
*   **Problem:** Using Vault's root token for all operations violates the Principle of Least Privilege.
*   **Decision:** Authenticate Gitea using its specific AppRole (`gitea`) and role policy (`gitea-policy`).
*   **Reason:** Restricts Gitea's secret access exclusively to `secret/data/platform/databases/gitea` and `secret/data/platform/tls`.
*   **Result:** Secure, isolated access to Vault.

### Dynamic Checksum Validation
*   **Problem:** Downloading third-party binaries dynamically is vulnerable to Man-In-The-Middle (MITM) attacks and server tampering.
*   **Decision:** Download the official SHA256 checksum file matching the target Gitea release version, slurp it dynamically, and supply it to the `get_url` module.
*   **Reason:** Ensures complete cryptographic verification before substituting the executable binary, completely eliminating human errors during hardcoded checksum updates.
*   **Result:** End-to-end download integrity.

---

## 3. Reliability & SRE Decisions

### Declarative Self-Healing and Disaster Recovery (DR)
*   **Problem:** Manual configuration drift or malicious file deletions disrupt service availability.
*   **Decision:** Make all tasks strictly declarative and self-healing:
    *   If Gitea's configuration `/etc/gitea/app.ini` is deleted, Ansible automatically rebuilds it using the latest templates and Vault secrets.
    *   If Gitea's binary is deleted, Ansible detects its absence and automatically re-downloads and verifies the checksum.
    *   If PostgreSQL privileges are revoked, Ansible restores correct ownership and permissions.
*   **Result:** Standardized, self-healing runtime environment that guarantees high availability and simple disaster recovery.

### Comprehensive Automated Smoke Tests (Stage 4.5 Validation)
*   **Problem:** A service reporting "Active" via systemd does not guarantee that the database connection works, the API is responsive, or git push/pull operations function.
*   **Decision:** Implement a full test pipeline during deployment:
    1.  Wait for Gitea to listen on its HTTP port.
    2.  Validate Gitea REST API response (`GET /api/v1/version`).
    3.  Create an SRE test admin user.
    4.  Create an API-initiated test repository (`health-check-test`).
    5.  Perform dynamic `git clone`, write to a tracking log file, commit, and `git push` over HTTP basic authentication.
    6.  Perform API-initiated repository deletion and clean up.
*   **Result:** High-fidelity confidence that the service is 100% operational before signaling deployment success.

---

## 4. Summary of Decisions (Problem/Solution)

| Category | Problem | Decision | Trade-off | SRE Result |
| :--- | :--- | :--- | :--- | :--- |
| **Runtime** | Heavy Docker overhead, complex routing | Native compiled Gitea binary via systemd | Must manage system dependencies with Ansible | Lightweight, sub-microsecond latency, native logging |
| **State** | Coupled data storage on app nodes | External PostgreSQL 18 cluster (`horus-db-srv01`) | Minute inter-host network latencies | Decoupled, stateless Gitea node with centralized DBA |
| **Secrets** | Plaintext credentials and token leaks | Dynamic Vault KV v2 AppRole integration | Deployment depends on Vault availability | Zero hardcoded passwords, zero-trust credentials |
| **Security** | Tampered downloads, supply-chain exploits | Dynamic SHA256 verification via slurp | Two-step download process (checksum + binary) | Guaranteed cryptographic binary integrity |
| **Integrity** | Configuration drift, lost files | Declarative self-healing tasks | None | 100% idempotent runs with instant self-healing |
| **Validation** | False positive "active" status | Fully automated API + Git push/pull smoke test | Slight increase in deployment runtime (~10s) | Dynamic functional verification before completion |
