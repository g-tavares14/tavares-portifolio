import { useCallback } from 'react';
import type { MouseEvent } from 'react';
import { clamp } from '../lib/format';
import { useRafState } from './useRafState';

/** Posição do mouse sobre um elemento, de -1 a 1 em cada eixo. */
export interface HoverPoint {
  key: string;
  lx: number;
  ly: number;
}

/** Liga mousemove/mouseleave a vários elementos e diz qual está sob o mouse, e onde. */
export function useHoverTilt() {
  const [hover, later, now] = useRafState<HoverPoint | null>(null);

  const bind = useCallback(
    (key: string) => ({
      onMouseMove: (e: MouseEvent<HTMLElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        later({
          key,
          lx: clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1),
          ly: clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1),
        });
      },
      onMouseLeave: () => now(null),
    }),
    [later, now],
  );

  const clear = useCallback(() => now(null), [now]);

  return { hover, bind, clear };
}
