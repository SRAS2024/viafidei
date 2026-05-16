import { describe, expect, it } from "vitest";
import {
  normalizeSacrament,
  SACRAMENT_KEYS,
  isCanonicalSacramentKey,
  SACRAMENT_GROUP_BY_KEY,
} from "@/lib/content-qa/sacrament-normalize";

describe("sacrament normalization", () => {
  it("there are exactly seven canonical sacraments", () => {
    expect(SACRAMENT_KEYS).toHaveLength(7);
    expect([...SACRAMENT_KEYS].sort()).toEqual(
      [
        "anointing_of_the_sick",
        "baptism",
        "confirmation",
        "eucharist",
        "holy_orders",
        "matrimony",
        "reconciliation",
      ].sort(),
    );
  });

  it("Confession is NOT a separate sacrament — it normalizes to Reconciliation", () => {
    const norm = normalizeSacrament({
      title: "Confession",
      body: "The sacrament of Confession is a healing sacrament instituted by Christ.",
    });
    expect(norm.key).toBe("reconciliation");
  });

  it("Penance normalizes to Reconciliation", () => {
    const norm = normalizeSacrament({
      title: "Sacrament of Penance",
      body: "The sacrament of Penance gives grace to the recipient.",
    });
    expect(norm.key).toBe("reconciliation");
  });

  it("Marriage normalizes to Matrimony only with sacramental context", () => {
    const withContext = normalizeSacrament({
      title: "Catholic Marriage",
      body: "Matrimony is a sacrament instituted by Christ. It confers grace on the recipients.",
    });
    expect(withContext.key).toBe("matrimony");
    const withoutContext = normalizeSacrament({
      title: "How to plan a wedding",
      body: "Wedding planning tips.",
    });
    expect(withoutContext.key).toBeNull();
  });

  it("Last Rites normalizes to Anointing of the Sick only with sacramental context", () => {
    const withContext = normalizeSacrament({
      title: "Last Rites",
      body: "The sacrament of Anointing of the Sick, formerly called Last Rites, is a sacrament that confers grace.",
    });
    expect(withContext.key).toBe("anointing_of_the_sick");
  });

  it("Communion normalizes to Eucharist only with sacramental context", () => {
    const withContext = normalizeSacrament({
      title: "First Communion",
      body: "The sacrament of the Eucharist is the source and summit of Christian life. The Eucharistic prayer and the minister are essential.",
    });
    expect(withContext.key).toBe("eucharist");
  });

  it("isCanonicalSacramentKey accepts only the seven keys", () => {
    expect(isCanonicalSacramentKey("baptism")).toBe(true);
    expect(isCanonicalSacramentKey("confession")).toBe(false);
    expect(isCanonicalSacramentKey("blessing_of_throats")).toBe(false);
  });

  it("sacrament groups: 3 of initiation, 2 of healing, 2 of service", () => {
    const initiation = Object.values(SACRAMENT_GROUP_BY_KEY).filter((g) => g === "Initiation");
    const healing = Object.values(SACRAMENT_GROUP_BY_KEY).filter((g) => g === "Healing");
    const service = Object.values(SACRAMENT_GROUP_BY_KEY).filter((g) => g === "Service");
    expect(initiation).toHaveLength(3);
    expect(healing).toHaveLength(2);
    expect(service).toHaveLength(2);
  });
});
