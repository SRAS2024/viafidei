import { makeAdminCatalogIndex } from "@/lib/http/admin-catalog-routes";
import { createDevotion, updateDevotion, deleteDevotion } from "@/lib/data/admin-catalog";
import { listAdminDevotions } from "@/lib/data/devotions";
import { devotionCreateSchema, devotionUpdateSchema } from "@/lib/data/admin-catalog-schemas";

export const { GET, POST } = makeAdminCatalogIndex({
  entityType: "Devotion",
  list: () => listAdminDevotions(),
  createSchema: devotionCreateSchema,
  updateSchema: devotionUpdateSchema,
  create: createDevotion,
  update: updateDevotion,
  remove: deleteDevotion,
});
