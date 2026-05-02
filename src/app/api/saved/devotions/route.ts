import { makeSavedHandlers } from "@/lib/http/saved-routes";
import { listSavedDevotions } from "@/lib/data/saved";

export const { GET, POST, DELETE } = makeSavedHandlers("devotion", listSavedDevotions);
