import Markdown, { defaultUrlTransform } from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Post } from '../types/api.gen';
import { Chart } from './charts/Chart';
import { Moldura } from './Moldura';

/** Texto de um nó do Markdown já convertido (hast), juntando os pedaços de texto dentro dele. */
function textOf(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node && Array.isArray(node.children)) return node.children.map(textOf).join('');
  return '';
}

function isChartBlock(node: unknown): boolean {
  if (!node || typeof node !== 'object' || !('children' in node) || !Array.isArray(node.children)) return false;
  const code: unknown = node.children[0];
  if (!code || typeof code !== 'object' || !('properties' in code)) return false;
  const props = code.properties as { className?: unknown };
  return Array.isArray(props.className) && props.className.includes('language-grafico');
}

/** Corpo de uma seção de artigo: Markdown, com os blocos ```grafico trocados pelos gráficos do texto. */
export function ArticleMarkdown({ markdown, post }: { markdown: string; post: Post }) {
  const components: Components = {
    pre({ node, children, ...rest }) {
      if (isChartBlock(node)) {
        const id = textOf(node).trim();
        const chart = post.charts.find((c) => c.id === id);
        return chart ? <Chart chart={chart} /> : <p className="mono">[gráfico “{id}” não encontrado]</p>;
      }
      return <pre {...rest}>{children}</pre>;
    },
    // Imagem no meio do texto (ou dentro de um link) fica uma imagem comum: a moldura é um <figure>,
    // que não pode ficar dentro de <p>. A moldura sai só quando a imagem tem o parágrafo inteiro (abaixo).
    img({ node: _, ...rest }) {
      return <img {...rest} className="reader__inline-img" />;
    },
    // ![descrição para leitor de tela](images/x.png "rótulo da barra | legenda") sozinha no parágrafo
    // vira um print na moldura de janela, sem <p> em volta.
    p({ node, children, ...rest }) {
      const only = node?.children.length === 1 ? node.children[0] : undefined;
      if (only && only.type === 'element' && only.tagName === 'img') {
        const { src, alt, title } = only.properties;
        const [label = '', ...caption] = String(title ?? '').split(' | ');
        return (
          <Moldura src={String(src ?? '')} alt={String(alt ?? '')} label={label} caption={caption.join(' | ') || null} />
        );
      }
      return <p {...rest}>{children}</p>;
    },
    table({ node: _, ...rest }) {
      return (
        <div className="reader__table">
          <table {...rest} />
        </div>
      );
    },
    a({ node: _, href, ...rest }) {
      const external = href?.startsWith('http');
      return <a href={href} {...rest} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} />;
    },
  };

  // images/x.png no Markdown → /articles/<slug>/images/x.png, servido pelo Go. Só o src das imagens:
  // o servidor não entrega outros arquivos do texto, então um link relativo continua como foi escrito.
  const urlTransform = (url: string, key: string) => {
    const safe = defaultUrlTransform(url);
    const relative = safe && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(safe);
    return key === 'src' && relative ? `/articles/${post.slug}/${safe}` : safe;
  };

  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components} urlTransform={urlTransform}>
      {markdown}
    </Markdown>
  );
}
