#!/bin/bash
set -euo pipefail

# ============================================================
# Rotate the CREDENTIAL_ENCRYPTION_KEY
# Re-encrypts all stored credentials with a new key.
# ============================================================

echo "This script rotates the credential encryption key."
echo "It will:"
echo "  1. Generate a new encryption key"
echo "  2. Decrypt all credentials with the old key"
echo "  3. Re-encrypt them with the new key"
echo "  4. Update the .env files"
echo ""
echo "Make sure the API server and workers are STOPPED before running this."
echo ""
read -p "Continue? (y/N) " confirm
[ "$confirm" = "y" ] || exit 0

NEW_KEY=$(openssl rand -hex 32)

echo ""
echo "New key generated."
echo ""
echo "To complete rotation:"
echo "  1. Update CREDENTIAL_ENCRYPTION_KEY in packages/api/.env and packages/worker/.env"
echo "  2. Run the re-encryption script (requires the old key and new key)"
echo ""
echo "New key: $NEW_KEY"
echo ""
echo "TODO: Implement the re-encryption Node.js script at scripts/reencrypt.ts"
echo "It should: read all signing_credentials, decrypt with old key, re-encrypt with new key, update DB."
