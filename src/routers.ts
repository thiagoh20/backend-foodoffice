import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db.js";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      // Clear cookie with same options used to set it
      ctx.res.clearCookie(COOKIE_NAME, { 
        ...cookieOptions, 
        maxAge: 0,
        expires: new Date(0)
      });
      return {
        success: true,
      } as const;
    }),
  }),

  // Procedimiento protegido solo para administradores
  products: router({
    list: publicProcedure.query(async () => {
      return await db.getAllProducts();
    }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        price: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores pueden crear productos" });
        }
        await db.createProduct(input);
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        name: z.string().min(1).optional(),
        price: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores pueden actualizar productos" });
        }
        const { id, ...data } = input;
        await db.updateProduct(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores pueden eliminar productos" });
        }
        await db.deleteProduct(input.id);
        return { success: true };
      }),
  }),

  groupOrders: router({
    getActive: publicProcedure.query(async () => {
      return await db.getActiveGroupOrder();
    }),
    create: protectedProcedure
      .input(z.object({
        deliveryCost: z.number().int().nonnegative().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores pueden crear pedidos grupales" });
        }
        await db.createGroupOrder(input);
        return { success: true };
      }),
    updateDeliveryCost: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        deliveryCost: z.number().int().nonnegative(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores pueden actualizar el costo de domicilio" });
        }
        await db.updateGroupOrder(input.id, { deliveryCost: input.deliveryCost });
        return { success: true };
      }),
    close: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores pueden cerrar pedidos" });
        }
        await db.updateGroupOrder(input.id, { status: "closed", closedAt: new Date() });
        return { success: true };
      }),
    getConsolidated: protectedProcedure
      .input(z.object({ groupOrderId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores pueden ver el consolidado" });
        }
        const items = await db.getOrderItemsByGroupOrder(input.groupOrderId);
        const products = await db.getAllProducts();
        const groupOrder = await db.getActiveGroupOrder();
        
        // Obtener usuarios únicos
        const uniqueUserIds = [...new Set(items.map(item => item.userId))];
        const users = await db.getUsersByIds(uniqueUserIds);
        const userMap = new Map(users.map(u => [u.id, u]));
        
        // Calcular totales por producto
        const productTotals = new Map<number, { product: any; totalQuantity: number; totalPrice: number }>();
        
        for (const item of items) {
          const product = products.find(p => p.id === item.productId);
          if (!product) continue;
          
          const existing = productTotals.get(item.productId);
          if (existing) {
            existing.totalQuantity += item.quantity;
            existing.totalPrice += product.price * item.quantity;
          } else {
            productTotals.set(item.productId, {
              product,
              totalQuantity: item.quantity,
              totalPrice: product.price * item.quantity,
            });
          }
        }
        
        return {
          items,
          productTotals: Array.from(productTotals.values()),
          groupOrder,
          users: Array.from(userMap.values()),
        };
      }),
  }),

  orderItems: router({
    myItems: protectedProcedure
      .input(z.object({ groupOrderId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        return await db.getOrderItemsByUser(ctx.user.id, input.groupOrderId);
      }),
    add: protectedProcedure
      .input(z.object({
        groupOrderId: z.number().int(),
        productId: z.number().int(),
        quantity: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createOrderItem({
          ...input,
          userId: ctx.user.id,
        });
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        quantity: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateOrderItem(input.id, { quantity: input.quantity });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteOrderItem(input.id);
        return { success: true };
      }),
    calculateMyTotal: protectedProcedure
      .input(z.object({ groupOrderId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const myItems = await db.getOrderItemsByUser(ctx.user.id, input.groupOrderId);
        const allItems = await db.getOrderItemsByGroupOrder(input.groupOrderId);
        const products = await db.getAllProducts();
        const groupOrder = await db.getActiveGroupOrder();
        
        // Calcular total de productos del usuario
        let myProductsTotal = 0;
        for (const item of myItems) {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            myProductsTotal += product.price * item.quantity;
          }
        }
        
        // Calcular número de usuarios únicos participantes
        const uniqueUsers = new Set(allItems.map(item => item.userId));
        const participantCount = uniqueUsers.size;
        
        // Calcular porción de domicilio
        const deliveryCostPerUser = participantCount > 0 
          ? Math.ceil((groupOrder?.deliveryCost || 0) / participantCount)
          : 0;
        
        return {
          productsTotal: myProductsTotal,
          deliveryShare: deliveryCostPerUser,
          grandTotal: myProductsTotal + deliveryCostPerUser,
          participantCount,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
