import { makeAdminCatalogIndex } from "@/lib/http/admin-catalog-routes";
import { createLiturgy, updateLiturgy, deleteLiturgy } from "@/lib/data/admin-catalog";
import { listAdminLiturgyEntries } from "@/lib/data/liturgy";
import { liturgyCreateSchema, liturgyUpdateSchema } from "@/lib/data/admin-catalog-schemas";

export const { GET, POST } = makeAdminCatalogIndex({
  entityType: "LiturgyEntry",
  list: () => listAdminLiturgyEntries(),
  createSchema: liturgyCreateSchema,
  updateSchema: liturgyUpdateSchema,
  create: createLiturgy,
  update: updateLiturgy,
  remove: deleteLiturgy,
});
