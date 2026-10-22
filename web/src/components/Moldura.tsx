import './Moldura.css';

type Props = {
  src: string;
  alt: string;
  /** Texto da barra, como o endereço numa janela de navegador (ex.: "preditor · ao vivo · 22/10/2026"); vazio = só as bolinhas. */
  label: string;
  /** Legenda embaixo da janela; sem ela, nada aparece. */
  caption?: string | null;
  /** Dentro de uma caixa que já tem borda (o card de projeto): sem borda e sombra próprias, ocupando a altura toda. */
  embedded?: boolean;
};

/**
 * Janela de navegador em volta de um print de outro site. O print não precisa seguir a paleta do portfólio:
 * a moldura deixa claro que é uma captura de outro lugar. Trocar o print é trocar o arquivo; nada aqui é imagem editada.
 */
export function Moldura({ src, alt, label, caption, embedded = false }: Props) {
  return (
    <figure className={`moldura${embedded ? ' moldura--embutida' : ''}`}>
      <div className="moldura__janela">
        <div className="moldura__barra" aria-hidden="true">
          <span className="moldura__bolinhas">
            <span />
            <span />
            <span />
          </span>
          {label && <span className="moldura__rotulo mono">{label}</span>}
        </div>
        <div className="moldura__tela">
          <img src={src} alt={alt} loading="lazy" />
        </div>
      </div>
      {caption && <figcaption className="moldura__legenda mono">{caption}</figcaption>}
    </figure>
  );
}
