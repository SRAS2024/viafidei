import { makeAdminCatalogItem } from "@/lib/http/admin-catalog-routes";
import { createApparition, updateApparition, deleteApparition } from "@/lib/data/admin-catalog";
import { listAdminApparitions } from "@/lib/data/apparitions";
import { apparitionCreateSchema, apparitionUpdateSchema } from "@/lib/data/admin-catalog-schemas";

export const { PATCH, DELETE } = makeAdminCatalogItem({
  entityType: "MarianApparition",
  list: () => listAdminApparitions(),
  createSchema: apparitionCreateSchema,
  updateSchema: apparitionUpdateSchema,
  create: createApparition,
  update: updateApparition,
  remove: deleteApparition,
});
