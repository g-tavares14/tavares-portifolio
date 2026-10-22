import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { loadPortfolio } from '../lib/api';
import type { PortfolioData } from '../lib/api';
import { describeError } from '../lib/errors';

type State =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: PortfolioData };

const DataContext = createContext<PortfolioData | null>(null);

/** Dados do portfólio; só use dentro de <DataGate>, que garante que já chegaram. */
export function usePortfolio(): PortfolioData {
  const data = useContext(DataContext);
  if (!data) throw new Error('usePortfolio precisa estar dentro de <DataGate>');
  return data;
}

/** Busca os dados na API e só mostra as páginas quando eles chegam. */
export function DataGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    loadPortfolio(ctrl.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => {
        if (!ctrl.signal.aborted) setState({ status: 'error', error });
      });
    return () => ctrl.abort();
  }, [attempt]);

  if (state.status === 'ready') {
    return <DataContext.Provider value={state.data}>{children}</DataContext.Provider>;
  }

  if (state.status === 'loading') {
    return (
      <div className="gate" role="status">
        <span className="gate__label">ARQUIVO::</span>
        <span className="gate__title">Carregando…</span>
      </div>
    );
  }

  const msg = describeError(state.error);
  return (
    <div className="gate" role="alert">
      <span className="gate__label">ERRO::</span>
      <span className="gate__title">{msg.title}</span>
      <span className="gate__detail">{msg.detail}</span>
      <button type="button" className="btn btn--accent pill" onClick={() => setAttempt((n) => n + 1)}>
        Tentar de novo
      </button>
    </div>
  );
}
