/**
 * Configuración de la aplicación.
 *
 * Los valores de `firebase` son identificadores públicos por diseño (viajan en
 * cualquier petición del navegador), NO son secretos. Lo que realmente protege
 * los datos son las reglas de `firestore.rules`, la restricción de la API key
 * por dominio en Google Cloud Console y App Check.
 */

export const config = Object.freeze({
  firebase: Object.freeze({
    apiKey: "AIzaSyDbcFwU9csObsWGSPhGnz_ixiOkIDo_xX0",
    authDomain: "manejo-65354.firebaseapp.com",
    projectId: "manejo-65354",
    storageBucket: "manejo-65354.firebasestorage.app",
    messagingSenderId: "755604413866",
    appId: "1:755604413866:web:e90fbe5d5e0b814cb71fd3",
    measurementId: "G-K8RYF3G36P",
  }),

  /**
   * Clave de sitio de reCAPTCHA v3 para Firebase App Check. Mientras esté vacía
   * no hay nada que impida que un script automatizado golpee el backend.
   * Se obtiene en la consola de Firebase → App Check → Apps → Web.
   */
  appCheck: Object.freeze({
    siteKey: "",
  }),

  functions: Object.freeze({
    region: "us-central1",
  }),

  membresias: Object.freeze({
    /**
     * De dónde se leen las membresías:
     *
     *   "firestore" → El navegador lee el documento directamente, pidiéndolo por
     *                 su identificador, que es el teléfono normalizado. Funciona
     *                 en el plan gratuito y no permite descargar la colección,
     *                 porque las reglas prohíben listarla. El estado se calcula
     *                 con el reloj del dispositivo.
     *   "function"  → Cloud Function `consultarMembresia`. Cierra la colección
     *                 por completo al navegador y calcula el estado con el reloj
     *                 del servidor, pero las Cloud Functions no existen en el
     *                 plan gratuito de Firebase: exigen el plan Blaze.
     */
    backend: "firestore",
  }),
});
