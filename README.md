# HoRus-Infrastructure

![Ansible](https://img.shields.io/badge/Ansible-2.19.4-black?style=flat-square&logo=ansible)
![Debian](https://img.shields.io/badge/Debian-13_(Trixie)-D70A53?style=flat-square&logo=debian)
![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=flat-square)

Production-grade Infrastructure-as-Code platform for preparing Debian-based systems for high-availability service deployment.

## Project Overview

HoRus-Infrastructure is responsible for preparing freshly installed Debian 13 (Trixie) systems. This is the **Stage 1** of the HoRus ecosystem, focusing on OS bootstrap and security hardening.

## Directory Structure

```text
HoRus-Infrastructure/
├── ansible.cfg            # Ansible configuration defaults
├── requirements.yml      # External collections
├── inventory/            # Host inventory and variables
│   ├── syslab_hosts.yml  # Source of truth for hosts
│   └── group_vars/       # Global and secret variables
├── bootstrap/            # Pre-deployment assets
│   ├── ssh/              # Management scripts for SSH keys
│   └── certs/            # Placeholder for PKI assets
├── playbooks/            # Deployment entry points
└── roles/                # Modular infrastructure logic
    ├── common/           # OS bootstrap and hardening
    ├── download/         # Reusable download abstraction
    └── tests/            # Stage 1 validation suite
```

## Quick Start

1. **Install Dependencies**:
   ```bash
   ansible-galaxy collection install -r requirements.yml
   ```

2. **Run Bootstrap (with Auto-healing & Auto-generation)**:
   The playbook features built-in pre-flight auto-healing. Running the playbook will automatically generate any missing SSH keys inside `bootstrap/ssh/` (e.g. `root` and `jenkins-srv`) and securely auto-generate custom 256-character strong passwords (with automatic SHA-512 crypt hashing) inside `inventory/group_vars/vault_inventory.yml` if default placeholder passwords are detected.
   
   **Customization**: By default, the main administrative user is configured as `root` inside the Git-excluded `vault_inventory.yml`. You can easily change this (e.g., to `abbenden-srv` or any other username), customize the private/public key paths, or configure your own passwords. The pre-flight generator script dynamically parses your `vault_inventory.yml` and generates the corresponding keys and secure passwords on-the-fly at your customized paths!
   
   ```bash
   ansible-playbook -i inventory/syslab_hosts.yml playbooks/common.yml
   ```

   *(Optional)* If you only want to generate keys manually without running the playbook:
   ```bash
   ./bootstrap/ssh/generate_ssh_keys.sh
   ```

## Useful Commands

- **Ping all hosts**: `ansible all -m ping`
- **Check mode**: `ansible-playbook playbooks/common.yml --check`
- **Limit execution to a specific host**: `ansible-playbook -i inventory/syslab_hosts.yml playbooks/common.yml --limit horus-db-srv01`
- **Run individual playbook**:
  ```bash
  ansible-playbook -i inventory/syslab_hosts.yml playbooks/common.yml
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

- [x] **Stage 1**: Common Operating System Bootstrap.
- [ ] **Stage 2**: Network and Storage Infrastructure.
- [ ] **Stage 3**: HoRus Control Plane deployment.

## Engineering Standards

To keep the project clean, predictable, and highly scalable, all contributions and role structures must adhere to the unified [HoRus Engineering & Contribution Guidelines](ENGINEERING.md).

## License
Apache-2.0
