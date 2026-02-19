import "dotenv/config";
import express, { type Request, type Response } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth.js";
import { appRouter } from "../routers.js";
import { createContext } from "./context.js";
// Frontend is now separate - no need to serve static files
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getSessionCookieOptions } from "./cookies.js";
import { sdk } from "./sdk.js";
import * as db from "../db.js";
import { ENV } from "./env.js";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Development mode: allow login without OAuth (when OAuth is not configured)
  console.log("[Dev Login] Checking OAuth configuration:", { 
    oAuthServerUrl: ENV.oAuthServerUrl, 
    isEmpty: !ENV.oAuthServerUrl,
    isProduction: ENV.isProduction 
  });
  if (!ENV.oAuthServerUrl) {
    console.log("[Dev Login] Registering development login endpoint at /api/dev/login");
    app.post("/api/dev/login", async (req: Request, res: Response) => {
      console.log("[Dev Login] Request received");
      try {
        // Validate required environment variables
        if (!ENV.cookieSecret || ENV.cookieSecret.trim() === "") {
          const errorMsg = "JWT_SECRET is not configured. Please set JWT_SECRET in your .env file.";
          console.error("[Dev Login]", errorMsg);
          res.status(500).json({ 
            error: "Failed to create development session", 
            details: errorMsg 
          });
          return;
        }

        // Check database connection
        const dbConnectionTest = await db.testDbConnection();
        if (!dbConnectionTest.success) {
          const errorMsg = dbConnectionTest.error || "Database is not available. Please ensure DATABASE_URL is configured and the database is running.";
          console.error("[Dev Login]", errorMsg);
          res.status(500).json({ 
            error: "Failed to create development session", 
            details: errorMsg 
          });
          return;
        }

        // Create or get a development user
        const devOpenId = "dev-user-local";
        console.log("[Dev Login] Getting user by openId:", devOpenId);
        let devUser;
        try {
          devUser = await db.getUserByOpenId(devOpenId);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          let userFriendlyError = "Failed to query database.";
          
          if (errorMsg.includes("ENOTFOUND") || errorMsg.includes("ECONNREFUSED")) {
            userFriendlyError = "Cannot connect to database. Check your DATABASE_URL configuration in your .env file. Example: postgresql://user:password@host:port/database";
          } else if (errorMsg.includes("password authentication failed")) {
            userFriendlyError = "Database authentication failed. Check your DATABASE_URL credentials.";
          }
          
          console.error("[Dev Login] Database query error:", errorMsg);
          res.status(500).json({ 
            error: "Failed to create development session", 
            details: userFriendlyError 
          });
          return;
        }
        
        if (!devUser) {
          console.log("[Dev Login] User not found, creating new user");
          try {
            await db.upsertUser({
              openId: devOpenId,
              name: "Usuario de Desarrollo",
              email: "dev@localhost",
              loginMethod: "development",
              role: "admin",
              lastSignedIn: new Date(),
            });
            console.log("[Dev Login] User created successfully");
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error("[Dev Login] Failed to create user:", errorMsg);
            res.status(500).json({ 
              error: "Failed to create development session", 
              details: `Failed to create user: ${errorMsg}` 
            });
            return;
          }
        } else {
          console.log("[Dev Login] User found, updating lastSignedIn");
          try {
            await db.upsertUser({
              openId: devOpenId,
              lastSignedIn: new Date(),
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error("[Dev Login] Failed to update user:", errorMsg);
            res.status(500).json({ 
              error: "Failed to create development session", 
              details: `Failed to update user: ${errorMsg}` 
            });
            return;
          }
        }
        
        // Create session token
        console.log("[Dev Login] Creating session token");
        const sessionToken = await sdk.createSessionToken(devOpenId, {
          name: "Usuario de Desarrollo",
          expiresInMs: ONE_YEAR_MS,
        });
        console.log("[Dev Login] Session token created");
        
        // Set cookie
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        console.log("[Dev Login] Cookie set, sending response");
        
        res.json({ success: true, message: "Logged in as development user" });
      } catch (error) {
        console.error("[Dev Login] Error:", error);
        if (error instanceof Error) {
          console.error("[Dev Login] Error message:", error.message);
          console.error("[Dev Login] Error stack:", error.stack);
        }
        res.status(500).json({ 
          error: "Failed to create development session", 
          details: error instanceof Error ? error.message : String(error) 
        });
      }
    });
  }
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // CORS configuration for frontend
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173", "http://localhost:3000"];
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    
    next();
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
