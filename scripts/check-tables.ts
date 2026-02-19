import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL no está configurado");
  process.exit(1);
}

const sql = postgres(connectionString);

async function checkTables() {
  try {
    // Verificar que las tablas existen
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log("\n📊 Tablas en la base de datos:\n");
    if (tables.length === 0) {
      console.log("❌ No se encontraron tablas");
    } else {
      tables.forEach((table: { table_name: string }) => {
        console.log(`  ✓ ${table.table_name}`);
      });
    }

    // Verificar tablas esperadas
    const expectedTables = ["users", "products", "group_orders", "order_items"];
    const existingTableNames = tables.map((t: { table_name: string }) => t.table_name);
    
    console.log("\n🔍 Verificación de tablas esperadas:\n");
    expectedTables.forEach((tableName) => {
      if (existingTableNames.includes(tableName)) {
        console.log(`  ✅ ${tableName} - existe`);
      } else {
        console.log(`  ❌ ${tableName} - NO existe`);
      }
    });

    // Contar registros en cada tabla
    console.log("\n📈 Registros por tabla:\n");
    for (const tableName of expectedTables) {
      if (existingTableNames.includes(tableName)) {
        try {
          const result = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)}`;
          const count = result[0]?.count || 0;
          console.log(`  ${tableName}: ${count} registros`);
        } catch (error) {
          console.log(`  ${tableName}: error al contar`);
        }
      }
    }

    console.log("\n✅ Verificación completada\n");
  } catch (error) {
    console.error("❌ Error al verificar tablas:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkTables();
