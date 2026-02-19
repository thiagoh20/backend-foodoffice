import express, { Express, type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../src/_core/oauth.js";
import { appRouter } from "../src/routers.js";
import { createContext } from "../src/_core/context.js";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const.js";
import { getSessionCookieOptions } from "../src/_core/cookies.js";
import { sdk } from "../src/_core/sdk.js";
import * as db from "../src/db.js";
import { ENV } from "../src/_core/env.js";
import { sql } from "drizzle-orm";

/**
 * Express app (singleton)
 */
const app: Express = express();

// Body parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Endpoint de prueba para Postman
app.get("/api/test", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "¡Endpoint de prueba funcionando correctamente!",
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    headers: {
      "user-agent": req.get("user-agent"),
      "content-type": req.get("content-type"),
    },
  });
});

// Endpoint de diagnóstico para verificar variables de entorno
app.get("/api/env-check", async (req: Request, res: Response) => {
  const { ENV } = await import("../src/_core/env.js");
  res.json({
    oauthConfigured: !!ENV.oAuthServerUrl,
    oauthServerUrl: ENV.oAuthServerUrl || "(no configurado)",
    appId: ENV.appId || "(no configurado)",
    hasOAuthClientSecret: !!ENV.oAuthClientSecret,
    isAuth0: ENV.isAuth0,
    nodeEnv: process.env.NODE_ENV,
    allEnvVars: {
      OAUTH_SERVER_URL: process.env.OAUTH_SERVER_URL || "(no definido)",
      VITE_APP_ID: process.env.VITE_APP_ID || "(no definido)",
      OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET ? "***configurado***" : "(no definido)",
      OWNER_OPEN_ID: process.env.OWNER_OPEN_ID || "(no definido)",
    },
  });
});

// Endpoint de diagnóstico para verificar conexión a base de datos
app.get("/api/db-check", async (req: Request, res: Response) => {
  try {
    const dbConnectionTest = await db.testDbConnection();
    
    if (!dbConnectionTest.success) {
      res.status(500).json({
        success: false,
        error: dbConnectionTest.error,
        message: "No se pudo conectar a la base de datos",
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      });
      return;
    }

    // Intentar verificar si las tablas existen
    const dbInstance = await db.getDb();
    let tablesExist = false;
    let tablesError: string | undefined;

    if (dbInstance) {
      try {
        // Intentar una query simple a la tabla de productos
        await dbInstance.execute(sql`SELECT 1 FROM products LIMIT 1`);
        tablesExist = true;
      } catch (error) {
        tablesError = error instanceof Error ? error.message : String(error);
        // Verificar si es un error de tabla no existe
        if (tablesError.includes("does not exist") || (tablesError.includes("relation") && tablesError.includes("does not exist"))) {
          tablesError = "Las tablas no existen. Ejecuta las migraciones: npm run db:push o drizzle-kit migrate";
        }
      }
    }

    res.json({
      success: true,
      connection: "OK",
      tablesExist,
      tablesError,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      message: tablesExist 
        ? "Base de datos conectada y tablas disponibles" 
        : "Base de datos conectada pero las tablas no existen. Ejecuta las migraciones.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    });
  }
});

// OAuth routes
registerOAuthRoutes(app);

// Dev login (no OAuth)
if (!ENV.oAuthServerUrl) {
    (app.post as any)("/api/dev/login", async (req: Request, res: Response) => {
      try {
        if (!ENV.cookieSecret?.trim()) {
          res.status(500);
          res.json({
            error: "Failed to create development session",
            details: "JWT_SECRET is not configured",
          });
          return;
        }

        const dbConnectionTest = await db.testDbConnection();
        if (!dbConnectionTest.success) {
          res.status(500);
          res.json({
            error: "Failed to create development session",
            details: dbConnectionTest.error,
          });
          return;
        }

        const devOpenId = "dev-user-local";
        await db.getUserByOpenId(devOpenId);

        await db.upsertUser({
          openId: devOpenId,
          name: "Usuario de Desarrollo",
          email: "dev@localhost",
          loginMethod: "development",
          role: "admin",
          lastSignedIn: new Date(),
        });

        const sessionToken = await sdk.createSessionToken(devOpenId, {
          name: "Usuario de Desarrollo",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        res.json({ success: true });
      } catch (error) {
        res.status(500);
        res.json({
          error: "Failed to create development session",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });
}

// tRPC
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

/**
 * 👉 EXPORT DIRECTO PARA VERCEL
 */
export default app;
