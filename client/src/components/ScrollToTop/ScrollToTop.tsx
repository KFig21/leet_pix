import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Reset scroll to the top on every route (path) change, so a new page never
// opens scrolled to where the previous one was. Query-string changes (e.g.
// filters) are ignored — only the path. Renders nothing.
export function ScrollToTop() {
  const { pathname } = useLocation();

  // Turn off the browser's automatic scroll restoration once. Left on, it
  // races our reset on back/forward and can leave a page nudged down — enough
  // that its top tucks under the sticky page header.
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    // Run after the new page has painted so the reset wins over layout settling
    // (and iOS, which sometimes ignores an immediate scrollTo mid-navigation).
    const id = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
