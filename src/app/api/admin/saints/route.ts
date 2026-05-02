import { makeAdminCatalogIndex } from "@/lib/http/admin-catalog-routes";
import { createSaint, updateSaint, deleteSaint } from "@/lib/data/admin-catalog";
import { listAdminSaints } from "@/lib/data/saints";
import { saintCreateSchema, saintUpdateSchema } from "@/lib/data/admin-catalog-schemas";

export const { GET, POST } = makeAdminCatalogIndex({
  entityType: "Saint",
  list: () => listAdminSaints(),
  createSchema: saintCreateSchema,
  updateSchema: saintUpdateSchema,
  create: createSaint,
  update: updateSaint,
  remove: deleteSaint,
});
