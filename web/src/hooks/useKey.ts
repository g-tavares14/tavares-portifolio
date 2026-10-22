import { useEffect, useRef } from 'react';

/** Chama `handler` quando uma das teclas é pressionada, enquanto `enabled` for true. */
export function useKey(keys: string[], handler: (e: KeyboardEvent) => void, enabled = true) {
  const saved = useRef(handler);
  saved.current = handler;
  const list = keys.join('|');

  useEffect(() => {
    if (!enabled) return;
    const wanted = list.split('|');
    const onKey = (e: KeyboardEvent) => {
      // Não rouba teclas de campos de texto; o alvo pode ser a própria janela, então confere o tipo.
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable="true"]')) return;
      if (wanted.includes(e.key)) saved.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list, enabled]);
}
