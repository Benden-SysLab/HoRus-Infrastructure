#!/usr/bin/env python3
"""
auto_prepare.py - Auto-healing and bootstrap prep script for HoRus-Infrastructure.

This script executes locally on the control machine before any playbooks run to:
1. Ensure 'inventory/group_vars/vault_inventory.yml' exists by copying the template.
2. Verify if administrative and service users have secure custom passwords.
   If standard placeholders or default hashes are detected, generates cryptographically secure
   256-character passwords using alphanumeric and special characters, hashes them using
   SHA-512 crypt via OpenSSL, and stores both the plaintext and hashed values safely in the ignored vault file.
3. Verify if required SSH ED25519 keypairs for 'root', 'admin' and 'jenkins' exist.
   If missing, automatically generates them at the exact paths specified in vault_inventory.yml.
"""

import os
import sys
import secrets
import string
import shutil
import subprocess

# Define paths relative to the project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE_PATH = os.path.join(BASE_DIR, "inventory/group_vars/vault_inventory.yml.template")
VAULT_PATH = os.path.join(BASE_DIR, "inventory/group_vars/vault_inventory.yml")
SSH_DIR = os.path.join(BASE_DIR, "bootstrap/ssh")

# Placeholders to replace if found
PLACEHOLDERS = [
    "REPLACE_WITH_SHA512_CRYPT_HASH",
    "$6$rounds=656000$example$hash",
    ""
]

def ensure_vault_file():
    """Copy the vault_inventory template to active if missing."""
    if not os.path.exists(VAULT_PATH):
        print(f"[PREP] vault_inventory.yml missing. Bootstrapping from template...")
        shutil.copy(TEMPLATE_PATH, VAULT_PATH)
        print(f"[PREP] Created active {VAULT_PATH}")

