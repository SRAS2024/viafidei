import { describe, expect, it } from "vitest";
import { detectWrongContent } from "@/lib/content-qa/wrong-content-detector";

describe("WrongContentDetector", () => {
  it("deletes a Prayer candidate that is actually a livestream page", () => {
    const result = detectWrongContent({
      contentType: "Prayer",
      title: "Watch Live: Rosary from Newton",
      body: "Join us for a livestream of the Rosary on Facebook Live. Click here to register now.",
    });
    expect(result.delete).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/livestream/i);
  });

  it("deletes a Saint candidate that contains parish/school/staff but no biography", () => {
    const result = detectWrongContent({
      contentType: "Saint",
      title: "Saint Mary Parish",
      body: "Office hours: Monday-Friday 9am-5pm. Mass schedule: Sunday 8am, 10am, 12pm. Staff directory available.",
    });
    expect(result.delete).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/saint|institution|wrong-content|signal/i);
  });

  it("keeps a Saint candidate that has biographical vocabulary", () => {
    const result = detectWrongContent({
      contentType: "Saint",
      title: "Saint Anthony of Padua",
      body: "Saint Anthony was born in Lisbon in 1195. He became a Franciscan friar and is the patron saint of lost things. He died in 1231 and was canonized in 1232.",
    });
    expect(result.delete).toBe(false);
  });

  it("deletes a Sacrament candidate that is a registration page", () => {
    const result = detectWrongContent({
      contentType: "Sacrament",
      title: "Baptism Registration",
      body: "Register now for our baptism class. Class sign up opens January 1. Click here to enroll.",
    });
    expect(result.delete).toBe(true);
  });

  it("deletes a Devotion candidate that is an event with no practice", () => {
    const result = detectWrongContent({
      contentType: "Devotion",
      title: "Marian Devotion Retreat",
      body: "Join us for our weekend retreat. Register now. Tickets available at the door.",
    });
    expect(result.delete).toBe(true);
  });

  it("keeps a Devotion candidate with actual practice instructions", () => {
    const result = detectWrongContent({
      contentType: "Devotion",
      title: "Sacred Heart Devotion",
      body: "To pray the Sacred Heart devotion, begin by making the Sign of the Cross. Then recite the opening prayer. Day 1: Reflect on the love of Jesus.",
    });
    expect(result.delete).toBe(false);
  });

  it("deletes a Liturgy candidate that is just a Mass schedule", () => {
    const result = detectWrongContent({
      contentType: "Liturgy",
      title: "Sunday Mass Times",
      body: "Mass schedule: Sunday 8am, 10am, 12pm. Daily Mass at 7am Monday-Friday.",
    });
    expect(result.delete).toBe(true);
  });

  it("deletes a Marian apparition candidate that is a travel/tourism page", () => {
    const result = detectWrongContent({
      contentType: "MarianApparition",
      title: "Visit Lourdes",
      body: "Book your trip to Lourdes. Hotel deals, flight packages, and tour packages available.",
    });
    expect(result.delete).toBe(true);
  });

  it("keeps a Marian apparition candidate that describes the apparition", () => {
    const result = detectWrongContent({
      contentType: "MarianApparition",
      title: "Our Lady of Lourdes",
      body: "Our Lady appeared to Saint Bernadette in 1858 at Lourdes, France. The Blessed Virgin asked for prayer and penance.",
    });
    expect(result.delete).toBe(false);
  });

  it("deletes a Parish candidate that is a bulletin", () => {
    const result = detectWrongContent({
      contentType: "Parish",
      title: "Weekly Parish Bulletin — January 2026",
      body: "Sunday Mass at 10am. Subscribe to our newsletter for weekly updates.",
    });
    expect(result.delete).toBe(true);
  });
});
