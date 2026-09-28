import { useEffect, useRef, useState } from 'react';

/** Animates a number from 0 (or the previous value) to `target`. */
export function useCountUp(target: number, duration = 1100) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  const frame = useRef<number | undefined>(undefined); // React 19 requires an explicit initial value

  useEffect(() => {
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setValue(target);
      from.current = target;
      return;
    }

    const start = performance.now();
    const origin = from.current;
    const delta = target - origin;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(origin + delta * eased);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
      else from.current = target;
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration]);

  return value;
}
