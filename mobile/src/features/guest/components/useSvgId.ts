import { useId } from 'react';

/**
 * A gradient id unique to this component instance. On web an SVG `url(#id)` resolves across the whole
 * document, so two instances sharing a fixed id would paint with one another's gradient.
 */
export function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/\W/g, '')}`;
}
