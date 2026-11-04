import { describe, expect, it } from "vitest";
import { rankPatients, type SearchablePatient } from "@/core/patients/patient-search";

const patients: SearchablePatient[] = [
  { id: "1", firstName: "María José", lastName: "Gómez Ruiz", email: "majo@correo.co", documentId: "1.020.345.678", phone: "+57 300 123 4567" },
  { id: "2", firstName: "Mario", lastName: "Gonzalez", email: null, documentId: "98765432", phone: "3109876543" },
  { id: "3", firstName: "Carlos", lastName: "Ramírez", email: "carlos.r@mail.com", documentId: null, phone: null },
  { id: "4", firstName: "Andrés", lastName: "Muñoz", email: "andres@mail.com", documentId: "55555555", phone: null },
];

const ids = (query: string) => rankPatients(patients, query).map((p) => p.id);

describe("rankPatients", () => {
  it("consulta vacía devuelve todos en el orden original", () => {
    expect(ids("  ")).toEqual(["1", "2", "3", "4"]);
  });

  it("ignora tildes y mayúsculas", () => {
    expect(ids("maria")).toEqual(["1"]);
    expect(ids("RAMIREZ")).toEqual(["3"]);
    expect(ids("munoz")).toEqual(["4"]);
  });

  it("nombre completo con varias palabras en cualquier orden", () => {
    expect(ids("gomez maria")).toEqual(["1"]);
    expect(ids("maría gómez")).toEqual(["1"]);
  });

  it("búsqueda carácter a carácter por prefijo de palabra", () => {
    expect(ids("m")).toEqual(["1", "2", "4"]);
    expect(ids("ma")).toEqual(["1", "2"]);
    expect(ids("mari")).toEqual(["1", "2"]);
  });

  it("documento y teléfono por dígitos sin importar puntos, espacios o prefijo", () => {
    expect(ids("1020345678")).toEqual(["1"]);
    expect(ids("345.678")).toEqual(["1"]);
    expect(ids("300 123")).toEqual(["1"]);
    expect(ids("9876")).toEqual(["2"]);
  });

  it("email parcial", () => {
    expect(ids("carlos.r@")).toEqual(["3"]);
    expect(ids("andres@mail")).toEqual(["4"]);
  });

  it("tolera errores de tipeo cuando no hay coincidencia exacta", () => {
    expect(ids("gonzales")).toEqual(["2"]);
    expect(ids("carlso")).toEqual(["3"]);
    expect(ids("ramires")).toEqual(["3"]);
  });

  it("con coincidencias exactas no mezcla resultados difusos", () => {
    expect(ids("mario")).toEqual(["2"]);
  });

  it("no inventa coincidencias", () => {
    expect(ids("zzz")).toEqual([]);
    expect(ids("12")).toEqual([]);
    expect(ids("xyzw")).toEqual([]);
  });

  it("prefijo de palabra rankea antes que subcadena interna", () => {
    const list: SearchablePatient[] = [
      { id: "a", firstName: "Ana", lastName: "Solano", email: null, documentId: null, phone: null },
      { id: "b", firstName: "Lana", lastName: "Paz", email: null, documentId: null, phone: null },
      { id: "c", firstName: "Anabel", lastName: "Paz", email: null, documentId: null, phone: null },
    ];
    expect(rankPatients(list, "ana").map((p) => p.id)).toEqual(["a", "c", "b"]);
  });
});
