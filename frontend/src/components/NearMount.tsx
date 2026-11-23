// Renders its children only while this spot is on or near the screen, so off-screen WebGL
// backgrounds don't hold a WebGL context (browsers drop the oldest ones when there are too many).
import { useRef, type ReactNode } from "react";
import { useNearViewport } from "../lib/useNearViewport";

export function NearMount({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref);
  return (
    <div ref={ref} className={className} aria-hidden>
      {near && children}
    </div>
  );
}
