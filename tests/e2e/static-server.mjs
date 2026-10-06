// Servidor estático mínimo para probar un build de producción (con service
// worker) sin Vite ni red. Sirve index.html para rutas de la SPA y permite
// cambiar la carpeta servida en caliente para simular un deploy nuevo.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webp": "image/webp", ".txt": "text/plain",
  ".xml": "application/xml", ".mp4": "video/mp4", ".woff2": "font/woff2",
};

export async function startStaticServer(root, { port }) {
  const state = { root };
  const server = http.createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(state.root, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ""));
    const send = async (f, status = 200) => {
      const body = await readFile(f);
      // Sin caché HTTP: lo que se prueba es el caché del service worker.
      res.writeHead(status, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(body);
    };
    try {
      await send(file);
    } catch {
      if (path.extname(pathname)) { res.writeHead(404); res.end(); return; }
      await send(path.join(state.root, "index.html")).catch(() => { res.writeHead(500); res.end(); });
    }
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return { setRoot: (dir) => { state.root = dir; }, close: () => server.close() };
}
