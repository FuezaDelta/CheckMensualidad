import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aDate, diaCalendario, diasEntre, esMismoDiaOPosterior } from "../js/domain/fecha.js";

describe("aDate", () => {
  it("acepta un Timestamp de Firestore", () => {
    const timestamp = { toDate: () => new Date("2026-08-14T10:00:00Z") };
    assert.equal(aDate(timestamp)?.toISOString(), "2026-08-14T10:00:00.000Z");
  });

  it("acepta un Timestamp serializado como {seconds}", () => {
    const timestamp = { seconds: 1786000000, nanoseconds: 0 };
    assert.equal(aDate(timestamp)?.getTime(), 1786000000 * 1000);
  });

  it("acepta cadenas ISO, números y objetos Date", () => {
    assert.equal(aDate("2026-08-14T10:00:00Z")?.toISOString(), "2026-08-14T10:00:00.000Z");
    assert.equal(aDate(0)?.getTime(), 0);
    assert.equal(aDate(new Date(0))?.getTime(), 0);
  });

  it("interpreta una fecha sin hora como ese día en Colombia, no en UTC", () => {
    const fecha = aDate("2026-08-14");
    assert.equal(fecha?.toISOString(), "2026-08-14T05:00:00.000Z");
    assert.equal(diaCalendario(/** @type {Date} */ (fecha)), "2026-08-14");
    assert.equal(esMismoDiaOPosterior(/** @type {Date} */ (fecha), new Date("2026-08-15T04:59:00Z")), true);
    assert.equal(aDate("2026-02-30"), null);
  });

  it("devuelve null cuando el valor no representa una fecha", () => {
    assert.equal(aDate(null), null);
    assert.equal(aDate(undefined), null);
    assert.equal(aDate("no es una fecha"), null);
    assert.equal(aDate(new Date("inválida")), null);
  });
});

describe("diaCalendario", () => {
  it("usa la zona horaria de Colombia, no la del sistema", () => {
    // 02:00 UTC del 15 son las 21:00 del 14 en Bogotá.
    assert.equal(diaCalendario(new Date("2026-08-15T02:00:00Z")), "2026-08-14");
    // 05:00 UTC del 15 es la medianoche exacta del 15 en Bogotá.
    assert.equal(diaCalendario(new Date("2026-08-15T05:00:00Z")), "2026-08-15");
  });
});

describe("esMismoDiaOPosterior", () => {
  const vencimiento = new Date("2026-08-14T05:00:00Z");

  it("cuenta el día de vencimiento como vigente hasta el final", () => {
    assert.equal(esMismoDiaOPosterior(vencimiento, new Date("2026-08-14T23:59:00Z")), true);
  });

  it("deja de ser vigente a partir del día siguiente", () => {
    assert.equal(esMismoDiaOPosterior(vencimiento, new Date("2026-08-15T05:00:00Z")), false);
  });
});

describe("diasEntre", () => {
  it("cuenta días de calendario en Colombia, no horas", () => {
    // Lunes 23:59 y martes 00:01 en Bogotá: un día de diferencia.
    assert.equal(diasEntre(new Date("2026-08-11T04:59:00Z"), new Date("2026-08-11T05:01:00Z")), 1);
    // El mismo día en Bogotá aunque en UTC ya sea el siguiente.
    assert.equal(diasEntre(new Date("2026-08-14T12:00:00Z"), new Date("2026-08-15T02:00:00Z")), 0);
  });

  it("es negativo hacia atrás y cruza meses y años", () => {
    assert.equal(diasEntre(new Date("2026-03-01T15:00:00Z"), new Date("2026-02-27T15:00:00Z")), -2);
    assert.equal(diasEntre(new Date("2026-12-31T15:00:00Z"), new Date("2027-01-01T15:00:00Z")), 1);
  });
});
