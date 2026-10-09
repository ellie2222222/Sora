import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Locale } from '@sora/contracts';
import CN from 'country-flag-icons/string/3x2/CN';
import DE from 'country-flag-icons/string/3x2/DE';
import ES from 'country-flag-icons/string/3x2/ES';
import FR from 'country-flag-icons/string/3x2/FR';
import IN from 'country-flag-icons/string/3x2/IN';
import JP from 'country-flag-icons/string/3x2/JP';
import KR from 'country-flag-icons/string/3x2/KR';
import RU from 'country-flag-icons/string/3x2/RU';
import US from 'country-flag-icons/string/3x2/US';
import VN from 'country-flag-icons/string/3x2/VN';

import { useTheme } from '@/app/providers';

/** A language has no flag of its own, so each shows the country most of its speakers here would expect. */
const FLAG: Readonly<Record<Locale, string>> = { en: US, vi: VN, de: DE, es: ES, fr: FR, hi: IN, ja: JP, ko: KR, ru: RU, zh: CN };

/** The flag files are drawn 3 wide by 2 high. */
const FLAG_ASPECT = 3 / 2;

export function LanguageFlag({ locale }: { locale: Locale }) {
  const theme = useTheme();
  const height = theme.iconSize.md;
  const width = height * FLAG_ASPECT;

  return (
    // The border keeps a mostly white flag (Japan's) visible on a light surface.
    <View
      style={{
        width,
        height,
        borderRadius: theme.radius.xs,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      <SvgXml xml={FLAG[locale]} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
    </View>
  );
}
