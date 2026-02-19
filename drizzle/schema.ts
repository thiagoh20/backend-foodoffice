import { integer, pgEnum, pgTable, text, timestamp, varchar, serial } from "drizzle-orm/pg-core";

// Definir enums primero
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const statusEnum = pgEnum("status", ["open", "closed", "completed"]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tabla de productos disponibles en el catálogo.
 * Solo los administradores pueden crear, editar o eliminar productos.
 */
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  price: integer("price").notNull(), // Precio en centavos para evitar problemas de precisión
  active: integer("active").default(1).notNull(), // 1 = activo, 0 = inactivo
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Tabla de pedidos grupales.
 * Cada pedido grupal tiene un costo de domicilio que se divide entre todos los participantes.
 */
export const groupOrders = pgTable("group_orders", {
  id: serial("id").primaryKey(),
  deliveryCost: integer("deliveryCost").default(0).notNull(), // Costo de domicilio en centavos
  status: statusEnum("status").default("open").notNull(),
  closedAt: timestamp("closedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type GroupOrder = typeof groupOrders.$inferSelect;
export type InsertGroupOrder = typeof groupOrders.$inferInsert;

/**
 * Tabla de items de pedido.
 * Cada item representa la selección de un producto por un usuario en un pedido grupal.
 */
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  groupOrderId: integer("groupOrderId").notNull(),
  userId: integer("userId").notNull(),
  productId: integer("productId").notNull(),
  quantity: integer("quantity").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;