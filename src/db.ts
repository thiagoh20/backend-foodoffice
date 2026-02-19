import { eq, and, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertUser, users, products, InsertProduct, groupOrders, InsertGroupOrder, orderItems, InsertOrderItem } from "../drizzle/schema.js";
import { ENV } from './_core/env.js';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: postgres.Sql | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL);
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _client = null;
    }
  }
  return _db;
}

// Test database connection by executing a simple query
export async function testDbConnection(): Promise<{ success: boolean; error?: string }> {
  const dbInstance = await getDb();
  if (!dbInstance) {
    return { 
      success: false, 
      error: "Database instance not available. Check DATABASE_URL configuration." 
    };
  }

  try {
    // Try a simple query to verify connection using Drizzle's sql template
    await dbInstance.execute(sql`SELECT 1`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    let userFriendlyError = "Database connection failed.";
    
    // Provide helpful error messages for common issues
    if (errorMessage.includes("ENOTFOUND")) {
      userFriendlyError = "Cannot connect to database host. Check your DATABASE_URL configuration.";
    } else if (errorMessage.includes("ECONNREFUSED")) {
      userFriendlyError = "Database connection refused. Make sure the database server is running.";
    } else if (errorMessage.includes("password authentication failed") || errorMessage.includes("Access denied")) {
      userFriendlyError = "Database access denied. Check your DATABASE_URL credentials.";
    }
    
    return { 
      success: false, 
      error: `${userFriendlyError} Original error: ${errorMessage}` 
    };
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  try {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Error getting user by openId:", error);
    throw error;
  }
}

export async function getUsersByIds(userIds: number[]) {
  const db = await getDb();
  if (!db || userIds.length === 0) return [];
  try {
    return await db.select().from(users).where(inArray(users.id, userIds));
  } catch (error) {
    console.error("[Database] Error getting users by ids:", error);
    throw error;
  }
}

// Helpers para productos
export async function getAllProducts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(products).where(eq(products.active, 1));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data);
  return result;
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set({ active: 0 }).where(eq(products.id, id));
}

// Helpers para pedidos grupales
export async function getActiveGroupOrder() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(groupOrders).where(eq(groupOrders.status, "open")).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createGroupOrder(data: InsertGroupOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(groupOrders).values(data);
  return result;
}

export async function updateGroupOrder(id: number, data: Partial<InsertGroupOrder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(groupOrders).set(data).where(eq(groupOrders.id, id));
}

// Helpers para items de pedido
export async function getOrderItemsByGroupOrder(groupOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(orderItems).where(eq(orderItems.groupOrderId, groupOrderId));
}

export async function getOrderItemsByUser(userId: number, groupOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(orderItems)
    .where(and(
      eq(orderItems.userId, userId),
      eq(orderItems.groupOrderId, groupOrderId)
    ));
}

export async function createOrderItem(data: InsertOrderItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orderItems).values(data);
  return result;
}

export async function updateOrderItem(id: number, data: Partial<InsertOrderItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orderItems).set(data).where(eq(orderItems.id, id));
}

export async function deleteOrderItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(orderItems).where(eq(orderItems.id, id));
}
