import { makeAdminCatalogItem } from "@/lib/http/admin-catalog-routes";
import {
  createSpiritualLifeGuide,
  updateSpiritualLifeGuide,
  deleteSpiritualLifeGuide,
} from "@/lib/data/admin-catalog";
import { listAdminSpiritualLifeGuides } from "@/lib/data/spiritual-life";
import {
  spiritualLifeCreateSchema,
  spiritualLifeUpdateSchema,
} from "@/lib/data/admin-catalog-schemas";

export const { PATCH, DELETE } = makeAdminCatalogItem({
  entityType: "SpiritualLifeGuide",
  list: () => listAdminSpiritualLifeGuides(),
  createSchema: spiritualLifeCreateSchema,
  updateSchema: spiritualLifeUpdateSchema,
  create: createSpiritualLifeGuide,
  update: updateSpiritualLifeGuide,
  remove: deleteSpiritualLifeGuide,
});
