#!/bin/bash

echo "========================================="
echo "  Intrusive Thoughts — Installation"
echo "========================================="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null
then
    echo "[ERROR] Node.js is not installed or not in PATH."
    echo "Please install Node.js 20+ from https://nodejs.org/ and try again."
    exit 1
fi

# Install dependencies
echo "[INFO] Installing npm dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install npm dependencies."
    exit 1
fi
echo "[INFO] Dependencies installed successfully."
echo ""

# Setup environment variables
if [ ! -f ".env.local" ]; then
    echo "[INFO] Setting up environment variables (see .env.example for details)..."
    read -rsp "NVIDIA API key (nvapi-..., from https://build.nvidia.com): " NVIDIA_API_KEY; echo
    read -rp  "Supabase project URL (https://<ref>.supabase.co): " SUPABASE_URL
    read -rsp "Supabase SECRET key (sb_secret_... or service_role; server-only): " SUPABASE_SECRET_KEY; echo
    {
        echo "NVIDIA_API_KEY=$NVIDIA_API_KEY"
        echo "SUPABASE_URL=$SUPABASE_URL"
        echo "SUPABASE_SECRET_KEY=$SUPABASE_SECRET_KEY"
    } > .env.local
    chmod 600 .env.local
    echo "[INFO] .env.local created."
else
    echo "[INFO] .env.local already exists. Skipping environment setup."
fi

echo ""
echo "========================================="
echo "  Installation Complete!"
echo "========================================="
echo ""
echo "One more step if you haven't done it yet: open your Supabase project's"
echo "SQL Editor and run supabase/setup-database.sql (safe to re-run)."
echo ""
echo "Then start the application:"
echo "   npm run dev"
echo ""
