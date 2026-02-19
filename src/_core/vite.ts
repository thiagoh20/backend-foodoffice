import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config.js";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    
    // Skip API routes - they should be handled by Express routes
    if (url.startsWith("/api/")) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      
      // Replace analytics placeholders or remove script if not configured
      const analyticsEndpoint = process.env.VITE_ANALYTICS_ENDPOINT;
      const analyticsWebsiteId = process.env.VITE_ANALYTICS_WEBSITE_ID;
      
      if (analyticsEndpoint && analyticsWebsiteId) {
        template = template.replace(
          /%VITE_ANALYTICS_ENDPOINT%/g,
          analyticsEndpoint
        );
        template = template.replace(
          /%VITE_ANALYTICS_WEBSITE_ID%/g,
          analyticsWebsiteId
        );
      } else {
        // Remove the analytics script if variables are not configured
        // Remove the comment line (non-greedy match)
        template = template.replace(
          /<!-- Analytics script will be conditionally included[^]*?-->\s*/g,
          ""
        );
        // Remove the script tag - match from <script to </script> including newlines
        // This regex matches the entire script tag with any whitespace
        template = template.replace(
          /<script\s+defer[\s\S]*?src="%VITE_ANALYTICS_ENDPOINT%\/umami"[\s\S]*?data-website-id="%VITE_ANALYTICS_WEBSITE_ID%"[\s\S]*?><\/script>\s*/g,
          ""
        );
        // Fallback: remove any script tag containing the analytics endpoint placeholder
        template = template.replace(
          /<script[^>]*%VITE_ANALYTICS_ENDPOINT%[^>]*><\/script>\s*/g,
          ""
        );
        // Clean up any remaining placeholders that might have been left behind
        template = template.replace(
          /%VITE_ANALYTICS_ENDPOINT%/g,
          ""
        );
        template = template.replace(
          /%VITE_ANALYTICS_WEBSITE_ID%/g,
          ""
        );
      }
      
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      console.error("[Vite] Error transforming HTML:", e);
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
