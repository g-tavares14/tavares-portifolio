import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { usePortfolio } from '../context/data';
import { POINTER_REST, PointerContext } from '../context/pointer';
import type { Pointer } from '../context/pointer';
import { useClock } from '../hooks/useClock';
import { clamp, clockSec, pad, timeIn } from '../lib/format';
import './Layout.css';

export interface TickerItem {
  label: string;
  value: string;
}

const GRID = 48;

const NAV = [
  { to: '/', label: 'Sobre' },
  { to: '/escrita', label: 'Escrita' },
  { to: '/projetos', label: 'Projetos' },
];

/** Moldura de todas as páginas: barra de status, menu, grade que reage ao mouse e abas laterais. */
export function Layout({ ticker = [], children }: { ticker?: TickerItem[]; children: ReactNode }) {
  const { profile } = usePortfolio();
  const { now, sessionSeconds } = useClock();
  const [pointer, setPointer] = useState<Pointer>(POINTER_REST);
  const pending = useRef<Pointer>(POINTER_REST);
  const frame = useRef<number | null>(null);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    pending.current = {
      mx: e.clientX - r.left,
      my: e.clientY - r.top,
      nx: clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1),
      ny: clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1),
      inside: true,
    };
    if (frame.current === null) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setPointer(pending.current);
      });
    }
  };

  const onMouseLeave = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setPointer(POINTER_REST);
  };

  const cx = Math.floor(pointer.mx / GRID);
  const cy = Math.floor(pointer.my / GRID);
  const cell = `X·${pad(Math.max(0, cx))} Y·${pad(Math.max(0, cy))}`;
  const mask = pointer.inside
    ? `radial-gradient(circle 260px at ${Math.round(pointer.mx)}px ${Math.round(pointer.my)}px, #000 0%, transparent 72%)`
    : 'none';

  const items: TickerItem[] = [
    { label: 'LOCAL', value: `${timeIn(profile.timezone, now)} ${profile.timezoneLabel}` },
    { label: 'SESSÃO', value: clockSec(sessionSeconds) },
    ...ticker,
    { label: 'CURSOR', value: cell },
  ];

  return (
    <PointerContext.Provider value={pointer}>
      <div className="app" onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
        <div className="cursor-layer" aria-hidden="true" style={{ opacity: pointer.inside ? 1 : 0 }}>
          <div className="cursor-layer__grid" style={{ WebkitMaskImage: mask, maskImage: mask }} />
          <div className="cursor-layer__cell" style={{ left: cx * GRID, top: cy * GRID }} />
          <div className="cursor-layer__label" style={{ left: cx * GRID + GRID + 6, top: cy * GRID + 4 }}>
            {cell}
          </div>
        </div>

        <div className="ticker">
          <span className="ticker__item">
            <span className="ticker__key">STATUS::</span>
            <span className={`ticker__dot${profile.available ? ' blink' : ''}`} />
            {profile.available ? 'DISPONÍVEL' : 'OCUPADO'}
          </span>
          {items.map((it) => (
            <span key={it.label} className="ticker__item">
              <span className="ticker__key">{it.label}::</span> {it.value}
            </span>
          ))}
        </div>

        <header className="header">
          <NavLink to="/" className="logo pill" aria-label="Início">
            {profile.initials}
          </NavLink>
          <nav className="nav" aria-label="Principal">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav__link">
                {n.label}
              </NavLink>
            ))}
          </nav>
          {profile.cvUrl ? (
            <a href={profile.cvUrl} className="btn btn--white pill" target="_blank" rel="noreferrer">
              Currículo PDF ↓
            </a>
          ) : (
            <span className="header__spacer" />
          )}
        </header>

        <nav className="side-tabs" aria-label="Arquivos">
          <NavLink to="/escrita" className="side-tab">ARQUIVO::ESCRITA</NavLink>
          <NavLink to="/projetos" className="side-tab">ARQUIVO::PROJETOS</NavLink>
        </nav>

        {children}
      </div>
    </PointerContext.Provider>
  );
}
