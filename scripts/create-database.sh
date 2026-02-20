#!/bin/bash

# Script para crear la base de datos en RDS si no existe
# Uso: ./scripts/create-database.sh

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Variables de entorno requeridas
DB_HOST="${DATABASE_HOST}"
DB_USER="${DATABASE_USER}"
DB_PASSWORD="${DATABASE_PASSWORD}"
DB_NAME="${DATABASE_NAME}"

if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
  echo -e "${RED}❌ Error: Variables de entorno requeridas no configuradas${NC}"
  echo "   DATABASE_HOST: ${DB_HOST:-no configurado}"
  echo "   DATABASE_USER: ${DB_USER:-no configurado}"
  echo "   DATABASE_PASSWORD: ${DB_PASSWORD:-no configurado}"
  echo "   DATABASE_NAME: ${DB_NAME:-no configurado}"
  exit 1
fi

echo -e "${YELLOW}🔍 Verificando si la base de datos '$DB_NAME' existe...${NC}"

# Intentar conectar a la base de datos postgres (siempre existe en PostgreSQL)
# y verificar si nuestra base de datos existe
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d postgres \
  -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" \
  2>/dev/null | grep -q 1

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ La base de datos '$DB_NAME' ya existe${NC}"
  exit 0
fi

echo -e "${YELLOW}⚠️  La base de datos '$DB_NAME' no existe. Creándola...${NC}"

# Crear la base de datos
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d postgres \
  -c "CREATE DATABASE \"$DB_NAME\";" \
  2>&1

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Base de datos '$DB_NAME' creada exitosamente${NC}"
  exit 0
else
  echo -e "${RED}❌ Error al crear la base de datos '$DB_NAME'${NC}"
  exit 1
fi
