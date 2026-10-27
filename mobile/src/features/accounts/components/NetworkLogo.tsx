import { memo } from 'react';
import Svg, { Path, SvgXml } from 'react-native-svg';
import type { CardNetwork } from '@sora/contracts';

import { CARD_NETWORK_NAME } from '../cardNetworks.ts';
import { NETWORK_LOGO_SVG } from './networkLogoData.ts';

/**
 * Visa's wordmark in one colour (Simple Icons 16.35.0, CC0), for a coloured card: printed cards carry it white,
 * and its own navy would vanish on a navy or purple skin. The viewBox is cropped to the glyph so `height` sizes it.
 */
const VISA_MONO_PATH =
  'M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z';
const VISA_MONO_VIEW_BOX = { minX: 0, minY: 8.2, viewWidth: 24, viewHeight: 7.6 } as const;

type LogoNetwork = keyof typeof NETWORK_LOGO_SVG;

export function hasNetworkLogo(network: CardNetwork): network is LogoNetwork {
  return network in NETWORK_LOGO_SVG;
}

/**
 * A network's real mark at `height`, its width following the logo's own proportions. `monoColor` draws Visa in that
 * colour for a coloured card; every other logo, and Visa without it, is the brand's full-colour artwork.
 * NAPAS and OTHER have no mark (`hasNetworkLogo`), so the caller shows a name instead.
 */
export const NetworkLogo = memo(function NetworkLogo({ network, height, monoColor }: { network: LogoNetwork; height: number; monoColor?: string }) {
  if (network === 'VISA' && monoColor !== undefined) {
    const { minX, minY, viewWidth, viewHeight } = VISA_MONO_VIEW_BOX;
    return (
      <Svg height={height} width={(height * viewWidth) / viewHeight} viewBox={`${minX} ${minY} ${viewWidth} ${viewHeight}`} accessibilityLabel="Visa">
        <Path d={VISA_MONO_PATH} fill={monoColor} />
      </Svg>
    );
  }
  const logo = NETWORK_LOGO_SVG[network];
  return <SvgXml xml={logo.xml} height={height} width={(height * logo.viewWidth) / logo.viewHeight} accessibilityLabel={CARD_NETWORK_NAME[network]} />;
});
