import { describe, expect, it } from "vitest";
import { detectSearchIntent } from "@/lib/data/search";

describe("detectSearchIntent", () => {
  it("treats a 'City, State' query as a parish lookup", () => {
    expect(detectSearchIntent("Boston, MA")).toBe("parish");
    expect(detectSearchIntent("Madrid, Spain")).toBe("parish");
  });

  it("treats parish / church / cathedral / diocese keywords as parish", () => {
    expect(detectSearchIntent("Saint Mary's parish")).toBe("parish");
    expect(detectSearchIntent("nearest church")).toBe("parish");
    expect(detectSearchIntent("Archdiocese of New York")).toBe("parish");
    expect(detectSearchIntent("cathedral near me")).toBe("parish");
  });

  it("treats a bare US state abbreviation as a parish lookup", () => {
    expect(detectSearchIntent("ma")).toBe("parish");
    expect(detectSearchIntent("NY")).toBe("parish");
  });

  it("treats Marian-apparition language as apparition", () => {
    expect(detectSearchIntent("Our Lady of Fatima")).toBe("apparition");
    expect(detectSearchIntent("Lourdes apparition")).toBe("apparition");
    expect(detectSearchIntent("Guadalupe")).toBe("apparition");
  });

  it("treats angel-related queries as angel", () => {
    expect(detectSearchIntent("Saint Michael the Archangel")).toBe("angel");
    expect(detectSearchIntent("guardian angel prayer")).toBe("angel");
  });

  it("treats sacrament-related queries as sacrament", () => {
    expect(detectSearchIntent("confession guide")).toBe("sacrament");
    expect(detectSearchIntent("first communion")).toBe("sacrament");
    expect(detectSearchIntent("Marian consecration")).toBe("sacrament");
  });

  it("treats prayer-keyword queries as prayer", () => {
    expect(detectSearchIntent("Anima Christi")).toBe("prayer");
    expect(detectSearchIntent("Hail Mary")).toBe("prayer");
    expect(detectSearchIntent("daily rosary")).toBe("prayer");
    expect(detectSearchIntent("litany of humility")).toBe("prayer");
  });

  it("treats a leading saint title as a saint search", () => {
    expect(detectSearchIntent("Saint Therese of Lisieux")).toBe("saint");
    expect(detectSearchIntent("st. Anthony of Padua")).toBe("saint");
    expect(detectSearchIntent("blessed Carlo Acutis")).toBe("saint");
  });

  it("returns 'any' when no signals match", () => {
    expect(detectSearchIntent("hello world")).toBe("any");
    expect(detectSearchIntent("")).toBe("any");
  });
});
