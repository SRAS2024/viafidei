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

  it("does NOT delete a long valid Devotion that mentions 'event' twice in a long body (spec #6 density-aware)", () => {
    // Spec #6/#9: two isolated weak phrases in a long valid devotion
    // should not be fatal — the body rule is density-aware. The body
    // here is ~600 words; two strong matches at low density should
    // pass when the body carries strong devotion practice markers.
    const longDevotion = [
      "The Divine Mercy Chaplet is a devotion given to Saint Faustina Kowalska.",
      // Strong devotion practice vocabulary throughout.
      "How to pray the Divine Mercy Chaplet: begin by making the sign of the cross. " +
        "Then recite the Our Father, Hail Mary, and the Apostles' Creed. " +
        "On the large bead before each decade, pray: Eternal Father, I offer You the Body and Blood, Soul and Divinity of Your dearly beloved Son, Our Lord Jesus Christ, in atonement for our sins and those of the whole world. " +
        "On the ten small beads of each decade, pray: For the sake of His sorrowful Passion, have mercy on us and on the whole world. " +
        "Conclude the chaplet by reciting three times: Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.",
      // Two weak "event" mentions far from positive content, in footer.
      "Upcoming events: nothing currently scheduled. For news about upcoming events, check the parish website.",
      "End of page.",
    ].join("\n\n");
    const result = detectWrongContent({
      contentType: "Devotion",
      title: "The Divine Mercy Chaplet",
      body: longDevotion,
    });
    // Two 'event' matches alone in a long valid body should not be
    // fatal; the strong density-aware rule + the per-type rule both
    // require the positive marker to be missing.
    expect(result.delete).toBe(false);
  });

  it("does delete a body that is mostly chrome (high density of strong signals)", () => {
    // Density rule kicks in when signals/words is high.
    const chromeBody =
      "Donate now to support us. Subscribe to our newsletter. Watch live every Sunday. " +
      "Register now for our retreat. Make a donation today. Click here to register.";
    const result = detectWrongContent({
      contentType: "Devotion",
      title: "Devotional Page",
      body: chromeBody,
    });
    expect(result.delete).toBe(true);
  });
});
