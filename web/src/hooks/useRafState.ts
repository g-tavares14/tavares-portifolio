import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Estado que só re-renderiza uma vez por quadro: `later` agenda para o próximo
 * requestAnimationFrame (ideal para mousemove), `now` aplica na hora e cancela o agendado.
 */
export function useRafState<T>(initial: T) {
  const [state, setState] = useState(initial);
  const pending = useRef(initial);
  const frame = useRef<number | null>(null);

  const later = useCallback((next: T) => {
    pending.current = next;
    if (frame.current === null) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setState(pending.current);
      });
    }
  }, []);

  const now = useCallback((next: T) => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    pending.current = next;
    setState(next);
  }, []);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  return [state, later, now] as const;
}
