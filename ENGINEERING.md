# HoRus Engineering & Contribution Guidelines

This document establishes the unified engineering principles, standards, and practices for all repositories within the **HoRus** ecosystem. Adherence to these standards is mandatory to ensure maintainability, security, scalability, and consistency across the entire infrastructure lifecycle.

---

## 🏛️ Core Principles

### 1. Single Responsibility (Одна роль — одна ответственность)
Each Ansible role, script, or component must do **one thing** and do it perfectly. 
- Avoid monolithic roles that configure multiple, unrelated services (e.g., do not bundle database installation with web-server configuration).
- Keep playbooks lean, and delegate individual configuration blocks to highly modular, self-contained roles.

### 2. Native First, Shell as Last Resort (Встроенные модули вместо shell)
Always prefer native, built-in Ansible modules (`ansible.builtin.*`, `community.general.*`) over executing raw bash commands via `ansible.builtin.shell` or `ansible.builtin.command`.
- **Why**: Native Ansible modules handle state tracking, error catching, logging, and platform-specific quirks automatically.
- **Exception**: Shell/command is permitted only when a dedicated module does not exist, or when running custom initialization binaries/scripts. When used, you **must** define `changed_when` to preserve clean output and state tracking.

### 3. Strict Idempotency (Идемпотентность обязательна)
Every playbook, role, task, and script must be fully **idempotent**.
- Running the configuration suite once, twice, or a hundred times on the same target must produce the exact same system state without causing side effects or redundant actions.
- All non-native custom scripts (like `generate_ssh_keys.sh` or Python pre-flights) must perform pre-checks to confirm whether the targeted state is already satisfied before making modifications.

### 4. Zero Secrets in Version Control (Никаких секретов в Git)
Under no circumstances should plain secrets, raw private keys, API tokens, or actual server passwords be committed to Git.
- Use `vault_inventory.yml` (and template structures) excluded by `.gitignore` for local testing.
- Utilize Ansible Vault, environmental variables, or an external Secrets Manager (HashiCorp Vault, cloud-native secret managers) for production keys.
- Add sensitive files to the project `.gitignore` from day one.

### 5. Explicit Variable Parameterization (Все через переменные)
"Magic constants" and hardcoded configuration values are strictly forbidden.
- Extract usernames, paths, ports, proxy addresses, package lists, and options into `group_vars`, `host_vars`, or role defaults.
- Keep structural values (such as filesystem directories) and operational variables logically structured inside YAML configurations.

### 6. Explicit Lifecycle Boundaries (Четкие границы жизненного цикла)
Each repository in the HoRus ecosystem is strictly scoped to a specific stage of the infrastructure lifecycle. No repository should perform tasks belonging to its neighboring phases.
- **Stage 1 (HoRus-Infrastructure)**: Only prepares the base OS, manages packages, configures timezone/locales, configures users, and hardens SSH. It does **not** install application-level container runtimes, web-servers, or business databases.
- **Stage 2 (HoRus-Control-Plane)**: Deploys network fabrics, orchestrators, and system service architectures (such as Docker, Kubernetes, database pools).
- **Stage 3 (HoRus-Applications)**: Deploys actual user-facing and media/AI services on top of the established control plane.

---

## 🛠️ Ansible Coding Standards

### Task Naming
Every task must have a clear, descriptive `name` in Title Case describing the business action, not the command syntax:
```yaml
# ❌ Bad
- name: run apt
  ansible.builtin.apt:
    name: nginx

#  Good
- name: Install Nginx Web Server Package
  ansible.builtin.apt:
    name: nginx
    state: present
```

### Formatting
- Use standard YAML formatting with **2-space indentation**.
- Always specify module names with their fully qualified collection names (e.g., `ansible.builtin.template` instead of just `template`).
- Ensure templates (`.j2`) are well-commented and explicitly mention the source variable structure.

---

## 🤝 How to Contribute

1. **Setup Environment**: Initialize the pre-flight checks using `python3 bootstrap/auto_prepare.py` to auto-heal your local secrets.
2. **Feature Branches**: Always branch off `main` and name your branch based on the stage and feature (e.g., `feature/stage1-chrony-hardening`).
3. **Validate**: Always run `ansible-playbook --check` and lint playbooks prior to submission.
4. **Pull Requests**: Ensure your PR matches the scope of a single lifecycle stage.
