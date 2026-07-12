# Infrastructure Development Workflow & QA Lifecycle

This document describes the complete developer workflow and quality assurance (QA) lifecycle for the `HoRus-Infrastructure` project. Adhering to this lifecycle ensures that all changes are thoroughly validated, formatted, and tested prior to being published.

---

## The Development Lifecycle (Step-by-Step)

The typical development loop for implementing new features, modifying roles, or updating playbooks follows a highly structured flow:

```
[1] Modify Code (Role/Playbook)
          │
          ▼
[2] Dry-Run Verification (ansible-playbook --check)
          │
          ▼
[3] Static Analysis (yamllint)
          │
          ▼
[4] Best Practices Check (ansible-lint)
          │
          ▼
[5] Local Integration Testing (molecule test)
          │
          ▼
[6] Local Git Commit (git commit)
          │
          ▼
[7] pre-commit Hook Verification (triggered automatically)
          │
          ▼
[8] Remote Push (git push)
```

---

### Step 1: Modify Code

Make your structural or variable changes inside the respective role (e.g. `roles/common/`) or playbooks (e.g. `playbooks/`). 
*   Ensure that any new configuration variables are defined in templates or group variables.
*   Always preserve backward compatibility.

### Step 2: Dry-Run Verification

Before any code execution, check if your playbooks compile and run in dry-run (check) mode on the development hosts:
```bash
ansible-playbook -i inventory/syslab_hosts.yml playbooks/common.yml --check
```

### Step 3: Run Static Analysis (`yamllint`)

Check that all altered YAML files strictly comply with the project styling guidelines (spaces, indentation, hyphen usage):
```bash
yamllint .
```
*Configured via `.yamllint`.*

### Step 4: Run Ansible Best Practices (`ansible-lint`)

Run `ansible-lint` to check for deprecated syntax, style guidelines, and correct structure in all playbooks and roles:
```bash
ansible-lint
```
*Configured via `.ansible-lint`.*

### Step 5: Local Integration Testing via Molecule (`molecule test`)

Verify your changes against the target production OS — **Debian 13 (Trixie)** — in a fully isolated container using Podman:
```bash
molecule test
```
*   Molecule spins up a lightweight Podman container running `debian:13-slim` without heavy systemd cgroup complexity.
*   It executes the `molecule_prepare` role to bootstrap prerequisites (Python 3, python3-apt, sudo) into the clean container image.
*   It gathers Ansible facts and then executes the core `common` role, verifying that the role compiles and applies successfully.

### Step 6: Create a Local Git Commit

Stage your verified files and initiate a commit:
```bash
git add .
git commit -m "feat: implement secure user provisioning and SSH hardening"
```

### Step 7: Automatic Hook Verification (`pre-commit`)

Upon executing `git commit`, the local **`pre-commit`** framework automatically intercepts the action and executes a chain of hooks:
1.  `trailing-whitespace` — Removes extra whitespace at the end of lines.
2.  `end-of-file-fixer` — Ensures all files end with a trailing newline.
3.  `check-merge-conflict` — Prevents committing unmerged conflict markers.
4.  `check-added-large-files` — Screens out files larger than 500KB.
5.  `check-yaml` — Validates structural syntax of all YAML files.
6.  `yamllint` — Validates formatting of all modified files.
7.  `ansible-lint` — Runs best-practices checking on modified Ansible files.

> 💡 **Important:** `pre-commit` operates **exclusively locally on your workstation**. It does not depend on, nor does it require any server-side platforms (such as Gitea, GitHub, or GitLab). This makes it a developer's primary shield against bad formatting and syntactical bugs *before* code leaves their machine.

*   **Tip:** To manually trigger all hooks across all files at any time:
    ```bash
    pre-commit run --all-files
    ```

### Step 8: Remote Push

Once the local hooks run successfully and the commit is recorded, push your changes to your remote hosting server (e.g. Gitea/GitHub/GitLab):
```bash
git push origin main
```

---

## Why This Workflow Matters

Implementing this process ensures:
1.  **Impeccable Quality**: No unformatted code, styling issues, or broken playbooks reach the remote repository.
2.  **Impediment Prevention**: Teammates can pull changes with absolute confidence.
3.  **Production Readiness**: This structured flow demonstrates clean engineering standards to prospective clients and technical recruiters.
