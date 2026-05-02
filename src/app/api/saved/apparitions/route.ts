import { makeSavedHandlers } from "@/lib/http/saved-routes";
import { listSavedApparitions } from "@/lib/data/saved";

export const { GET, POST, DELETE } = makeSavedHandlers("apparition", listSavedApparitions);
