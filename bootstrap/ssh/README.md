# Bootstrap SSH Keys

This directory contains the SSH keys used for the administrative and service accounts created during Stage 1.

## Key Generation

Use the provided script to generate the required ED25519 key pairs:

```bash
./generate_ssh_keys.sh
```

The script will generate:
- `abbenden-srv`: Administrative user key
- `jenkins-srv`: CI/CD service user key

**Security Warning**: Private keys are ignored by Git. Ensure they are backed up securely outside this repository.
