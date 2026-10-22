import { useMemo, useRef, useState } from 'react';
import type { UIEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArticleMarkdown } from '../components/ArticleMarkdown';
import { Layout } from '../components/Layout';
import { ChevronIcon, CloseIcon, InfoIcon } from '../components/Icons';
import { usePortfolio } from '../context/data';
import { usePointer } from '../context/pointer';
import { useElementSize } from '../hooks/useElementSize';
import { useHoverTilt } from '../hooks/useHoverTilt';
import type { HoverPoint } from '../hooks/useHoverTilt';
import { useKey } from '../hooks/useKey';
import { clamp, formatDate, pad } from '../lib/format';
import type { Post } from '../types/api.gen';
import './Writing.css';

// Só TODOS por enquanto: os temas voltam (ex.: { key: 'dados', label: 'DADOS' }) quando houver textos para filtrar.
const TAGS: { key: string; label: string }[] = [{ key: 'all', label: 'TODOS' }];

const tagLabel = (tag: string) => TAGS.find((t) => t.key === tag)?.label ?? tag.toUpperCase();

const SHEET_LINES = [92, 100, 84, 96, 70, 100, 88, 94, 60, 100, 90, 78, 96, 54];

/** Página Escrita: uma pasta 3D por texto; clicar abre a leitura em /escrita/:slug. */
export function Writing() {
  const { posts } = usePortfolio();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [stageRef, size] = useElementSize<HTMLElement>();
  const { hover, bind, clear } = useHoverTilt();
  const [tag, setTag] = useState('all');
  const [index, setIndex] = useState(0);

  const list = useMemo(() => (tag === 'all' ? posts : posts.filter((p) => p.tag === tag)), [posts, tag]);
  const current = list.length ? list[clamp(index, 0, list.length - 1)] : undefined;
  const reading = slug ? posts.find((p) => p.slug === slug) : undefined;

  const go = (delta: number) => {
    if (!list.length) return;
    clear();
    setIndex((i) => (((i + delta) % list.length) + list.length) % list.length);
  };
  const open = (post: Post) => {
    clear();
    navigate(`/escrita/${post.slug}`);
  };
  const close = () => navigate('/escrita');
  const readNext = () => {
    const i = posts.findIndex((p) => p.slug === reading?.slug);
    const next = posts[(i + 1) % posts.length];
    if (next) navigate(`/escrita/${next.slug}`);
  };

  useKey(['ArrowLeft'], () => go(-1), !reading);
  useKey(['ArrowRight'], () => go(1), !reading);
  useKey(['Escape'], close, !!reading);

  const fit = size.height ? clamp(Math.min((size.height - 200) / 480, size.width / 680), 0.45, 1) : 1;

  return (
    <Layout
      ticker={[
        { label: 'TEXTOS', value: pad(posts.length) },
        { label: 'LENDO', value: reading ? `Nº${reading.number}` : '—' },
      ]}
    >
      <main className="stage writing" ref={stageRef}>
        <div className="writing__filters" role="group" aria-label="Filtrar por tema">
          {TAGS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`writing__filter${tag === t.key ? ' is-on' : ''}`}
              aria-pressed={tag === t.key}
              onClick={() => {
                setTag(t.key);
                setIndex(0);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {current ? (
          <>
            <Folder post={current} total={list.length} fit={fit} hover={hover} bind={bind} onOpen={() => open(current)} />
            <div className="writing__nav">
              <button type="button" className="btn-round pill" onClick={() => go(-1)} aria-label="Texto anterior">
                <ChevronIcon dir="left" size={16} />
              </button>
              <div className="writing__counter">
                <span className="mono writing__count">
                  {pad(clamp(index, 0, list.length - 1) + 1)} / {pad(list.length)}
                </span>
                <span className="mono writing__hint">
                  <InfoIcon size={12} />
                  CLIQUE NA PASTA PARA LER
                </span>
              </div>
              <button type="button" className="btn-round pill" onClick={() => go(1)} aria-label="Próximo texto">
                <ChevronIcon dir="right" size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="writing__empty">
            <span className="mono writing__hint">GAVETA VAZIA::</span>
            <strong>Nenhum texto em {tagLabel(tag)} ainda.</strong>
          </div>
        )}
      </main>

      {reading && <Reader key={reading.slug} post={reading} onClose={close} onNext={readNext} />}
    </Layout>
  );
}

function Folder({
  post,
  total,
  fit,
  hover,
  bind,
  onOpen,
}: {
  post: Post;
  total: number;
  fit: number;
  hover: HoverPoint | null;
  bind: ReturnType<typeof useHoverTilt>['bind'];
  onOpen: () => void;
}) {
  const { nx, ny } = usePointer();
  const isH = hover?.key === 'folder';
  const lx = isH ? hover.lx : 0;
  const ly = isH ? hover.ly : 0;

  // Lado esquerdo mais perto, direito se afastando; no hover a capa abre e as folhas saem.
  const folderT = `rotateX(${(6 - ly * 6 - ny * 2.4).toFixed(2)}deg) rotateY(${(18 + lx * 10 + nx * 6).toFixed(2)}deg)`;

  return (
    <div className="folder-box" style={{ width: Math.round(640 * fit), height: Math.round(480 * fit) }} {...bind('folder')}>
      <div className="folder-box__scale" style={{ transform: `scale(${fit.toFixed(3)})` }}>
        <div className="folder" style={{ transform: folderT }}>
          <div
            className="folder__sheet folder__sheet--back"
            aria-hidden="true"
            style={{ transform: `translateZ(-34px) translateX(${isH ? 190 : 150}px) rotate(${isH ? 2.5 : 1}deg)` }}
          >
            <div className="mono folder__sheet-head">Nº{post.number}</div>
            {SHEET_LINES.map((w, i) => (
              <span key={i} className="folder__line" style={{ width: `${w}%` }} />
            ))}
          </div>
          <div
            className="folder__sheet folder__sheet--front"
            aria-hidden="true"
            style={{ transform: `translateZ(-14px) translateX(${isH ? 112 : 80}px) rotate(${isH ? 1.5 : 0.5}deg)` }}
          >
            <div className="mono folder__sheet-head">TL;DR</div>
            <div>{post.tldr}</div>
          </div>
          <div
            className="folder__slip"
            aria-hidden="true"
            style={{ transform: `translateZ(10px) translateX(${isH ? 222 : 182}px) rotate(${isH ? -4 : -1.5}deg)` }}
          >
            <span className="mono">
              Nº{post.number} / {pad(total)}
            </span>
            <span className="folder__excerpt">{post.excerpt}</span>
          </div>
          <button
            type="button"
            className="folder__cover"
            onClick={onOpen}
            aria-label={`Abrir “${post.title}”`}
            style={{ transform: `translateZ(36px) rotateY(${isH ? -18 : 0}deg)` }}
          >
            <span className="folder__face">
              <span className="folder__notch" aria-hidden="true" />
              <span className="mono folder__head">
                <span>ESCRITA:: Nº{post.number}</span>
                <span className="folder__dot blink" />
              </span>
              <span className="folder__number">{post.number}</span>
              <span className="folder__title">{post.title}</span>
              <span className="mono folder__foot">
                <span className="chip chip--accent">{tagLabel(post.tag)}</span>
                <span>{formatDate(post.publishedAt)}</span>
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Reader({ post, onClose, onNext }: { post: Post; onClose: () => void; onNext: () => void }) {
  const article = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [tocOpen, setTocOpen] = useState(true);

  const scrollTo = (i: number) => {
    const box = article.current;
    const el = box?.querySelector<HTMLElement>(`[data-section="${i}"]`);
    if (box && el) box.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' });
    setActive(i);
  };

  // A seção ativa é a última cujo topo já passou de 160px do topo da leitura.
  const onScroll = (e: UIEvent<HTMLElement>) => {
    const box = e.currentTarget;
    let current = 0;
    box.querySelectorAll<HTMLElement>('[data-section]').forEach((el, i) => {
      if (el.offsetTop - box.scrollTop <= 160) current = i;
    });
    setActive(current);
  };

  return (
    <>
      <button type="button" className="backdrop" onClick={onClose} aria-label="Fechar leitura" />

      <nav className="toc" aria-label="Sumário">
        <button type="button" className="toc__toggle mono" onClick={() => setTocOpen((o) => !o)} aria-expanded={tocOpen}>
          <span className="toc__label">
            <span className="toc__dot" />
            SUMÁRIO
          </span>
          <ChevronIcon dir={tocOpen ? 'up' : 'down'} size={14} />
        </button>
        {tocOpen && (
          <div className="toc__list">
            {post.sections.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`toc__item mono${i === active ? ' is-on' : ''}`}
                aria-current={i === active}
                onClick={() => scrollTo(i)}
              >
                <span className="toc__bullet" />
                {s.title}
              </button>
            ))}
          </div>
        )}
      </nav>

      <button type="button" className="reader__close btn-round pill" onClick={onClose} aria-label="Fechar leitura" autoFocus>
        <CloseIcon size={18} />
      </button>

      <article className="reader" ref={article} onScroll={onScroll} aria-labelledby="leitura-titulo">
        <div className="mono reader__top">
          <span>ESCRITA</span>
          <span>Nº{post.number}</span>
        </div>
        <div className="mono reader__meta">
          :: {formatDate(post.publishedAt)} · {tagLabel(post.tag)}
        </div>
        <h1 id="leitura-titulo" className="reader__title">{post.title}</h1>
        <div className="reader__tldr">
          <div className="mono reader__tldr-label">TL;DR</div>
          <p>{post.tldr}</p>
        </div>
        {post.sections.map((s, i) => (
          <section key={i} data-section={i} className="reader__section">
            <h2>
              <span className="mono">{pad(i + 1)}</span>
              {s.title}
            </h2>
            {s.markdown !== null ? (
              <ArticleMarkdown markdown={s.markdown} post={post} />
            ) : (
              s.paragraphs.map((p, j) => <p key={j}>{p}</p>)
            )}
          </section>
        ))}
        <div className="mono reader__end">
          <span>FIM DO Nº{post.number}</span>
          <button type="button" className="btn btn--accent pill" onClick={onNext}>
            Próximo texto →
          </button>
        </div>
      </article>
    </>
  );
}
