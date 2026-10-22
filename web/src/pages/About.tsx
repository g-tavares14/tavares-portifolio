import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Layout } from '../components/Layout';
import { CameraIcon, CloseIcon, PauseIcon, PlayIcon, SocialIcon } from '../components/Icons';
import { usePortfolio } from '../context/data';
import { usePointer } from '../context/pointer';
import { useClock } from '../hooks/useClock';
import { useElementSize } from '../hooks/useElementSize';
import { useHoverTilt } from '../hooks/useHoverTilt';
import type { HoverPoint } from '../hooks/useHoverTilt';
import { useKey } from '../hooks/useKey';
import { fetchJSON } from '../lib/api';
import { clamp, clockSec, minSec, timeIn } from '../lib/format';
import type { NowPlaying, Profile } from '../types/api.gen';
import './About.css';

type Px = (n: number) => string;

interface CardDef {
  width: number;
  /** Centro do card, como expressão CSS relativa ao palco. */
  left: (px: Px) => string;
  top: (px: Px) => string;
  rotate: number;
  /** Quanto o card se desloca com o mouse (parallax). */
  depth: number;
  z: number;
  /** Inclinação 3D de repouso e quanto ela muda no hover. */
  baseX: number;
  baseY: number;
  hoverTilt: number;
}

// Cartão em cima; telemetria e rádio numa fileira abaixo, presos às bordas (sem sobreposição de 1280 a 1920px).
const CARDS = {
  id: { width: 600, left: () => '50%', top: (px) => `50% - ${px(188)}`, rotate: -1, depth: 6, z: 3, baseX: 0, baseY: 0, hoverTilt: 7 },
  tele: { width: 400, left: (px) => `max(${px(220)}, 50% - ${px(470)})`, top: (px) => `50% + ${px(200)}`, rotate: -1.5, depth: 10, z: 4, baseX: 0, baseY: 0, hoverTilt: 8 },
  radio: { width: 340, left: (px) => `min(100% - ${px(220)}, 50% + ${px(470)})`, top: (px) => `50% + ${px(198)}`, rotate: 1.2, depth: 12, z: 4, baseX: 14, baseY: -6, hoverTilt: 8 },
} satisfies Record<string, CardDef>;

type CardKey = keyof typeof CARDS;

/** "Recife → São Paulo" quando há rota; senão só a cidade atual. */
const routeLabel = (p: Profile) => (p.origin && p.destination ? `${p.origin} → ${p.destination}` : p.city);

const EMPTY_HEATMAP: number[] = Array.from({ length: 182 }, () => 0);

export function About() {
  const { profile } = usePortfolio();
  const [stageRef, size] = useElementSize<HTMLElement>();
  const { hover, bind, clear } = useHoverTilt();
  const [letterOpen, setLetterOpen] = useState(false);

  // A cena foi desenhada para ~1300×740px; encolhe por igual quando o palco é menor.
  const fit = size.height ? clamp(Math.min((size.height - 80) / 740, size.width / 1300), 0.5, 1) : 1;

  useKey(['Escape'], () => setLetterOpen(false), letterOpen);

  const np = profile.nowPlaying;
  const ticker = [
    { label: 'OUVINDO', value: np ? `${np.title} — ${np.artist}` : '—' },
    ...(profile.availableFrom ? [{ label: 'AGENDA', value: profile.availableFrom }] : []),
  ];

  const card = (key: CardKey, children: ReactNode) => (
    <TiltCard key={key} cardKey={key} fit={fit} hover={hover} bind={bind}>
      {children}
    </TiltCard>
  );

  return (
    <Layout ticker={ticker}>
      <main className="stage about" ref={stageRef}>
        <TiltScene>
          {card('tele', <TelemetryCard profile={profile} />)}
          {card('radio', <RadioCard initial={np} />)}
          {card(
            'id',
            <Postcard
              profile={profile}
              onOpenLetter={() => {
                clear();
                setLetterOpen(true);
              }}
            />,
          )}
        </TiltScene>
      </main>
      {letterOpen && <LetterDialog profile={profile} onClose={() => setLetterOpen(false)} />}
    </Layout>
  );
}

