# Fuerza Delta — Consulta de membresías

Sitio del gimnasio Fuerza Delta (Apartadó, Antioquia). Un cliente escribe su
número de celular y ve el estado y la fecha de vencimiento de su membresía.
También publica los horarios de clases, los datos de contacto y los planes
vigentes.

Es un sitio estático (HTML, CSS y JavaScript con módulos ES, sin empaquetador)
más una Cloud Function que resuelve las consultas de membresía.

---

## ⚠️ Cómo se consulta una membresía, y por qué importa el identificador

`js/config.js` viene con `membresias.backend: "firestore"`. El navegador pide el
documento `usuarios/{celular}` directamente, y `firestore.rules` permite `get`
pero prohíbe `list`: se puede leer el registro de un número que ya se conoce,
pero no recorrer la colección para descargarla. Todo esto funciona en el plan
gratuito de Firebase.

De ahí sale la regla que no se puede romper: **el identificador de cada documento
de `usuarios` tiene que ser el celular normalizado a 10 dígitos.** Un documento
con identificador automático es invisible para el sitio, aunque su campo
`telefono` sea correcto. Al crear clientes a mano en la consola de Firebase hay
que escribir el celular como ID del documento; para arreglar los que no cumplan
está [la migración](#migración-de-identificadores).

El modo `"function"` usa la Cloud Function de `functions/`, que cierra la
colección por completo y calcula el estado con el reloj del servidor. Es mejor en
seguridad y en precisión, pero **las Cloud Functions no existen en el plan
gratuito**: exigen el plan Blaze, con tarjeta asociada. El código está listo por
si algún día se cambia de plan.

La contrapartida de no tener servidor es que el estado se calcula con el reloj
del dispositivo: quien atrase el reloj de su teléfono puede ver como vigente una
membresía vencida. No expone los datos de nadie más, y en la puerta del gimnasio
manda el registro, no la pantalla del cliente.

---

## Puesta en marcha

Requiere Node.js 20 o superior.

```bash
npm install     # solo para linter y herramientas de desarrollo
npm run build   # genera los HTML de la raíz desde templates/
npm run dev     # sirve el sitio en http://localhost:5173
```

El sitio usa módulos ES, así que hay que servirlo por HTTP: abrir los archivos
con doble clic (`file://`) no funciona.

### Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run build` | Genera los tres HTML y `js/vendor/`, y copia `js/domain/` a `functions/`. |
| `npm run build:check` | Falla si algún archivo generado quedó desactualizado. Lo usa CI. |
| `npm run dev` | Servidor estático local. |
| `npm run migrar-telefonos` | Pone el celular como identificador de los documentos de `usuarios`. Ver [Migración](#migración-de-identificadores). |
| `npm test` | Tests unitarios de la lógica de negocio y de las páginas generadas. |
| `npm run lint` | ESLint. |
| `npm run verify` | Los tres anteriores; es lo mismo que corre CI. |

---

## Estructura

```
templates/          Fuente de las páginas HTML
  layout.html         Esqueleto común
  partials/           head, header, sidebar, footer y panel de planes (comunes),
                      y los bloques de horarios y contacto, que las páginas
                      incluyen con {{> nombre}}
  pages/              Contenido propio de cada página + su metadata
  site.json           Nombre del sitio, URL y versión del SDK de Firebase

js/
  config.js           Configuración: Firebase, App Check, backend de membresías
  domain/             Reglas de negocio puras (sin DOM ni red). Se comparten
                      con la Cloud Function y son lo que cubren los tests.
  services/           Acceso a datos: membresías y planes
  lib/                Firebase, formateo y utilidades de DOM
  ui/                 Componentes de pantalla
  pages/              Punto de entrada de cada página
  vendor/             ⚠️ Generado: reexporta el SDK de Firebase desde el CDN

functions/          Cloud Function de consulta de membresías
scripts/            Build y servidor de desarrollo
tests/              Tests con el runner de Node
css/styles.css      Estilos
index.html          ⚠️ Generado: editar templates/, no estos archivos
horarios.html       ⚠️ Generado
contactenos.html    ⚠️ Generado
```

### Por qué el HTML se genera

El encabezado, el menú lateral y el panel de planes son idénticos en las tres
páginas. Antes estaban copiados tres veces y bastaba con olvidar uno al hacer un
cambio para que quedaran desincronizados. Ahora se editan una sola vez en
`templates/partials/` y `npm run build` los compone; CI verifica con
`build:check` que lo publicado corresponda a las plantillas.

### Por qué `js/domain/` se copia a `functions/`

El navegador y el servidor tienen que aplicar exactamente las mismas reglas
(qué es un teléfono válido, cuándo vence una membresía). El despliegue de
funciones solo sube el contenido de `functions/`, así que `npm run build` copia
allí una réplica de `js/domain/`. La copia está en `.gitignore`: la única fuente
es `js/domain/`.

---

## Modelo de datos

Colección `usuarios`. El **identificador del documento es el celular** de 10
dígitos (`3103982286`), y es la única forma de encontrar el registro:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `nombre`, `apellido` | string | |
| `telefono` | string | Igual al identificador; se conserva por comodidad. |
| `fechaFinMembresia` | Timestamp | Fuente de verdad del estado. |
| `estadoMembresia` | string | Solo se usa si no hay fecha. |

Como las reglas no pueden filtrar campos, un `get` devuelve el documento
completo. **No guardar aquí nada que no se le pueda mostrar a quien conozca el
número:** ni cédula, ni dirección, ni notas internas. Si algún día hacen falta,
van en otra colección cerrada.

Colección `planes` (pública):

| Campo | Tipo |
| --- | --- |
| `nombre` | string |
| `precio` | number |
| `duracionDias` | number |
| `activo` | boolean |

Una membresía está **activa** hasta el final de su día de vencimiento, medido en
la zona horaria `America/Bogotá`. Si un documento no tiene fecha ni estado
reconocible, la página no adivina: muestra un mensaje pidiendo contactar al
gimnasio.

---

## Migración de identificadores

`scripts/migrar-telefonos.mjs` renombra los documentos de `usuarios` para que su
identificador sea el celular normalizado. Solo hace falta una vez, y después cada
cliente nuevo ya se crea con el identificador correcto.

Necesita una clave de cuenta de servicio, porque el Admin SDK es lo único que
puede escribir con las reglas cerradas: consola de Firebase → Configuración del
proyecto → Cuentas de servicio → *Generar nueva clave privada*. Guarda el archivo
como `clave-servicio.json` en la raíz; está en `.gitignore` porque da control
total del proyecto. Bórralo cuando termines.

```bash
npm run migrar-telefonos              # informa qué haría; no escribe nada
npm run migrar-telefonos -- --aplicar # ejecuta la migración
```

Se detiene sin tocar nada si dos clientes comparten el mismo número. Si algún
documento de `pagos` apunta a un identificador que cambiaría, actualiza el
campo `usuarioId` al celular nuevo. Al aplicarla crea primero todos los
documentos nuevos, luego corrige pagos, y solo después borra los antiguos: si
algo falla a mitad quedan duplicados, que son recuperables, en lugar de huecos.

---

## Despliegue

```bash
npm install -g firebase-tools
firebase login

npm run build
firebase deploy --only firestore:rules      # 1. reglas de acceso a los datos
firebase deploy --only hosting              # 2. publicar el sitio
```

La Cloud Function de `functions/` no se despliega: requiere el plan Blaze y el
sitio no la usa. Si algún día se cambia de plan, se añade
`firebase deploy --only functions` y se pone `backend: "function"` en
`js/config.js`.

### Endurecimiento pendiente (recomendado)

1. **Restringir la API key por dominio.** Google Cloud Console → APIs y
   servicios → Credenciales → la clave del navegador → restricción por
   *HTTP referrers*, dejando solo los dominios del sitio. Es la defensa más
   barata contra que alguien use tu proyecto desde otra página.
2. **Activar App Check.** Consola de Firebase → App Check → registrar la app web
   con reCAPTCHA v3, y poner la clave en `appCheck.siteKey` de `js/config.js`.
   Con App Check en modo obligatorio para Firestore, un script fuera de un
   navegador real no puede probar números en masa.

---

## Decisiones que conviene conocer

- **El contenido dinámico se construye con nodos del DOM, nunca con
  `innerHTML`.** Los nombres de clientes y de planes vienen de la base de datos;
  interpolarlos como HTML permitiría ejecutar código guardado en un campo.
- **La fecha de vencimiento manda sobre el campo `estadoMembresia`**, porque el
  segundo queda desactualizado solo con que pase el tiempo.
- **La versión del SDK de Firebase se declara una sola vez**, en
  `templates/site.json`. El build genera con ella los módulos de `js/vendor/`,
  que solo reexportan el CDN. Un import map habría sido más directo, pero va
  inline en el HTML y la política de seguridad de contenido de `firebase.json`
  no admite scripts inline; por eso `npm test` verifica que no haya ninguno.
- **La animación de entrada es CSS puro.** Antes dependía de que JavaScript
  añadiera una clase, así que un fallo de red dejaba la página en blanco.
- **Las animaciones al hacer scroll son una mejora progresiva.** El CSS solo
  oculta los bloques con `data-revelar` cuando `js/ui/animaciones.js` añade la
  clase `js-revelar` al documento. Las fotos de la portada rotan solo con CSS.
  Todo se desactiva con la preferencia del sistema de reducir movimiento.
- **Fotos.** Están en `assets/` (`FD*.jpeg|jpg`). La portada usa FD9, FD8 y
  FD10; la galería de comunidad FD3, FD2, FD5 y FD6; competencias FD7; las
  cabeceras de Horarios y Contáctenos FD5 y FD3. FD1 y FD4 no se publican
  porque aparecen menores de edad. Cada `<img>` declara `width` y `height`
  reales para que la página no salte al cargar.

## Deuda técnica conocida

- **El estado se calcula con el reloj del dispositivo**, porque sin Cloud
  Function no hay reloj de servidor al que preguntar. Atrasar el reloj del
  teléfono deja ver como vigente una membresía vencida. Se resuelve pasando a
  `backend: "function"` si el proyecto llega al plan Blaze.
- Las fotos de `assets/` pesan entre 100 y 200 KB cada una; convertirlas a
  WebP y reducirlas al tamaño en que se muestran aceleraría la carga en datos
  móviles.
- `assets/logo-fd.jpeg` pesa 140 KB para mostrarse a 44 px; convertirlo a WebP
  reduciría bastante la carga en datos móviles.
