#!/bin/bash

# generate_ssh_keys.sh - Idempotent SSH key generation for HoRus-Infrastructure
# Generates ED25519 keys only if they are missing.

set -e

# Check if ssh-keygen is available
if ! command -v ssh-keygen &> /dev/null; then
    echo "[ERROR] ssh-keygen could not be found. Please install OpenSSH tools."
    exit 1
fi

KEY_DIR="$(dirname "$0")"
KEYS=("id_ed25519_root" "id_ed25519_jenkins" "id_ed25519_abbenden")

echo "--- HoRus SSH Key Generation ---"

for KEY_NAME in "${KEYS[@]}"; do
    KEY_PATH="${KEY_DIR}/${KEY_NAME}"
    
    if [ -f "$KEY_PATH" ]; then
        echo "[SKIP] Key '${KEY_NAME}' already exists at ${KEY_PATH}"
    else
        echo "[GEN] Generating ED25519 key for '${KEY_NAME}'..."
        ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "${KEY_NAME}@horus-infra"
        if [ $? -eq 0 ]; then
            echo "[OK] Successfully created ${KEY_NAME}"
        else
            echo "[FAIL] Failed to create ${KEY_NAME}"
            exit 2
        fi
    fi
done

echo "--- Key generation complete ---"
exit 0
