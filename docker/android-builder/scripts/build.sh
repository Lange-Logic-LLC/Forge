#!/bin/bash
set -euo pipefail

echo "=== Forge Android Builder ==="
echo "Working directory: $(pwd)"

# Install JS dependencies if not already done
if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
    echo "Installing JS dependencies..."
    if [ -f "pnpm-lock.yaml" ]; then
        pnpm install --frozen-lockfile
    elif [ -f "yarn.lock" ]; then
        yarn install --frozen-lockfile
    else
        npm ci
    fi
fi

# Run expo prebuild if this is an Expo project
if [ -f "app.json" ] || [ -f "app.config.js" ] || [ -f "app.config.ts" ]; then
    echo "Running expo prebuild..."
    npx expo prebuild --platform android --clean
fi

cd android

# Inject keystore signing config if credentials are mounted
if [ -f "/creds/keystore.jks" ]; then
    echo "Keystore found, configuring signing..."

    # Read credentials from environment or gradle.properties
    if [ -n "${KEYSTORE_PASSWORD:-}" ]; then
        cat >> gradle.properties <<EOF

MYAPP_UPLOAD_STORE_FILE=/creds/keystore.jks
MYAPP_UPLOAD_KEY_ALIAS=${KEY_ALIAS:-upload}
MYAPP_UPLOAD_STORE_PASSWORD=${KEYSTORE_PASSWORD}
MYAPP_UPLOAD_KEY_PASSWORD=${KEY_PASSWORD:-${KEYSTORE_PASSWORD}}
EOF
    fi
fi

echo "Building release APK..."
./gradlew assembleRelease --no-daemon

echo "Build complete!"

# List outputs
echo "=== Build outputs ==="
find app/build/outputs -name "*.apk" -o -name "*.aab" 2>/dev/null || echo "No outputs found"