const SCENE_TILT = 6;

/** Inclina a cena inteira com o mouse; fica dentro do <Layout> para ler o ponteiro. */
function TiltScene({ children }: { children: ReactNode }) {
  const { nx, ny } = usePointer();
  return (
    <div
      className="about__scene"
      style={{
        transform: `perspective(1800px) rotateX(${(-ny * SCENE_TILT * 0.6).toFixed(2)}deg) rotateY(${(nx * SCENE_TILT).toFixed(2)}deg)`,
      }}
    >
      {children}
    </div>
  );
}

function TiltCard({
  cardKey,
  fit,
  hover,
  bind,
  children,
}: {
  cardKey: CardKey;
  fit: number;
  hover: HoverPoint | null;
  bind: ReturnType<typeof useHoverTilt>['bind'];
  children: ReactNode;
}) {
  const { nx, ny } = usePointer();
  const def: CardDef = CARDS[cardKey];
  const px: Px = (n) => `${(n * fit).toFixed(1)}px`;
  const lx = hover?.key === cardKey ? hover.lx : 0;
  const ly = hover?.key === cardKey ? hover.ly : 0;

  // Duas camadas: a de fora fica parada (posição/escala); a de dentro segue o mouse.
  return (
    <div
      className="tilt-card"
      style={{
        left: `calc(${def.left(px)})`,
        top: `calc(${def.top(px)})`,
        width: def.width,
        zIndex: def.z,
        transform: `translate(-50%, -50%) rotate(${def.rotate}deg) scale(${fit.toFixed(3)})`,
      }}
      {...bind(cardKey)}
    >
      <div className="tilt-card__frame" aria-hidden="true" />
      <div
        className="tilt-card__tilt"
        style={{
          transform:
            `perspective(1000px) rotateX(${(def.baseX - ly * def.hoverTilt).toFixed(2)}deg) ` +
            `rotateY(${(def.baseY + lx * def.hoverTilt).toFixed(2)}deg) ` +
            `translate3d(${(-nx * def.depth).toFixed(1)}px, ${(-ny * def.depth).toFixed(1)}px, 0)`,
        }}
      >
        <div className="tilt-card__body">{children}</div>
      </div>
    </div>
  );
}

function Postcard({ profile, onOpenLetter }: { profile: Profile; onOpenLetter: () => void }) {
  return (
    <div className="postcard">
      <svg className="postcard__clip" width="26" height="64" viewBox="0 0 24 60" aria-hidden="true">
        <path d="M9 26V8a5 5 0 0 1 10 0v38a8 8 0 0 1-16 0V14" />
      </svg>
      <div className="postcard__stamp">
        {profile.photoUrl ? (
          <img className="postcard__photo" src={profile.photoUrl} alt={`Foto de ${profile.name}`} />
        ) : (
          <div className="postcard__photo postcard__photo--empty">
            <CameraIcon size={28} />
            <span>SUA FOTO</span>
          </div>
        )}
        <div className="postcard__caption mono">
          <span>{profile.name}</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </div>

      <div className="postcard__info">
        <div className="postcard__top">
          <svg className="postcard__postmark" width="96" height="52" viewBox="0 0 118 64" aria-hidden="true">
            <circle cx="32" cy="32" r="28" />
            <circle cx="32" cy="32" r="21" strokeDasharray="3 3" />
            <text x="32" y="36" textAnchor="middle">{new Date().getFullYear()}</text>
            <path d="M64 18q6-5 12 0t12 0t12 0t12 0M64 28q6-5 12 0t12 0t12 0t12 0M64 38q6-5 12 0t12 0t12 0t12 0M64 48q6-5 12 0t12 0t12 0t12 0" />
          </svg>
          {profile.available && (
            <span className="chip chip--white">
              <span className="dot blink" />
              DISPONÍVEL
            </span>
          )}
        </div>
        <div>
          <div className="mono postcard__kicker">SOBRE · {profile.city}</div>
          <h1 className="postcard__name">{profile.name}</h1>
          <p className="postcard__role">{profile.role}</p>
        </div>
        <div className="postcard__socials">
          {profile.socials.map((s) => (
            <a
              key={s.kind + s.url}
              className="social pill"
              href={s.url}
              aria-label={s.label}
              target={s.kind === 'email' ? undefined : '_blank'}
              rel="noreferrer"
            >
              <SocialIcon kind={s.kind} />
            </a>
          ))}
        </div>
        <div className="postcard__bottom">
          <button type="button" className="btn btn--accent pill" onClick={onOpenLetter}>
            Sobre mim →
          </button>
          <span className="mono postcard__route">{routeLabel(profile)}</span>
        </div>
      </div>
    </div>
  );
}

