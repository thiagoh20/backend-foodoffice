#!/usr/bin/env tsx

/**
 * Script para crear la base de datos en RDS si no existe
 * Uso: tsx scripts/create-database.ts
 */

import postgres from 'postgres';

const DB_HOST = process.env.DATABASE_HOST;
const DB_USER = process.env.DATABASE_USER;
const DB_PASSWORD = process.env.DATABASE_PASSWORD;
const DB_NAME = process.env.DATABASE_NAME;

if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  console.error('❌ Error: Variables de entorno requeridas no configuradas');
  console.error('   DATABASE_HOST:', DB_HOST || 'no configurado');
  console.error('   DATABASE_USER:', DB_USER || 'no configurado');
  console.error('   DATABASE_PASSWORD:', DB_PASSWORD ? '***' : 'no configurado');
  console.error('   DATABASE_NAME:', DB_NAME || 'no configurado');
  process.exit(1);
}

// Conectar a la base de datos postgres (siempre existe)
const postgresUrl = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/postgres`;
const sql = postgres(postgresUrl, { max: 1 });

async function createDatabase() {
  try {
    console.log(`🔍 Verificando si la base de datos '${DB_NAME}' existe...`);

    // Verificar si la base de datos existe
    const result = await sql`
      SELECT 1 FROM pg_database WHERE datname = ${DB_NAME}
    `;

    if (result.length > 0) {
      console.log(`✅ La base de datos '${DB_NAME}' ya existe`);
      await sql.end();
      process.exit(0);
    }

    console.log(`⚠️  La base de datos '${DB_NAME}' no existe. Creándola...`);

    // Crear la base de datos
    // Nota: CREATE DATABASE no puede ejecutarse en una transacción, así que usamos una query directa
    await sql.unsafe(`CREATE DATABASE "${DB_NAME}"`);

    console.log(`✅ Base de datos '${DB_NAME}' creada exitosamente`);
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear la base de datos:', error);
    await sql.end();
    process.exit(1);
  }
}

createDatabase();
