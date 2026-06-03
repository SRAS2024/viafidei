import { makeSavedHandlers } from "@/lib/http/saved-routes";
import { listSavedNovenas } from "@/lib/data/saved";

export const { GET, POST, DELETE } = makeSavedHandlers("novena", listSavedNovenas);