function TelemetryCard({ profile }: { profile: Profile }) {
  const { now, sessionSeconds } = useClock();
  const t = profile.telemetry;
  const hasData = t.heatmap.length > 0;
  return (
    <div className="telemetry">
      <div className="telemetry__head">
        <h2 className="mono telemetry__title">TELEMETRIA::AO VIVO</h2>
        <span className="dot dot--ring blink" aria-hidden="true" />
      </div>
      <dl className="telemetry__rows mono">
        <div><dt>LOCAL::</dt><dd>{timeIn(profile.timezone, now)} {profile.timezoneLabel}</dd></div>
        <div><dt>POS::</dt><dd>{t.position}</dd></div>
        <div><dt>SESSÃO::</dt><dd>{clockSec(sessionSeconds)} nesta página</dd></div>
        <div>
          <dt>CONTRIBUIÇÕES::</dt>
          <dd>{t.contributionsPerYear === null ? '—' : t.contributionsPerYear.toLocaleString('pt-BR')}/ANO</dd>
        </div>
      </dl>
      <div
        className="heatmap"
        role="img"
        aria-label={hasData ? 'Atividade das últimas 26 semanas' : 'Atividade ainda sem dados'}
      >
        {(hasData ? t.heatmap : EMPTY_HEATMAP).map((level, i) => (
          <span key={i} className={`heatmap__cell heatmap__cell--${clamp(level, 0, 4)}`} />
        ))}
      </div>
      <div className="telemetry__legend mono">
        <span>{hasData ? 'ÚLTIMAS 26 SEMANAS' : 'SEM DADOS AINDA'}</span>
        <span className="telemetry__scale">
          MENOS
          {[0, 1, 3, 4].map((l) => (
            <span key={l} className={`heatmap__cell heatmap__cell--${l}`} />
          ))}
          MAIS
        </span>
      </div>
    </div>
  );
}

const NOW_PLAYING_POLL_MS = 30_000;

/** Começa com o que veio no perfil e pergunta ao Go de novo a cada 30 s. */
function useNowPlaying(initial: NowPlaying | null) {
  const [np, setNp] = useState(initial);
  useEffect(() => {
    const ctrl = new AbortController();
    const id = window.setInterval(() => {
      fetchJSON<NowPlaying | null>('/api/now-playing', ctrl.signal)
        .then(setNp)
        .catch(() => {}); // falhou: mantém a última música mostrada
    }, NOW_PLAYING_POLL_MS);
    return () => {
      window.clearInterval(id);
      ctrl.abort();
    };
  }, []);
  return np;
}

