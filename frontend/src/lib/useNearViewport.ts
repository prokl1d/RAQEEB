// True while the element is on screen or close to it. Heavy WebGL scenes use this to exist only
// near the viewport: browsers allow a limited number of live WebGL contexts, and when there are too
// many the oldest (the hero particles and light rays) get dropped and freeze.
import { useEffect, useState, type RefObject } from "react";

export function useNearViewport(ref: RefObject<Element | null>, margin = "60% 0px"): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return near;
}
