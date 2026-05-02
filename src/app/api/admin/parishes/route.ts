import { makeAdminCatalogIndex } from "@/lib/http/admin-catalog-routes";
import { createParish, updateParish, deleteParish } from "@/lib/data/admin-catalog";
import { listAdminParishes } from "@/lib/data/parishes";
import { parishCreateSchema, parishUpdateSchema } from "@/lib/data/admin-catalog-schemas";

export const { GET, POST } = makeAdminCatalogIndex({
  entityType: "Parish",
  list: () => listAdminParishes(),
  createSchema: parishCreateSchema,
  updateSchema: parishUpdateSchema,
  create: createParish,
  update: updateParish,
  remove: deleteParish,
});
