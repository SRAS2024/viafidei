import { watchNavigation } from "@/lib/navigation/watch-navigation";

// Next calls this as each client navigation starts. Watching from here rather than
// listening for clicks covers router.push and router.replace too, with no guessing about
// which pressed links are navigations and which only open a dialog.
export const onRouterTransitionStart = watchNavigation;
