/**
 * Componentes comunes a todas las páginas: navegación, panel de planes y
 * transiciones. Cablear las dependencias aquí, en un solo lugar, evita que los
 * componentes se busquen entre sí a través del DOM global.
 */

import { activarAnimaciones } from "./ui/animaciones.js";
import { crearNavegacion } from "./ui/navegacion.js";
import { crearPanelPlanes } from "./ui/panel-planes.js";
import { activarTransiciones } from "./ui/transiciones.js";

export function iniciarPagina() {
  activarTransiciones();
  activarAnimaciones();

  const navegacion = crearNavegacion();
  const panelPlanes = crearPanelPlanes({ navegacion });

  return { navegacion, panelPlanes };
}
