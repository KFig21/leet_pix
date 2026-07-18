import { useEffect, useRef, type RefObject } from "react";

interface Options {
  // Scroll container to observe against, for a sentinel inside a small
  // overflow:auto panel (e.g. a dropdown menu) rather than the page. Without
  // this, IntersectionObserver checks the viewport, so a sentinel clipped by a
  // scrolling ancestor never reports as intersecting.
  root?: RefObject<Element | null>;
  rootMargin?: string;
}

// Returns a ref to attach to a sentinel element near the end of a list. When it
// scrolls into view (with generous rootMargin so loading starts early) and
// `enabled` is true, `onLoadMore` fires. Use with react-query's useInfiniteQuery:
//   const ref = useInfiniteScroll(fetchNextPage, hasNextPage && !isFetchingNextPage)
export function useInfiniteScroll(
  onLoadMore: () => void,
  enabled: boolean,
  { root, rootMargin = "600px" }: Options = {},
) {
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
      { root: root?.current ?? null, rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled, root, rootMargin]);

  return ref;
}
