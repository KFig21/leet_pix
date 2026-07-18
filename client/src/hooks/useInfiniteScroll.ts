import { useEffect, useRef } from "react";

// Returns a ref to attach to a sentinel element near the end of a list. When it
// scrolls into view (with generous rootMargin so loading starts early) and
// `enabled` is true, `onLoadMore` fires. Use with react-query's useInfiniteQuery:
//   const ref = useInfiniteScroll(fetchNextPage, hasNextPage && !isFetchingNextPage)
export function useInfiniteScroll(onLoadMore: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest callback without re-creating the observer each render.
  const cb = useRef(onLoadMore);
  cb.current = onLoadMore;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) cb.current();
      },
      { rootMargin: "600px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled]);

  return ref;
}
