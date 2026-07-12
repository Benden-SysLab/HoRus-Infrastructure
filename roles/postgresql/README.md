# Role: PostgreSQL 18 Server

This role deploys and configures a production-ready PostgreSQL 18 server on **Debian 13 (Trixie)** from the official PostgreSQL APT repository.

In alignment with the HoRus system architecture, this role **does not** create any application databases, schemas, or specific users. Those are handled at a later stage by application-specific playbooks and roles.

---

## Capabilities

1.  **Repository Setup**: Registers the official PostgreSQL GPG signing keyring and configures the APT source.
2.  **Package Provisioning**: Installs PostgreSQL 18, client tools, and necessary Python libraries (e.g. `python3-psycopg2`) for Ansible module integration.
3.  **Template Configuration**: Templates both `postgresql.conf` and client connection authentication rules `pg_hba.conf` with production-grade defaults.
4.  **Service Enforcement**: Enables and starts the PostgreSQL systemd service.
5.  **Validation**: Assures service health via port-listening verification and local connection status tests (`pg_isready`).

---

## Default Variables

Defined in `defaults/main.yml`:

| Variable | Default Value | Description |
|---|---|---|
| `postgresql_version` | `18` | Major PostgreSQL version to deploy. |
| `postgresql_packages` | `["postgresql-18", "postgresql-client-18"]` | Debian system packages to install. |
| `postgresql_python_packages` | `["python3-psycopg2"]` | Python package required for Ansible's database modules. |
| `postgresql_conf_dir` | `/etc/postgresql/{{ postgresql_version }}/main` | Location of configuration templates. |
| `postgresql_data_dir` | `/var/lib/postgresql/{{ postgresql_version }}/main` | Location of database files. |
| `postgresql_settings` | *(Dictionary)* | PostgreSQL engine parameters (e.g., ports, memory limits). |
| `postgresql_pg_hba_rules` | *(List)* | IP address access control rules (using `scram-sha-256`). |

---

## Example Usage

Create a group variable file `inventory/group_vars/postgresql.yml` to override parameters (e.g., custom buffers, ports, or allowed subnets). Then run the playbook:

```yaml
---
- name: Deploy Database Server
  hosts: postgresql
  become: true
  roles:
    - postgresql
```
