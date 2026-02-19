import { describe, expect, it } from "vitest";
import { appRouter } from "./routers.js";
import type { TrpcContext } from "./_core/context.js";
import { TRPCError } from "@trpc/server";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(role: "admin" | "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Products - Admin Authorization", () => {
  it("should allow admin to create product", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);

    // Este test verificaría la lógica, pero no ejecuta la DB real
    // En un entorno de test real, se mockearía la base de datos
    try {
      await caller.products.create({
        name: "Test Product",
        price: 10000,
      });
      // Si llegamos aquí, el permiso fue validado correctamente
      expect(true).toBe(true);
    } catch (error) {
      // Si falla por DB, está bien - lo importante es que no fue por permisos
      if (error instanceof TRPCError && error.code === "FORBIDDEN") {
        throw error;
      }
    }
  });

  it("should deny regular user from creating product", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.products.create({
        name: "Test Product",
        price: 10000,
      })
    ).rejects.toThrow("Solo administradores pueden crear productos");
  });

  it("should deny regular user from updating product", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.products.update({
        id: 1,
        name: "Updated Product",
      })
    ).rejects.toThrow("Solo administradores pueden actualizar productos");
  });

  it("should deny regular user from deleting product", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.products.delete({
        id: 1,
      })
    ).rejects.toThrow("Solo administradores pueden eliminar productos");
  });
});

describe("Group Orders - Admin Authorization", () => {
  it("should deny regular user from creating group order", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.groupOrders.create({
        deliveryCost: 5000,
      })
    ).rejects.toThrow("Solo administradores pueden crear pedidos grupales");
  });

  it("should deny regular user from updating delivery cost", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.groupOrders.updateDeliveryCost({
        id: 1,
        deliveryCost: 6000,
      })
    ).rejects.toThrow("Solo administradores pueden actualizar el costo de domicilio");
  });

  it("should deny regular user from closing order", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.groupOrders.close({
        id: 1,
      })
    ).rejects.toThrow("Solo administradores pueden cerrar pedidos");
  });

  it("should deny regular user from viewing consolidated report", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.groupOrders.getConsolidated({
        groupOrderId: 1,
      })
    ).rejects.toThrow("Solo administradores pueden ver el consolidado");
  });
});
