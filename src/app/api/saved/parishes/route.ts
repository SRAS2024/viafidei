import { makeSavedHandlers } from "@/lib/http/saved-routes";
import { listSavedParishes } from "@/lib/data/saved";

export const { GET, POST, DELETE } = makeSavedHandlers("parish", (userId) =>
  listSavedParishes(userId),
);
