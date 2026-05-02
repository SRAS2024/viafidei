import { makeSavedHandlers } from "@/lib/http/saved-routes";
import { listSavedSaints } from "@/lib/data/saved";

export const { GET, POST, DELETE } = makeSavedHandlers("saint", listSavedSaints);
