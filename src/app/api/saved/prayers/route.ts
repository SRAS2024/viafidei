import { makeSavedHandlers } from "@/lib/http/saved-routes";
import { listSavedPrayers } from "@/lib/data/saved";

export const { GET, POST, DELETE } = makeSavedHandlers("prayer", listSavedPrayers);
