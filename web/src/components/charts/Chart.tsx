import { useState } from 'react';
import type { FocusEvent, MouseEvent, ReactNode } from 'react';
import type { Chart as ChartData, ChartRow, ChartValue, ChartView } from '../../types/api.gen';
import './Chart.css';

// Largura do desenho em unidades do SVG; ele escala para a coluna da leitura (~612 px).
const W = 612;
// Cinzas das séries sem destaque, do mais claro ao mais escuro. Toda forma tem contorno preto,
// então a cor ajuda a separar, mas o nome (legenda ou rótulo) é que diz o que é cada uma.
const GREYS = ['#ffffff', '#efebe0', '#d6d1c3', '#b9b4a6'];

type Tip = { x: number; y: number; title: string; detail: string | null };
type ShowTip = (tip: Tip | null) => void;

/** Gráfico interativo de um artigo: hover (ou foco pelo teclado) mostra o número exato. */
export function Chart({ chart }: { chart: ChartData }) {
  const [viewIndex, setViewIndex] = useState(0);
  const [tip, setTip] = useState<Tip | null>(null);
  const view = chart.views[viewIndex] ?? chart.views[0];

  let body: { svg: ReactNode; height: number };
  switch (chart.kind) {
    case 'barras':
      body = bars(chart, view, setTip);
      break;
    case 'grupos':
      body = groups(chart, view, setTip);
      break;
    case 'pilha':
      body = stack(chart, view, setTip);
      break;
    default:
      body = interval(chart, view, setTip);
  }
  // Na pilha, cada pedaço já leva o nome escrito; a legenda só repetiria.
  const legend = chart.kind === 'grupos' ? seriesOf(chart) : [];

  return (
    <figure className="chart">
      <div className="chart__head">
        <figcaption className="chart__title">{chart.title}</figcaption>
        {chart.views.length > 1 && (
          <div className="chart__views" role="group" aria-label="Trocar a vista do gráfico">
            {chart.views.map((v, i) => (
              <button
                key={v.label}
                type="button"
                className={`chart__view mono${i === viewIndex ? ' is-on' : ''}`}
                aria-pressed={i === viewIndex}
                onClick={() => {
                  setViewIndex(i);
                  setTip(null);
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {legend.length > 0 && (
        <ul className="chart__legend mono">
          {legend.map((s) => (
            <li key={s}>
              <span className="chart__swatch" style={{ background: fillFor(chart, legend, s) }} />
              {s}
            </li>
          ))}
        </ul>
      )}

      <div className="chart__plot" onMouseLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${W} ${body.height}`} role="img" aria-label={chart.title}>
          {body.svg}
        </svg>
        {tip && (
          <div
            className="chart__tip mono"
            style={{ left: `${(tip.x / W) * 100}%`, top: `${(tip.y / body.height) * 100}%` }}
            role="status"
          >
            <strong>{tip.title}</strong>
            {tip.detail && <span>{tip.detail}</span>}
          </div>
        )}
      </div>

      <p className="chart__source mono">{chart.source}</p>
    </figure>
  );
}

/** 0.6977 → "0,698"; 17.41 com unidade "%" → "17,4%". */
export function formatValue(chart: ChartData, v: number, signed = false): string {
  const text = Math.abs(v).toLocaleString('pt-BR', {
    minimumFractionDigits: chart.decimals,
    maximumFractionDigits: chart.decimals,
  });
  const sign = v < 0 ? '−' : signed && v > 0 ? '+' : '';
  return `${sign}${text}${chart.unit}`;
}

/** Séries de todas as vistas, na ordem em que aparecem: a legenda, as cores e as posições não mudam ao trocar de vista. */
function seriesOf(chart: ChartData): string[] {
  const names: string[] = [];
  for (const view of chart.views) {
    for (const row of view.rows) {
      for (const v of row.values) if (!names.includes(v.series)) names.push(v.series);
    }
  }
  return names;
}

/** Topo da escala a partir do zero. Números de 0 a 1 sem unidade (notas, frações) vão até 1; o resto ganha folga.
 *  Tudo zero daria escala zero e geometria NaN, então o mínimo é 1. */
function scaleMax(chart: ChartData, view: ChartView): number {
  const top = maxOf(view, (v) => v.value);
  if (chart.unit === '' && top <= 1) return 1;
  return top > 0 ? top * 1.15 : 1;
}

function fillFor(chart: ChartData, series: string[], name: string): string {
  if (name === chart.accent) return 'var(--accent)';
  const others = series.filter((s) => s !== chart.accent);
  return GREYS[others.indexOf(name) % GREYS.length] ?? GREYS[0];
}

/** Props de uma forma que responde a mouse e teclado com a mesma dica. */
function markProps(show: ShowTip, tip: Tip, label: string) {
  return {
    className: 'chart__mark',
    tabIndex: 0,
    'aria-label': label,
    onMouseEnter: (_: MouseEvent) => show(tip),
    onFocus: (_: FocusEvent) => show(tip),
    onBlur: () => show(null),
  };
}

function tipFor(chart: ChartData, row: ChartRow, v: ChartValue, x: number, y: number): Tip {
  const who = v.series ? `${v.series} · ${row.label}` : row.label;
  const range =
    v.low !== null && v.high !== null
      ? `faixa provável: ${formatValue(chart, v.low, true)} a ${formatValue(chart, v.high, true)}`
      : null;
  return {
    x,
    y,
    title: `${who}: ${formatValue(chart, v.value, chart.kind === 'intervalo')}`,
    detail: [range, v.note].filter(Boolean).join(' · ') || null,
  };
}

function maxOf(view: ChartView, pick: (v: ChartValue) => number): number {
  return Math.max(...view.rows.flatMap((r) => r.values.map(pick)));
}

/** Barras horizontais, uma por linha, sempre medidas a partir do zero. */
function bars(chart: ChartData, view: ChartView, show: ShowTip) {
  const labelW = 150;
  const right = 64;
  const rowH = 36;
  const barH = 22;
  const max = scaleMax(chart, view);
  const x = (v: number) => labelW + (v / max) * (W - labelW - right);
  const height = view.rows.length * rowH + 8;

  const svg = view.rows.map((row, i) => {
    const v = row.values[0];
    if (!v) return null;
    const y = 4 + i * rowH;
    const accent = row.label === chart.accent;
    const tip = tipFor(chart, row, v, x(v.value) / 2 + labelW / 2, y);
    return (
      <g key={row.label}>
        <text x={labelW - 10} y={y + barH / 2 + 4} textAnchor="end" className="chart__label">
          {row.label}
        </text>
        <rect
          x={labelW}
          y={y}
          width={Math.max(x(v.value) - labelW, 1)}
          height={barH}
          fill={accent ? 'var(--accent)' : GREYS[1]}
          {...markProps(show, tip, tip.title)}
        />
        <text x={x(v.value) + 8} y={y + barH / 2 + 4} className="chart__value">
          {formatValue(chart, v.value)}
        </text>
      </g>
    );
  });
  return { svg, height };
}

/** Barras verticais agrupadas: grupos no eixo x, uma barra por série. */
function groups(chart: ChartData, view: ChartView, show: ShowTip) {
  const series = seriesOf(chart);
  const height = 250;
  const left = 34;
  const y0 = 22;
  const baseline = height - 34;
  const max = scaleMax(chart, view);
  const allUnit = chart.unit === '' && max === 1;
  const y = (v: number) => baseline - (v / max) * (baseline - y0);
  const groupW = (W - left) / view.rows.length;
  const barW = Math.min(44, (groupW - 28) / series.length);
  const ticks = allUnit ? [0, 0.25, 0.5, 0.75, 1] : [0, max / 2, max];

  const svg = (
    <>
      <g aria-hidden="true">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart__axis' : 'chart__grid'} />
            <text x={left - 6} y={y(t) + 4} textAnchor="end" className="chart__tick">
              {t.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
            </text>
          </g>
        ))}
      </g>
      {view.rows.map((row, gi) => {
        const gx = left + gi * groupW + (groupW - barW * series.length) / 2;
        return (
          <g key={row.label}>
            {row.values.map((v) => {
              const si = series.indexOf(v.series);
              const bx = gx + si * barW;
              const tip = tipFor(chart, row, v, bx + barW / 2, y(v.value));
              return (
                <g key={v.series}>
                  <rect
                    x={bx}
                    y={y(v.value)}
                    width={barW - 4}
                    height={baseline - y(v.value)}
                    fill={fillFor(chart, series, v.series)}
                    {...markProps(show, tip, tip.title)}
                  />
                  <text x={bx + (barW - 4) / 2} y={y(v.value) - 6} textAnchor="middle" className="chart__value chart__value--small">
                    {formatValue(chart, v.value)}
                  </text>
                </g>
              );
            })}
            <text x={left + gi * groupW + groupW / 2} y={height - 12} textAnchor="middle" className="chart__label">
              {row.label}
            </text>
          </g>
        );
      })}
    </>
  );
  return { svg, height };
}

/** Uma barra de 100 % por linha, dividida pelas séries. */
function stack(chart: ChartData, view: ChartView, show: ShowTip) {
  const series = seriesOf(chart);
  const labelW = 160;
  const rowH = 78;
  const barH = 36;
  const height = view.rows.length * rowH;
  const span = W - labelW - 8;

  const svg = view.rows.map((row, i) => {
    const y = 8 + i * rowH;
    const total = row.values.reduce((s, v) => s + v.value, 0) || 1; // linha toda zerada: pedaços de largura 0, sem NaN
    let cursor = labelW;
    return (
      <g key={row.label}>
        <text x={labelW - 10} y={y + barH / 2 + 4} textAnchor="end" className="chart__label">
          {row.label}
        </text>
        {row.values.map((v) => {
          const w = (v.value / total) * span;
          const sx = cursor;
          cursor += w;
          const inside = w >= 76;
          const tip = tipFor(chart, row, v, sx + w / 2, y);
          return (
            <g key={v.series}>
              <rect
                x={sx}
                y={y}
                width={w}
                height={barH}
                fill={fillFor(chart, series, v.series)}
                {...markProps(show, tip, tip.title)}
              />
              <text
                x={sx + (inside ? w / 2 : w)}
                y={inside ? y + barH / 2 + 4 : y + barH + 16}
                textAnchor={inside ? 'middle' : 'end'}
                className="chart__value chart__value--small"
              >
                {v.series} {formatValue(chart, v.value)}
              </text>
            </g>
          );
        })}
      </g>
    );
  });
  return { svg, height };
}

/** Um ponto com intervalo por linha, em volta de uma linha no zero ("empate"). */
function interval(chart: ChartData, view: ChartView, show: ShowTip) {
  const labelW = 224;
  const right = 72;
  const rowH = 38;
  const height = view.rows.length * rowH + 34;
  const lo = Math.min(0, -maxOf(view, (v) => -(v.low ?? v.value)));
  const hi = Math.max(0, maxOf(view, (v) => v.high ?? v.value));
  // Linhas todas em zero dariam largura zero (divisão por zero): aí a escala ganha largura 1.
  const span = hi - lo || 1;
  const pad = span * 0.08;
  const x = (v: number) => labelW + ((v - (lo - pad)) / (span + 2 * pad)) * (W - labelW - right);

  const svg = (
    <>
      <line x1={x(0)} x2={x(0)} y1={0} y2={height - 26} className="chart__zero" aria-hidden="true" />
      <text x={x(0)} y={height - 8} textAnchor="middle" className="chart__tick" aria-hidden="true">
        0 = empate
      </text>
      {view.rows.map((row, i) => {
        const v = row.values[0];
        if (!v) return null;
        const cy = 8 + i * rowH + rowH / 2 - 6;
        const accent = row.label === chart.accent;
        const low = v.low ?? v.value;
        const high = v.high ?? v.value;
        const tip = tipFor(chart, row, v, x(v.value), cy - 8);
        return (
          <g key={row.label}>
            <text x={labelW - 12} y={cy + 4} textAnchor="end" className="chart__label">
              {row.label}
            </text>
            <g {...markProps(show, tip, tip.title)}>
              {/* área invisível maior, para o hover não exigir mira no traço fino */}
              <rect x={x(low) - 6} y={cy - 12} width={x(high) - x(low) + 12} height={24} fill="transparent" />
              <line x1={x(low)} x2={x(high)} y1={cy} y2={cy} className="chart__whisker" />
              <line x1={x(low)} x2={x(low)} y1={cy - 6} y2={cy + 6} className="chart__whisker" />
              <line x1={x(high)} x2={x(high)} y1={cy - 6} y2={cy + 6} className="chart__whisker" />
              <circle cx={x(v.value)} cy={cy} r={7} fill={accent ? 'var(--accent)' : '#ffffff'} className="chart__dot" />
            </g>
            <text x={W - 4} y={cy + 4} textAnchor="end" className="chart__value">
              {formatValue(chart, v.value, true)}
            </text>
          </g>
        );
      })}
    </>
  );
  return { svg, height };
}
