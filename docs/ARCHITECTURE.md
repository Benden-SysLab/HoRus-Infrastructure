# Architectural Principles

This document defines the core architectural guidelines and design principles of the `HoRus` ecosystem. Adherence to these rules ensures that our infrastructure repository remains highly maintainable, testable, robust, and clean.

---

## The Core Ecosystem Architecture

To prevent tightly coupled infrastructure code and database dependencies, the HoRus ecosystem enforces a strict separation of concerns across multiple specialized repositories. Every project owns a singular domain:

```
                  ┌──────────────────────┐
                  │   HoRus-Bootstrap    │
                  └──────────┬───────────┘
                             │
                             ▼ (Creates physical/virtual hosts: VM/LXC)
                  ┌──────────────────────┐
                  │   HoRus-Inventory    │◀─── [Source of Truth (SoT)]
                  └──────────┬───────────┘
                             │
                             ▼ (Registers metadata, groups & vars)
                  ┌──────────────────────┐
                  │ HoRus-Infrastructure │◀─── [We Are Here]
                  └──────────┬───────────┘
                             │
                             ▼ (Applies baseline OS setup, packages & hardening)
                  ┌──────────────────────┐
                  │  HoRus-Control-Plane │
                  └──────────┬───────────┘
                             │
                             ├───────► Monitoring (Prometheus, Grafana)
                             ├───────► Logging (Grafana Loki, OpenTelemetry)
                             ├───────► Alerting & Notifications
                             └───────► Core Services (Authentik IAM, Wiki, Gitea)
```

---

## Architectural Principles

### 1. One Role — One Responsibility
Each Ansible role must serve a single, clear objective (e.g. baseline configuration, package management, application setup, system preparation). A role should never attempt to provision resources while simultaneously configuring application-specific business logic.

### 2. One Playbook — One Action
A playbook coordinates roles and tasks to perform a single concrete high-level flow (e.g. bootstrap baseline setup via `playbooks/common.yml`). Do not combine distinct deployment flows into a giant, multi-purpose monolithic playbook.

### 3. Infrastructure is Idempotent
Running a playbook once, twice, or a hundred times must yield exactly the same final system state. All tasks must be safe to re-execute. If a task is not inherently idempotent, use `changed_when` or condition guards to maintain predictability.

### 4. Infrastructure is Orchestration-Agnostic
Our roles and playbooks must never make assumptions about the scheduler or runner executing them (e.g., Jenkins, AWX, Semaphore UI). This repository does not implement its own execution pipelines. Orchestration is decoupled: we provide the robust execution mechanism, while external schedulers act as runners.

### 5. Inventory is the Source of Truth (SoT)
The system parameters must reside in a centralized inventory repository (`HoRus-Inventory`). Individual repositories do not maintain separate duplicate lists of hosts or variables, completely eliminating configuration drift.

### 6. Secrets are Never Stored in Git
Sensitive information (passwords, private SSH keys, TLS keys) must never be checked into version control. Standard password/key generation scripts (`auto_prepare.py`) are used to securely process and write local, gitignored secret inventories and plaintext backups (`secrets_plain.txt`).

### 7. Roles are Independently Testable
Every role must be testable in an isolated sandbox. This project uses **Molecule** with a **Podman** container driver running **Debian 13 (Trixie)** to quickly and repeatedly verify the baseline configuration of every single task block.

### 8. Quality Assurance is Non-Negotiable
Every contribution must successfully pass:
-   Syntax and structural checks (`yamllint`)
-   Ansible best-practice compliance audits (`ansible-lint`)
-   Molecule convergence tests (`molecule test`)
-   Local Git hooks pre-commit validations (`pre-commit`)
