import { ApiError } from './api';

export interface ErrorMessage {
  title: string;
  detail: string;
}

/**
 * Traduz o erro que derrubou o carregamento em uma mensagem para a tela de erro.
 * Recebe o que `loadPortfolio` lançou: normalmente um ApiError (com `status` e `path`).
 */
export function describeError(err: unknown): ErrorMessage {
  // TODO(human): diferencie os casos e devolva título + detalhe para cada um:
  //  - ApiError com status === null  → o servidor Go não está rodando / sem rede
  //  - ApiError com status 404       → rota da API não existe (contrato desatualizado?)
  //  - ApiError com status >= 500    → o Go respondeu, mas quebrou
  //  - qualquer outra coisa          → erro inesperado
  void ApiError;
  void err;
  return { title: 'Não deu para carregar', detail: 'Tente de novo em instantes.' };
}
