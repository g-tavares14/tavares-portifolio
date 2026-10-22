import { useEffect, useState } from 'react';

const SESSION_START = Date.now();

/** Hora atual (atualiza a cada segundo) e segundos desde que a página abriu. */
export function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return { now, sessionSeconds: Math.max(0, Math.floor((now - SESSION_START) / 1000)) };
}
