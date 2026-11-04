#!/usr/bin/env node
/**
 * Servidor estático para desarrollo local.
 *
 * El sitio usa módulos ES e import maps, que el navegador no carga desde
 * `file://`, así que hace falta servirlo por HTTP aunque no haya empaquetador.
 */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUERTO = Number(process.env.PORT ?? 5173);

const TIPOS = new Map(
  Object.entries({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  })
);

/**
 * Impide que una ruta con `..` escape del directorio del proyecto.
 */
function resolverRuta(url) {
  const relativa = normalize(decodeURIComponent(new URL(url, "http://local").pathname)).replace(
    /^([\\/])+/,
    ""
  );
  const destino = join(RAIZ, relativa || "index.html");
  return destino.startsWith(RAIZ) ? destino : null;
}

const servidor = createServer(async (peticion, respuesta) => {
  const ruta = resolverRuta(peticion.url ?? "/");

  if (!ruta) {
    respuesta.writeHead(403).end("Acceso denegado");
    return;
  }

  try {
    const informacion = await stat(ruta);
    const archivo = informacion.isDirectory() ? join(ruta, "index.html") : ruta;

    // Se comprueba el archivo final antes de responder: pedir una carpeta sin
    // index.html llegaría hasta aquí y el error del stream, ya con las
    // cabeceras enviadas, tumbaría el proceso.
    if (!(await stat(archivo)).isFile()) throw new Error("No es un archivo");

    respuesta.writeHead(200, {
      "Content-Type": TIPOS.get(extname(archivo)) ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });

    const flujo = createReadStream(archivo);
    flujo.on("error", () => respuesta.end());
    flujo.pipe(respuesta);
  } catch {
    respuesta.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    respuesta.end("No encontrado");
  }
});

servidor.listen(PUERTO, () => {
  console.log(`Sitio disponible en http://localhost:${PUERTO}`);
});
