import { useCallback, useEffect, useRef, useState } from 'react';
import type { WheelEvent } from 'react';
import { Layout } from '../components/Layout';
import { ChevronIcon, ImageIcon } from '../components/Icons';
import { Moldura } from '../components/Moldura';
import { usePortfolio } from '../context/data';
import { usePointer } from '../context/pointer';
import { useElementSize } from '../hooks/useElementSize';
import { useKey } from '../hooks/useKey';
import { clamp, pad } from '../lib/format';
import type { Project } from '../types/api.gen';
import './Projects.css';

/** Raio do círculo (px) e distância entre itens (graus). */
const RADIUS = 560;
const SPACING = 8;
/** Distância da borda esquerda até o começo do texto do item ativo. */
const TEXT_LEFT = 130;

const wrap = (i: number, n: number) => ((i % n) + n) % n;

/**
 * Gira a roda até um alvo com uma mola simples em requestAnimationFrame.
 * `rot` é a posição atual em "itens" (pode ser fracionária durante o giro).
 */
function useSpin() {
  const [rot, setRot] = useState(0);
  const current = useRef(0);
  const target = useRef(0);
  const frame = useRef<number | null>(null);

  const spinTo = useCallback((next: number) => {
    target.current = next;
    if (frame.current !== null) return;
    const step = () => {
      const d = target.current - current.current;
      if (Math.abs(d) < 0.002) {
        current.current = target.current;
        frame.current = null;
        setRot(current.current);
        return;
      }
      current.current += d * 0.16;
      setRot(current.current);
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  return { rot, target, spinTo };
}

export function Projects() {
  const { projects } = usePortfolio();
  const n = projects.length;
  const [stageRef, size] = useElementSize<HTMLElement>();
  const { rot, target, spinTo } = useSpin();
  const [hovered, setHovered] = useState<number | null>(null);
  const snapTimer = useRef<number | undefined>(undefined);

  const active = n ? wrap(Math.round(rot), n) : 0;
  const shown = projects[hovered ?? active];
  const fit = size.height ? clamp(Math.min(size.height / 760, size.width / 1360), 0.5, 1) : 1;

  // Gira até o item i pelo caminho mais curto a partir do alvo atual.
  const goTo = (i: number) => {
    const base = Math.round(target.current);
    let diff = wrap(i - base, n);
    if (diff > n / 2) diff -= n;
    spinTo(base + diff);
  };
  const step = (delta: number) => spinTo(Math.round(target.current) + delta);

  const onWheel = (e: WheelEvent<HTMLElement>) => {
    const d = clamp(e.deltaY, -60, 60);
    spinTo(target.current + d / 110);
    window.clearTimeout(snapTimer.current);
    snapTimer.current = window.setTimeout(() => spinTo(Math.round(target.current)), 140);
  };
  useEffect(() => () => window.clearTimeout(snapTimer.current), []);

  useKey(['ArrowUp'], (e) => {
    e.preventDefault();
    step(-1);
  });
  useKey(['ArrowDown'], (e) => {
    e.preventDefault();
    step(1);
  });

  if (!n || !shown) {
    return (
      <Layout ticker={[{ label: 'PROJETOS', value: '00' }]}>
        <main className="stage projects projects--empty">
          <strong>Nenhum projeto ainda.</strong>
        </main>
      </Layout>
    );
  }

  // Duas voltas da lista (2n vagas) para o arco ficar sempre cheio; cada vaga fica no ângulo k·SPACING.
  // Com um projeto só, a segunda volta seria uma cópia dele logo acima, então fica uma vaga, e o ângulo dela
  // é só o pedaço fracionário do giro: em qualquer posição inteira (depois de ↓, ↑ ou da rolagem) ela volta ao marcador.
  const slots = Array.from({ length: n > 1 ? 2 * n : 1 }, (_, j) => {
    const k = n > 1 ? wrap(j - rot + n, 2 * n) - n : Math.round(rot) - rot;
    const item = j % n;
    const ak = Math.abs(k);
    const opacity = ak <= 3.5 ? 1 : Math.max(0, 1 - (ak - 3.5) / 2.5);
    return { j, k, item, opacity, isActive: ak < 0.5 };
  });

  return (
    <Layout
      ticker={[
        { label: 'PROJETOS', value: pad(n) },
        { label: 'ATIVO', value: `P/${projects[active]?.number ?? ''}` },
      ]}
    >
      <main className="stage projects" ref={stageRef} onWheel={onWheel} aria-label="Projetos: role ou use as setas para girar a roda">
        <div className="wheel__guide" aria-hidden="true" style={{ width: Math.round(TEXT_LEFT * fit) }} />
        <div className="wheel__marker mono" aria-hidden="true">
          P/{projects[active]?.number}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4l14 8-14 8z" />
          </svg>
        </div>

        <ul className="wheel" style={{ transform: `scale(${fit.toFixed(3)})` }}>
          {slots.map(({ j, k, item, opacity, isActive }) => {
            const p = projects[item]!;
            const solid = isActive || hovered === item;
            return (
              <li
                key={j}
                className="wheel__slot"
                style={{
                  left: TEXT_LEFT - RADIUS,
                  transform: `rotate(${(k * SPACING).toFixed(3)}deg) translateX(${RADIUS}px) translateY(-50%)`,
                  opacity,
                  pointerEvents: opacity > 0.15 ? 'auto' : 'none',
                }}
              >
                <button
                  type="button"
                  className={`wheel__item${isActive ? ' is-active' : ''}${solid ? ' is-solid' : ''}`}
                  tabIndex={opacity > 0.6 && j < n ? 0 : -1}
                  aria-current={isActive}
                  aria-label={`${p.name}, ${p.category}`}
                  onClick={() => goTo(item)}
                  onMouseEnter={() => setHovered(item)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(item)}
                  onBlur={() => setHovered(null)}
                >
                  <span>{p.name}</span>
                  {isActive && (
                    <span className="wheel__chips">
                      <span className="chip chip--accent">{p.category}</span>
                      <span className="chip chip--white">{p.year}</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <Preview project={shown} fit={fit} />

        <div className="wheel__nav">
          <button type="button" className="btn-round pill" onClick={() => step(-1)} aria-label="Projeto anterior">
            <ChevronIcon dir="up" size={16} />
          </button>
          <div className="wheel__counter">
            <span className="mono wheel__count">
              {pad(active + 1)} / {pad(n)}
            </span>
            <span className="mono wheel__hint">ROLE PARA GIRAR A RODA</span>
          </div>
          <button type="button" className="btn-round pill" onClick={() => step(1)} aria-label="Próximo projeto">
            <ChevronIcon dir="down" size={16} />
          </button>
        </div>
      </main>
    </Layout>
  );
}

function Preview({ project: p, fit }: { project: Project; fit: number }) {
  const { nx, ny } = usePointer();
  return (
    <div className="preview-wrap" style={{ transform: `translateY(-50%) scale(${fit.toFixed(3)})` }}>
      <article
        className="preview"
        aria-live="polite"
        style={{ transform: `rotateX(${(-ny * 3.6).toFixed(2)}deg) rotateY(${(nx * 6 - 4).toFixed(2)}deg)` }}
      >
        <div className="mono preview__top">
          <span>PROJETO:: P/{p.number}</span>
          <span className="preview__year">
            <span className="preview__dot blink" />
            {p.year}
          </span>
        </div>
        <div className={`preview__img${p.imageUrl && p.imageLabel ? ' preview__img--moldura' : ''}`}>
          {p.imageUrl && p.imageLabel ? (
            <Moldura src={p.imageUrl} alt={`Imagem do ${p.name}`} label={p.imageLabel} embedded />
          ) : p.imageUrl ? (
            <img src={p.imageUrl} alt={`Imagem do ${p.name}`} />
          ) : (
            <span className="preview__img-empty mono">
              <ImageIcon size={28} />
              IMAGEM DO PROJETO
            </span>
          )}
          <span className="preview__cat mono">{p.category}</span>
        </div>
        <div>
          <h1 className="preview__name">{p.name}</h1>
          <p className="preview__desc">{p.description}</p>
        </div>
        <div className="preview__tags mono">
          <span className="preview__tag preview__tag--accent">{p.role}</span>
          {p.stack.map((t, i) => (
            <span key={`${t}-${i}`} className="preview__tag">
              {t}
            </span>
          ))}
        </div>
        {(p.liveUrl || p.repoUrl) && (
          <div className="preview__links">
            {p.liveUrl && (
              <a href={p.liveUrl} className="btn btn--accent pill" target="_blank" rel="noreferrer">
                Ver projeto →
              </a>
            )}
            {p.repoUrl && (
              <a href={p.repoUrl} className="btn btn--white pill" target="_blank" rel="noreferrer">
                Código
              </a>
            )}
          </div>
        )}
      </article>
    </div>
  );
}
