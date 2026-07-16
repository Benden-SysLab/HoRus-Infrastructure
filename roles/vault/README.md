# Vault Role — HoRus Infrastructure Platform

This role automates the installation, configuration, initialization, unsealing, hardening, and service onboarding of **HashiCorp Vault** using a PostgreSQL storage backend.

## Design Highlights

1. **Fully Automated Orchestration**: Vault is installed from the official HashiCorp stable repository, configured as a systemd service, initialized automatically, and unsealed seamlessly using Ansible-managed secure local key orchestration.
2. **PostgreSQL Storage Backend**: Vault uses the highly available PostgreSQL database initialized in Stage 3.1 (`vault` database, `vault` user) as its high-performance persistence layer.
3. **AppRole Authentication Engine**: In HoRus, root tokens are strictly prohibited for system access. All platform services (`jenkins`, `gitea`, `harbor`, `authentik`) authenticate exclusively using AppRoles with scoped policies.
4. **Fine-Grained HCL Policies**: Custom templates define precise access control for secrets paths per service, enforcing the principle of least privilege.
5. **Idempotent Secrets Management**: During reruns, the playbook checks if secrets already exist before attempting a `vault kv put`. This prevents unnecessary version bumps and retains your custom updated credentials intact.
6. **Self-Healing Disaster Recovery**: Automatically checks and heals configuration drifts, repairs missing systemd unit files, fixes database table ownerships, and restores revoked grants for the `vault` database role on the fly.
7. **Advanced SRE Validations & Health Checks**:
   - **Vault API & KV Smoke-Test**: Runs writing, reading, destroying, and metadata-deletion validation routines on a temporary path (`secret/system/healthcheck`).
   - **AppRole Login Verification**: Verifies full credentials by logging in with each service's AppRole and testing its read permissions.
   - **PostgreSQL Context Verification**: Asserts table ownership and database privileges under the `vault` role context, including record reading tests.
   - **Local Backup Validation**: Checks for the existence and structure of `init.json`, `recovery.json`, and `approles.json` local files.
   - **TLS Certificate Checks**: Natively validates SSL expiration threshold (>7 days) and SAN listings via OpenSSL tools.
   - **Version Drift & Latency Benchmarks**: Flags version mismatches and executes milliseconds-level sequential KV performance testing.
8. **Future-Proof PKI Readiness**: Pre-configured paths for the Vault PKI engine are defined in all policy roles, laying the groundwork for automated dynamic SSL/TLS certificate issuance in upcoming stages.

---

## Directory Structure of Secure Bootstrap Materials

All sensitive materials generated during Vault's initial deployment are stored locally on the Ansible Control Node in the **`bootstrap/vault/`** directory. This directory is excluded from Git via `.gitignore`:

```text
bootstrap/
└── vault/
    ├── init.json         # Raw output from 'vault operator init'
    ├── recovery.json     # Extracted 5 base64 unseal keys (restricted to 0600)
    ├── root_token.txt    # Vault initial Root Token (restricted to 0600)
    └── approles.json     # Dict mapping services to RoleID and SecretID (restricted to 0600)
```

---

## SecretID Rotation (Day-2 Operations)

To maintain a secure infrastructure, you must periodically rotate service SecretIDs without invalidating the existing infrastructure configurations.

We have provided a dedicated playbook **`playbooks/vault_rotate_secretid.yml`** to handle this gracefully:

### Usage

To rotate the SecretID of a specific service (e.g. `jenkins`):

```bash
ansible-playbook playbooks/vault_rotate_secretid.yml -e "target_service=jenkins"
```

The playbook will:
1. Verify the Vault seal status (and automatically unseal it using local recovery keys if needed).
2. Generate a new SecretID for the target AppRole role.
3. Retrieve the RoleID to match.
4. Safely overwrite the secret pair inside `bootstrap/vault/approles.json` on the control machine.
5. Provide a printout of the new credentials so they can be integrated into Jenkins, etc.

---

## Crucial Backup and Recovery Strategy (Disaster Recovery)

Because the Ansible Control Node acts as the custodian of the initial secret keys, **losing the `bootstrap/vault/` folder means a total loss of access to Vault administrative controls and automated unseal functionality.**

### 1. What to Backup
You must back up the following files immediately after the initial deployment:
- `bootstrap/vault/root_token.txt` (Administrative master key)
- `bootstrap/vault/recovery.json` (Cluster unsealing keys)
- `bootstrap/vault/approles.json` (Service credentials database)

### 2. Recommended Backup Locations
- **Secure Password Manager**: Store the root token and unseal keys in a vault like 1Password, Bitwarden, or KeePass.
- **Encrypted USB/Cold Storage**: Keep a Copy of `bootstrap/vault` on an encrypted external drive.
- **Enterprise HSM/KMS Integration**: In enterprise architectures, migrate the Vault configuration to use AWS KMS, GCP KMS, or Azure Key Vault for fully-automated KMS Auto-Unseal.

### 3. Recovery Procedure (If Control Node is Lost)
If the control node is destroyed but the database server survives:
1. Re-deploy the control node.
2. Restore `bootstrap/vault/` from your secure backup.
3. Run the playbooks; Ansible will detect that `init.json` exists, load the unseal keys, and successfully unseal/authenticate against the running cluster without any data loss.
