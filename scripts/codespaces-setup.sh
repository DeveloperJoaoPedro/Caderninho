#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
npm ci
npm run setup
docker compose up -d --wait
npm run db:generate
npm run db:migrate