function RadioCard({ initial }: { initial: NowPlaying | null }) {
  const nowPlaying = useNowPlaying(initial);
  const duration = nowPlaying?.durationSeconds ?? 0;
  const [playing, setPlaying] = useState(nowPlaying?.isPlaying ?? false);
  const [pos, setPos] = useState(nowPlaying?.progressSeconds ?? 0);

  // Cada leitura nova do Spotify ressincroniza a posição e o giro do disco.
  useEffect(() => {
    setPos(nowPlaying?.progressSeconds ?? 0);
    setPlaying(nowPlaying?.isPlaying ?? false);
  }, [nowPlaying]);

  // Entre as leituras, a barra anda sozinha enquanto o disco gira.
  useEffect(() => {
    if (!playing || duration <= 0) return;
    const id = window.setInterval(() => setPos((p) => Math.min(p + 1, duration)), 1000);
    return () => window.clearInterval(id);
  }, [playing, duration]);

  const state = playing ? 'running' : 'paused';
  return (
    <div className="radio">
      <div className="radio__deck">
        <span className="radio__screw radio__screw--top" aria-hidden="true" />
        <span className="radio__screw radio__screw--bottom" aria-hidden="true" />
        <div className="radio__platter">
          <div className="radio__record spin" style={{ animationPlayState: state }}>
            <div className="radio__label mono">
              <span>LADO A</span>
              <span className="radio__hole" />
              <span>33⅓</span>
            </div>
          </div>
        </div>
        <svg
          className="radio__arm"
          width="170"
          height="160"
          viewBox="0 0 170 160"
          aria-hidden="true"
          style={{ transform: `rotate(${playing ? 0 : -24}deg)` }}
        >
          <line x1="144" y1="18" x2="20" y2="124" />
          <rect x="9" y="117" width="22" height="14" rx="2" transform="rotate(40 20 124)" />
          <circle cx="144" cy="18" r="12" />
          <circle className="radio__pivot" cx="144" cy="18" r="4" />
        </svg>
        <button
          type="button"
          className="btn-round radio__play pill"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pausar' : 'Tocar'}
          disabled={!nowPlaying}
        >
          {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
        </button>
      </div>

      <div className="radio__info">
        <div className="radio__main">
          <div className="radio__status mono">
            <span>RÁDIO::AO VIVO</span>
            <span className="radio__onair">
              <span className="dot blink" />
              {!nowPlaying ? 'DESLIGADO' : nowPlaying.isPlaying ? 'NO AR' : 'ÚLTIMA TOCADA'}
            </span>
          </div>
          <h2 className="radio__title">{nowPlaying?.title ?? 'Nada tocando'}</h2>
          <div className="radio__artist">{nowPlaying?.artist ?? '—'}</div>
          <div className="radio__progress mono">
            <span>{minSec(pos)}</span>
            <div className="radio__bar">
              <div style={{ width: duration ? `${((pos / duration) * 100).toFixed(1)}%` : 0 }} />
            </div>
            <span>−{minSec(Math.max(0, duration - pos))}</span>
            <span className="radio__eq" aria-hidden="true">
              {[0, -0.3, -0.6, -0.15].map((delay) => (
                <span key={delay} style={{ animationDelay: `${delay}s`, animationPlayState: state }} />
              ))}
            </span>
          </div>
        </div>
        <div className="radio__side mono">
          <div>
            <div className="radio__muted">ROTAÇÃO::</div>
            <b>
              {nowPlaying && nowPlaying.rotationCount > 0
                ? `${nowPlaying.rotationArtist} ×${nowPlaying.rotationCount}`
                : '—'}
            </b>
          </div>
          <div>
            <div className="radio__muted">HOJE::</div>
            <b>{nowPlaying?.todayLabel ?? '—'}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function LetterDialog({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const l = profile.letter;
  return (
    <>
      <button type="button" className="backdrop" onClick={onClose} aria-label="Fechar carta" />
      <div className="letter" role="dialog" aria-modal="true" aria-labelledby="carta-titulo">
        <div className="letter__head">
          <span className="mono letter__kicker">A CARTA::</span>
          <button type="button" className="btn-round letter__close pill" onClick={onClose} aria-label="Fechar carta" autoFocus>
            <CloseIcon size={16} />
          </button>
        </div>
        <h2 id="carta-titulo" className="letter__title">{l.greeting}</h2>
        {l.paragraphs.map((p, i) => (
          <p key={i} className="letter__p">{p}</p>
        ))}
        <div className="letter__foot">
          <span className="letter__sign">{l.signature}</span>
          <span className="mono letter__route">
            {routeLabel(profile)} · {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </>
  );
}
