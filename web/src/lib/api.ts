import type { Post, Profile, Project } from '../types/api.gen';

/** Erro de uma chamada à API; `status` é null quando nem houve resposta (rede, servidor fora). */
export class ApiError extends Error {
  readonly path: string;
  readonly status: number | null;

  constructor(path: string, status: number | null, message: string) {
    super(message);
    this.name = 'ApiError';
    this.path = path;
    this.status = status;
  }
}

export async function fetchJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError(path, null, 'Sem resposta do servidor');
  }
  if (!res.ok) throw new ApiError(path, res.status, res.statusText || 'Erro na API');
  return (await res.json()) as T;
}

export interface PortfolioData {
  profile: Profile;
  posts: Post[];
  projects: Project[];
}

/** Busca tudo que as três páginas usam, em paralelo. */
export async function loadPortfolio(signal: AbortSignal): Promise<PortfolioData> {
  const [profile, posts, projects] = await Promise.all([
    fetchJSON<Profile>('/api/profile', signal),
    fetchJSON<Post[]>('/api/posts', signal),
    fetchJSON<Project[]>('/api/projects', signal),
  ]);
  return { profile, posts, projects };
}
