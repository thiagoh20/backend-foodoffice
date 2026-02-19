import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import express, { type Express, type Request, type Response } from "express";
import * as db from "../db.js";
import { getSessionCookieOptions } from "./cookies.js";
import { sdk } from "./sdk.js";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    // Verificar si OAuth está configurado
    const { ENV } = await import("./env.js");
    if (!ENV.oAuthServerUrl) {
      console.error("[OAuth] OAuth callback called but OAuth is not configured");
      res.status(400).json({ 
        error: "OAuth is not configured", 
        details: "Please configure OAUTH_SERVER_URL in your .env file" 
      });
      return;
    }

    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const error = getQueryParam(req, "error");
    const errorDescription = getQueryParam(req, "error_description");

    // Si Auth0 devuelve un error
    if (error) {
      console.error("[OAuth] Auth0 error:", error, errorDescription);
      res.status(400).json({ 
        error: "OAuth authentication failed", 
        details: errorDescription || error 
      });
      return;
    }

    if (!code || !state) {
      console.error("[OAuth] Missing code or state", { code: !!code, state: !!state });
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      console.log("[OAuth] Processing callback with code and state");
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      console.log("[OAuth] Token exchange successful");
      
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      console.log("[OAuth] User info retrieved:", { openId: userInfo.openId, name: userInfo.name });

      if (!userInfo.openId) {
        console.error("[OAuth] openId missing from user info");
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Normalizar loginMethod: convertir cadenas vacías a null
      const loginMethod = userInfo.loginMethod || userInfo.platform || null;
      const normalizedLoginMethod = (loginMethod === "" || loginMethod === null) ? null : loginMethod;

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: normalizedLoginMethod,
        lastSignedIn: new Date(),
      });
      console.log("[OAuth] User upserted successfully");

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      console.log("[OAuth] Session token created");

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      console.log("[OAuth] Cookie set, redirecting to /");

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      if (error instanceof Error) {
        console.error("[OAuth] Error details:", error.message, error.stack);
      }
      res.status(500).json({ 
        error: "OAuth callback failed", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
