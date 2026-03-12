import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import openaiHandler from "./api/openai.js";
import fetchPageHandler from "./api/fetch-page.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      {
        name: "local-api",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith("/api/")) return next();

            // Express-like helpers
            res.status = (code) => { res.statusCode = code; return res; };
            res.json = (data) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(data));
            };

            // Body parsing
            await new Promise((resolve) => {
              let body = "";
              req.on("data", (chunk) => { body += chunk; });
              req.on("end", () => { req.body = body || "{}"; resolve(); });
            });

            // Inject env vars from .env.local
            process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;

            const apiPath = req.url.split("?")[0];
            try {
              if (apiPath === "/api/openai") {
                await openaiHandler(req, res);
              } else if (apiPath === "/api/fetch-page") {
                await fetchPageHandler(req, res);
              } else {
                next();
              }
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: { message: err.message } }));
            }
          });
        },
      },
    ],
  };
});
