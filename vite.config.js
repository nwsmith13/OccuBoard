import { cpSync, createReadStream, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  if (env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
  if (env.OPENAI_MODEL) process.env.OPENAI_MODEL = env.OPENAI_MODEL;

  return {
    plugins: [
      react(),
      {
        name: "occuboard-static-assets",
        configureServer(server) {
          server.middlewares.use("/assets", (req, res, next) => {
            const requested = decodeURIComponent((req.url || "").split("?")[0]).replace(/^\/+/, "");
            const filePath = resolve(rootDir, "assets", requested);
            if (!filePath.startsWith(resolve(rootDir, "assets")) || !existsSync(filePath)) {
              next();
              return;
            }
            res.setHeader("content-type", "image/svg+xml");
            createReadStream(filePath).pipe(res);
          });
        },
        closeBundle() {
          const source = resolve(rootDir, "assets");
          const target = resolve(rootDir, "dist", "assets");
          if (!existsSync(source)) return;
          mkdirSync(target, { recursive: true });
          cpSync(source, target, { recursive: true });
        },
      },
      {
        name: "occuboard-local-api",
        configureServer(server) {
          server.middlewares.use("/api/generate", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }
            try {
              const chunks = [];
              for await (const chunk of req) chunks.push(chunk);
              req.body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
              const routeUrl = pathToFileURL(resolve(rootDir, "api/generate.js")).href;
              const { default: handler } = await import(`${routeUrl}?t=${Date.now()}`);
              await handler(req, res);
            } catch (error) {
              res.statusCode = 500;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ error: error.message }));
            }
          });
        },
      },
    ],
  };
});
