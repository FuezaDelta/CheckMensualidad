/**
 * Punto único de inicialización de Firebase.
 *
 * Los módulos de `js/vendor/` los genera `npm run build` y solo reexportan el
 * SDK desde el CDN, de modo que la versión se define en un único lugar
 * (`templates/site.json`) y no puede desalinearse entre módulos.
 */

import { initializeApp } from "../vendor/firebase-app.js";
import { getFirestore } from "../vendor/firebase-firestore.js";
import { config } from "../config.js";

/** @type {Promise<import("../vendor/firebase-app.js").FirebaseApp>|null} */
let appPromesa = null;

function inicializar() {
  const app = initializeApp(config.firebase);

  if (!config.appCheck.siteKey) return Promise.resolve(app);

  return import("../vendor/firebase-app-check.js")
    .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(config.appCheck.siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      return app;
    })
    .catch((error) => {
      // Sin App Check la app sigue funcionando; solo pierde la protección
      // contra automatización, así que no vale la pena romper la página.
      console.error("No se pudo inicializar App Check:", error);
      return app;
    });
}

function obtenerApp() {
  if (!appPromesa) appPromesa = inicializar();
  return appPromesa;
}

export async function obtenerFirestore() {
  return getFirestore(await obtenerApp());
}

export async function llamarFuncion(nombre, datos) {
  const [{ getFunctions, httpsCallable }, app] = await Promise.all([
    import("../vendor/firebase-functions.js"),
    obtenerApp(),
  ]);

  const functions = getFunctions(app, config.functions.region);
  const resultado = await httpsCallable(functions, nombre)(datos);
  return resultado.data;
}
