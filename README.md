# HoRus-Infrastructure

<p align="center">
  <img src="assets/logo.png" alt="HoRus Logo" width="180"/>
</p>

![Ansible](https://img.shields.io/badge/Ansible-2.19.4-black?style=flat-square&logo=ansible)
![Debian](https://img.shields.io/badge/Debian-13_(Trixie)-D70A53?style=flat-square&logo=debian)
![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=flat-square)

Production-grade Infrastructure-as-Code platform for preparing Debian-based systems for high-availability service deployment.

## Project Overview

HoRus-Infrastructure is responsible for preparing freshly installed Debian 13 (Trixie) systems. This project encompasses:
- **Stage 1**: Operating System Bootstrap & Security Hardening (`common` role).
- **Stage 2**: Production-ready PostgreSQL 18 Database Server Deployment (`postgresql` role).

## Directory Structure

```text
HoRus-Infrastructure/
├── ansible.cfg            # Ansible configuration defaults
├── requirements.yml      # External collections
├── inventory/            # Host inventory and variables
│   ├── syslab_hosts.yml  # Source of truth for hosts
│   └── group_vars/       # Group and secret variables
│       ├── all.yml        # Global parameters
│       └── postgresql.yml # PostgreSQL server parameters
├── bootstrap/            # Pre-deployment assets
│   ├── ssh/              # Management scripts for SSH keys
│   └── certs/            # Placeholder for PKI assets
├── playbooks/            # Deployment entry points
│   ├── common.yml        # Stage 1 OS bootstrap entry point
│   └── postgresql.yml    # Stage 2 PostgreSQL server entry point
└── roles/                # Modular infrastructure logic
    ├── common/           # OS bootstrap and hardening
    ├── download/         # Reusable download abstraction
    ├── molecule_prepare/ # Bootstrap environment for tests
    ├── postgresql/       # PostgreSQL 18 server deployment
    └── tests/            # System validation suite
```


## Quick Start (Installation & Deployment)

1. **Install Dependencies**:
   ```bash
   ansible-galaxy collection install -r requirements.yml
   ```

2. **Generate Passwords & Bootstrapping Secrets**:
   Before running the playbooks, you must prepare the secret variables and SSH keys. You can do this by manually running the bootstrap script, or let the `common` playbook run it automatically.
   
   *   **Manual Generation**:
       ```bash
       python3 bootstrap/auto_prepare.py
       ```
   *   **What this does**:
       - Creates `inventory/group_vars/vault_inventory.yml` from `inventory/group_vars/vault_inventory.yml.template` if it doesn't already exist.
       - Generates cryptographically secure 256-character plaintext passwords and corresponding SHA-512 crypt hashes for administrative and service users.
       - Saves the plaintext versions safely in `bootstrap/secrets_plain.txt` (this file is excluded via `.gitignore` to prevent leaks). No passwords are printed to `stdout` to avoid CI/CD or terminal log exposure.
       - Generates the required SSH ED25519 keypairs for `root`, `admin`, and `jenkins` inside `bootstrap/ssh/`.
   
   **Customization**: By default, the main administrative user is configured as `root` inside the Git-excluded `vault_inventory.yml`. You can easily change this (e.g., to `abbenden-srv` or any other username), customize the private/public key paths, or configure your own passwords. The pre-flight generator script dynamically parses your `vault_inventory.yml` and generates the corresponding keys and secure passwords on-the-fly at your customized paths!

3. **Deploy & Harden Infrastructure**:
   - **Stage 1 (OS Hardening & Bootstrap)**:
     ```bash
     ansible-playbook -i inventory/syslab_hosts.yml playbooks/common.yml
     ```
   - **Stage 2 & 3.1 (PostgreSQL Server & Service Databases Provisioning)**:
     ```bash
     ansible-playbook -i inventory/syslab_hosts.yml playbooks/postgresql.yml
     ```

## Stage 3: Service Databases, Access Hardening, and HashiCorp Vault Integration

This Stage handles the complete deployment of platform service storage backends, credential management, security baselines, and enterprise secrets management via HashiCorp Vault.

### Stage 3.1: PostgreSQL Service Databases & Access Hardening
Deploys and hardens databases for platform services following the **Least Privilege Principle**. 
- **Single Source of Truth**: All service configuration metadata lives in `inventory/group_vars/all.yml` under the `platform_services` dictionary namespace.
- **Access Hardening**: Revokes `PUBLIC CONNECT` on all databases and limits connections strictly to the service owners.
- **Verification**: Validates correct database ownership and TCP/IP SCRAM authentication via localhost.

### Stage 3.2 - 3.5: HashiCorp Vault Enterprise Orchestration
Deploys a robust, secure, and production-ready **HashiCorp Vault** deployment.

1. **High-Availability Storage Backend**: Configured to run on PostgreSQL with systemd service orchestration and full configuration hardening.
2. **Automated Initialization & Unsealing**: On first boot, Vault is initialized, and secure unseal/root credentials are automatically generated and securely saved locally inside `runtime/vault/` (with strict `0600` permissions and git-excluded). Subsequent runs automatically load recovery keys and perform unsealing seamlessly.
3. **AppRole Authentication Engine (Root Token Ban)**: Enforces complete restriction of Root Token usage. Platform services (`jenkins`, `gitea`, `harbor`, `authentik`) authenticate using secure, isolated AppRoles bound to strict, minimal HCL policies.
4. **Secrets Bootstrapping (JSON Pipe-lining)**: Writes initial service credentials, TLS keys, Docker, and GitHub keys into Vault. Standard CLI inputs are bypassed; credentials are piped as structured JSON to ensure high safety against special characters and shell escaping issues.
5. **Advanced SRE Validation & Health Checks**:
   - **Full-API Smoke-Test**: Performs live KV write, KV read, KV destroy, and KV metadata deletion checks on dedicated internal paths (`secret/system/healthcheck`).
   - **AppRole Smoke-Test**: Exercises full authentication, token generation, and policy verification by logging in under service AppRoles and asserting readability.
   - **PostgreSQL Context Checks**: Asserts PostgreSQL table ownership and validates read-access (`SELECT COUNT(*)`) under the restricted `vault` role.
   - **TLS Certificate Validation**: Inspects SSL/TLS SANs and verifies certificate expiration thresholds (>7 days) natively via OpenSSL commands.
   - **Local Backup Validation**: Assures integrity and format of local backup credentials (`init.json`, `recovery.json`, `approles.json`).
   - **Version Drift Check**: Compares desired version with actual installed version and logs warning alerts on mismatches.
   - **Optional Performance Benchmarks**: Sequential KV latency performance measurement (measuring total/avg milliseconds per operation).
6. **Self-Healing Disaster Recovery**: Automatically corrects configuration drifts, restores table owners/privileges, repairs missing systemd unit files, and restores tampered/deleted `vault.hcl` settings.

## Useful Commands

- **Ping all hosts**: `ansible all -m ping`
- **Check mode (Dry run)**: `ansible-playbook playbooks/common.yml --check`
- **Limit execution to a specific host**: `ansible-playbook -i inventory/syslab_hosts.yml playbooks/common.yml --limit horus-db-srv01`
- **Run all bootstrap playbooks**:
  ```bash
  ansible-playbook -i inventory/syslab_hosts.yml playbooks/common.yml
  ansible-playbook -i inventory/syslab_hosts.yml playbooks/postgresql.yml
  ```
- **Run individual playbook (PostgreSQL)**:
  ```bash
  ansible-playbook -i inventory/syslab_hosts.yml playbooks/postgresql.yml
  ```


## Quality Assurance & Testing

To maintain high code quality and reliability, this project integrates several validation and linting tools:

*   **yamllint**: A linter for YAML files to ensure strict adherence to style rules (e.g. indentation, spacing, and structural validity). Configured via `.yamllint`.
    *   *Run manually*: `yamllint .`
*   **ansible-lint**: A specialized best-practices checker for Ansible playbooks, roles, and configuration files. Configured via `.ansible-lint`.
    *   *Run manually*: `ansible-lint`
*   **pre-commit**: A framework for managing multi-language pre-commit hooks. It runs **entirely locally on the developer's workstation** before a commit is even recorded in Git. It is completely independent of any server-side Git hosting platforms like Gitea, GitHub, or GitLab.
    *   *Install hooks*: `pre-commit install`
    *   *Run manually on all files*: `pre-commit run --all-files`
*   **Molecule**: A testing tool designed to aid in development and testing of Ansible roles. It spins up a temporary target container, runs your role tasks, and verifies that the playbook compiles and runs successfully.
    *   *Driver*: **Podman** is used as the lightweight container driver for complete environment isolation.
    *   *OS Target*: Tested specifically against **Debian 13 (Trixie)** to match the production target.
    *   *Preparation Role*: Integrates `molecule_prepare` to install prerequisites (Python 3, python3-apt, sudo) into the clean container image prior to verifying the core `common` role.
    *   *Run test scenario*: `molecule test`

## Architecture & Future Evolution

### 1. Centralized Source of Truth (HoRus-Inventory)
Currently, the host inventory lives in `inventory/syslab_hosts.yml`. However, the long-term architecture designates a separate repository **`HoRus-Inventory`** as the absolute **Source of Truth (SoT)** for the entire ecosystem.
*   **Source of Truth (SoT)**: Serves as the single repository of all host metadata, groups, and variables shared across all HoRus projects.
*   No project maintains its own independent host list, preventing configuration drift across different environments.

### 2. Decoupled Pipeline & Responsibilities
Each repository in the HoRus family has a single, strictly defined responsibility. They are completely decoupled and interact sequentially:

```
HoRus-Bootstrap
        │
        ▼ (Creates physical/virtual servers, i.e., VM/LXC)
        │
HoRus-Inventory (Source of Truth)
        │
        ▼ (Registers new host metadata and variables)
        │
HoRus-Infrastructure (Bootstrap Infrastructure / OS Hardening)
        │
        ▼ (Applies baseline packages, security settings, and SSH hardening)
        │
HoRus-Control-Plane
        ├── Monitoring (Prometheus/Grafana)
        ├── Logging & Observability (Grafana Loki, OpenTelemetry)
        ├── Alerting
        └── Shared Core Services (Authentik IAM, Wiki, Gitea)
```

### 3. Automated Bootstrap Execution (Future Work)
The project is designed to support event-driven execution:
*   **Event flow**: After a new host is registered in the central **Source of Truth** (`HoRus-Inventory`), an external orchestration system (such as Jenkins, AWX, Semaphore UI, or another scheduler/orchestrator) executes:
    ```bash
    ansible-playbook playbooks/common.yml --limit <host>
    ```
*   **Decoupled Orchestration**: This repository intentionally **does not implement orchestration itself**. It purely provides the clean, modular, and idempotent bootstrap mechanism. The runner/scheduler is completely decoupled from the repository content.
*   **Result**: The server is automatically bootstrapped, hardened, and made ready without manual operator intervention.

## Roadmap

- [x] **Stage 1**: Common Operating System Bootstrap & Hardening.
- [x] **Stage 2**: PostgreSQL 18 Production-ready Database Server Deployment.
- [x] **Stage 3.1**: PostgreSQL Service Preparation (Databases, Users & Access Hardening).
- [x] **Stage 3.2 - 3.5**: HashiCorp Vault Integration (Deployment, Policies & AppRoles, Secrets Bootstrap, SRE Validation & Self-Healing Disaster Recovery).
- [ ] **Stage 4**: HoRus Control Plane deployment (Authentik, Gitea, Jenkins, Harbor, Monitoring).


## Engineering Standards

To keep the project clean, predictable, and highly scalable, all contributions and role structures must adhere to the unified [HoRus Engineering & Contribution Guidelines](ENGINEERING.md).

## License
Apache-2.0