def parse_vault_config():
    """Parse key names and file paths from vault_inventory.yml."""
    config = {
        "admin_user": "root",
        "jenkins_user": "jenkins-srv",
        "admin_key_path": "bootstrap/ssh/id_ed25519_root",
        "jenkins_key_path": "bootstrap/ssh/id_ed25519_jenkins"
    }
    if not os.path.exists(VAULT_PATH):
        return config

    with open(VAULT_PATH, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":" in line:
                parts = line.split(":", 1)
                key = parts[0].strip()
                val = parts[1].strip().strip('"').strip("'")
                if key == "vault_admin_username":
                    config["admin_user"] = val
                elif key == "vault_jenkins_username":
                    config["jenkins_user"] = val
                elif key == "vault_admin_ssh_priv_key":
                    config["admin_key_path"] = val
                elif key == "vault_jenkins_ssh_priv_key":
                    config["jenkins_key_path"] = val
    return config

def check_and_generate_keys(config):
    """Check for missing SSH keypairs and automatically generate ED25519 keys."""
    os.makedirs(SSH_DIR, exist_ok=True)
    
    has_ssh_keygen = bool(shutil.which("ssh-keygen"))
    if not has_ssh_keygen:
        print("[WARNING] 'ssh-keygen' utility is not found in PATH. Key generation will be skipped if keys are missing.", file=sys.stderr)

    # Key entries with paths resolved relative to BASE_DIR
    keys_to_check = [
        {"name": "root", "path": os.path.join(BASE_DIR, "bootstrap/ssh/id_ed25519_root")},
        {"name": config["admin_user"], "path": os.path.join(BASE_DIR, config["admin_key_path"])},
        {"name": config["jenkins_user"], "path": os.path.join(BASE_DIR, config["jenkins_key_path"])}
    ]

    for item in keys_to_check:
        key_name = item["name"]
        key_path = item["path"]
        
        # Ensure parent directory of the key path exists
        os.makedirs(os.path.dirname(key_path), exist_ok=True)
        
        if not os.path.exists(key_path):
            if not has_ssh_keygen:
                print(f"[WARNING] Missing SSH key: {key_name} at '{key_path}', but 'ssh-keygen' is not found in PATH. Please generate it manually.", file=sys.stderr)
                continue
            print(f"[PREP] Missing SSH key: {key_name} at '{key_path}'. Generating ED25519 pair...")
            try:
                subprocess.run(
                    ["ssh-keygen", "-t", "ed25519", "-f", key_path, "-N", "", "-C", f"{key_name}@horus-infra"],
                    check=True,
                    capture_output=True,
                    text=True
                )
                print(f"[OK] Generated ED25519 keypair for {key_name}")
            except subprocess.CalledProcessError as e:
                print(f"[ERROR] Failed to generate keypair for {key_name}: {e.stderr}", file=sys.stderr)
                sys.exit(2)
        else:
            print(f"[OK] SSH key already exists: {key_name} at '{key_path}'")

def generate_secure_password(length=20):
    """Generate a highly secure random alphanumeric password of specified length."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))

def hash_password(password):
    """Hash a password using SHA-512 crypt ($6$) with salt."""
    try:
        import crypt
        return crypt.crypt(password, crypt.mksalt(crypt.METHOD_SHA512))
    except (ImportError, AttributeError):
        # Fallback to openssl
        if not shutil.which("openssl"):
            print("[ERROR] Neither Python's 'crypt' module nor system 'openssl' was found. Cannot hash password.", file=sys.stderr)
            sys.exit(1)
        try:
            proc = subprocess.run(
                ["openssl", "passwd", "-6", password],
                capture_output=True,
                text=True,
                check=True
            )
            return proc.stdout.strip()
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] OpenSSL failed to hash password: {e.stderr}", file=sys.stderr)
            sys.exit(3)

def check_and_harden_passwords(config):
    """Scan vault_inventory.yml for default passwords, generate secure ones, write hash to vault and plain to untracked file."""
    if not os.path.exists(VAULT_PATH):
        return

    # Simple line-by-line parser to modify while preserving formatting/comments
    with open(VAULT_PATH, "r") as f:
        lines = f.readlines()

    admin_plain = None
    jenkins_plain = None
    existing_admin_plain = None
    existing_jenkins_plain = None

    # Fallback: check secrets_plain.txt first
    secrets_path = os.path.join(BASE_DIR, "bootstrap/secrets_plain.txt")
    if os.path.exists(secrets_path):
        try:
            with open(secrets_path, "r") as sf:
                for line in sf:
                    stripped = line.strip()
                    if stripped.startswith("vault_admin_password:"):
                        existing_admin_plain = stripped.split(":", 1)[1].strip()
                    elif stripped.startswith("vault_jenkins_password:"):
                        existing_jenkins_plain = stripped.split(":", 1)[1].strip()
        except Exception:
            pass

    # First pass: find existing plaintext values from the file (overrides fallback if present)
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("vault_admin_plaintext_password:"):
            existing_admin_plain = stripped.split(":", 1)[1].strip().strip('"').strip("'")
            if "#" in existing_admin_plain:
                existing_admin_plain = existing_admin_plain.split("#", 1)[0].strip().strip('"').strip("'")
        elif stripped.startswith("vault_jenkins_plaintext_password:"):
            existing_jenkins_plain = stripped.split(":", 1)[1].strip().strip('"').strip("'")
            if "#" in existing_jenkins_plain:
                existing_jenkins_plain = existing_jenkins_plain.split("#", 1)[0].strip().strip('"').strip("'")

    new_lines = []
    for line in lines:
        stripped = line.strip()
        
        # We will handle plaintext lines dynamically, so skip them for now
        if stripped.startswith("vault_admin_plaintext_password:") or stripped.startswith("vault_jenkins_plaintext_password:"):
            continue

        if stripped.startswith("vault_admin_password:"):
            val = stripped.split(":", 1)[1].strip().strip('"').strip("'")
            if "#" in val:
                val = val.split("#", 1)[0].strip().strip('"').strip("'")
            if val in PLACEHOLDERS or "example$hash" in val or val.startswith("REPLACE_"):
                print("[PREP] Default/Placeholder password detected for Administrator. Generating secure password...")
                admin_plain = generate_secure_password(20)
                hashed = hash_password(admin_plain)
                line = f'vault_admin_password: "{hashed}"\n'
            elif not val.startswith("$6$"):
                print("[PREP] Plaintext password detected for Administrator. Hashing it...")
                admin_plain = val
                hashed = hash_password(admin_plain)
                line = f'vault_admin_password: "{hashed}"\n'
            else:
                admin_plain = existing_admin_plain

            new_lines.append(line)
            if admin_plain:
                new_lines.append(f'vault_admin_plaintext_password: "{admin_plain}"\n')

        elif stripped.startswith("vault_jenkins_password:"):
            val = stripped.split(":", 1)[1].strip().strip('"').strip("'")
            if "#" in val:
                val = val.split("#", 1)[0].strip().strip('"').strip("'")
            if val in PLACEHOLDERS or "example$hash" in val or val.startswith("REPLACE_"):
                print("[PREP] Default/Placeholder password detected for Jenkins-srv. Generating secure password...")
                jenkins_plain = generate_secure_password(20)
                hashed = hash_password(jenkins_plain)
                line = f'vault_jenkins_password: "{hashed}"\n'
            elif not val.startswith("$6$"):
                print("[PREP] Plaintext password detected for Jenkins-srv. Hashing it...")
                jenkins_plain = val
                hashed = hash_password(jenkins_plain)
                line = f'vault_jenkins_password: "{hashed}"\n'
            else:
                jenkins_plain = existing_jenkins_plain

            new_lines.append(line)
            if jenkins_plain:
                new_lines.append(f'vault_jenkins_plaintext_password: "{jenkins_plain}"\n')
        else:
            new_lines.append(line)

    modified = (new_lines != lines)

    if modified:
        with open(VAULT_PATH, "w") as f:
            f.writelines(new_lines)
        print("[OK] vault_inventory.yml has been updated with SHA-512 crypt-hashed passwords.")
        
        # Write plaintext passwords to separate ignored file
        secrets_path = os.path.join(BASE_DIR, "bootstrap/secrets_plain.txt")
        try:
            with open(secrets_path, "w") as sf:
                sf.write("=== HO-RUS PLAINTEXT CREDENTIALS (DO NOT COMMIT to Git) ===\n")
                if admin_plain:
                    sf.write(f"vault_admin_username: {config['admin_user']}\n")
                    sf.write(f"vault_admin_password: {admin_plain}\n\n")
                if jenkins_plain:
                    sf.write(f"vault_jenkins_username: {config['jenkins_user']}\n")
                    sf.write(f"vault_jenkins_password: {jenkins_plain}\n\n")
            
            print(f"\n[OK] Plaintext passwords saved for your convenience to:")
            print(f"     -> {os.path.abspath(secrets_path)}")
            print(f"     (This file is in .gitignore, so it will NOT be committed to Git)\n")
        except Exception as e:
            print(f"[WARNING] Failed to write secrets_plain.txt: {e}")

        # Interactive terminal output & secure screen clear
        print("\n" + "=" * 80)
        print("!!! SECURITY NOTICE: SECURE PASSWORDS PROCESSED !!!")
        print("=" * 80)
        if admin_plain:
            print(f"  Administrator ({config['admin_user']}) Plaintext Password: {admin_plain}")
        if jenkins_plain:
            print(f"  Jenkins Service ({config['jenkins_user']}) Plaintext Password: {jenkins_plain}")
        print("-" * 80)
        print("These credentials are also stored in:")
        print(f"  -> {os.path.abspath(secrets_path)}")
        print("Please write down/save these credentials now.")
        print("=" * 80)
        
        # We check if sys.stdin is interactive, but to be safe and robust, we do standard input prompt
        if sys.stdin.isatty():
            try:
                input("\nPress [Enter] when you have saved the passwords. The screen will be cleared...")
                # Clear screen and history
                os.system('clear' if os.name != 'nt' else 'cls')
                print("Terminal history cleared. Proceeding with execution.\n")
            except (KeyboardInterrupt, EOFError):
                pass
        else:
            print("\nNon-interactive environment detected. Skipping terminal screen clearing.")
    else:
        print("[OK] Custom passwords verified or already generated.")

def main():
    print("--- HoRus Bootstrap Pre-flight Preparation ---")
    ensure_vault_file()
    config = parse_vault_config()
    check_and_generate_keys(config)
    check_and_harden_passwords(config)
    print("--- Pre-flight check completed successfully ---")

if __name__ == "__main__":
    main()
