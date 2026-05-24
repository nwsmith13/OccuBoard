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
