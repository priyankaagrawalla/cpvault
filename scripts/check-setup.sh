#!/bin/bash
# Quick check: is everything ready to run CP Vault?

set -e
cd "$(dirname "$0")/.."
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "CP Vault setup check"
echo "===================="

if command -v node >/dev/null; then
  echo -e "${GREEN}✓${NC} Node $(node -v)"
else
  echo -e "${RED}✗${NC} Node not found — install from https://nodejs.org"
  exit 1
fi

if [ -f backend/.env ]; then
  echo -e "${GREEN}✓${NC} backend/.env exists"
else
  echo -e "${YELLOW}!${NC} Copy backend/.env.example to backend/.env"
fi

if [ -d backend/node_modules ]; then
  echo -e "${GREEN}✓${NC} backend dependencies installed"
else
  echo -e "${YELLOW}!${NC} Run: cd backend && npm install"
fi

if [ -d frontend/node_modules ]; then
  echo -e "${GREEN}✓${NC} frontend dependencies installed"
else
  echo -e "${YELLOW}!${NC} Run: cd frontend && npm install"
fi

# Postgres check
if command -v pg_isready >/dev/null; then
  if pg_isready -q 2>/dev/null; then
    echo -e "${GREEN}✓${NC} PostgreSQL is running"
  else
    echo -e "${RED}✗${NC} PostgreSQL installed but not running"
    echo "    Run: brew services start postgresql@16"
    echo "    Or install: brew install postgresql@16"
  fi
elif command -v docker >/dev/null; then
  if docker compose ps postgres 2>/dev/null | grep -q running; then
    echo -e "${GREEN}✓${NC} Postgres Docker container running"
  else
    echo -e "${YELLOW}!${NC} Docker found — run: docker compose up -d postgres"
  fi
else
  echo -e "${RED}✗${NC} No PostgreSQL or Docker found"
  echo "    Install Postgres: brew install postgresql@16"
  echo "    See SETUP_MAC.md"
fi

echo ""
echo "To run the app (two terminals):"
echo "  1) cd backend && npm run dev"
echo "  2) cd frontend && npm run dev"
echo "  3) Open http://localhost:5173"
