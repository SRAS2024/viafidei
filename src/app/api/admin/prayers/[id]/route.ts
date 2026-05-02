import { makeAdminCatalogItem } from "@/lib/http/admin-catalog-routes";
import { createPrayer, updatePrayer, deletePrayer } from "@/lib/data/admin-catalog";
import { listAdminPrayers } from "@/lib/data/prayers";
import { prayerCreateSchema, prayerUpdateSchema } from "@/lib/data/admin-catalog-schemas";

export const { PATCH, DELETE } = makeAdminCatalogItem({
  entityType: "Prayer",
  list: () => listAdminPrayers(),
  createSchema: prayerCreateSchema,
  updateSchema: prayerUpdateSchema,
  create: createPrayer,
  update: updatePrayer,
  remove: deletePrayer,
});
