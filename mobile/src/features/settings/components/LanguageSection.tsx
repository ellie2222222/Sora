import { Globe } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useLocaleControl, useTheme } from '@/app/providers';
import { CollapsibleSection } from './CollapsibleSection';
import { LanguageOptions } from './LanguageOptions';

export function LanguageSection({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { locale } = useLocaleControl();

  return (
    <CollapsibleSection
      testID="settings-nav-language"
      icon={<Globe size={theme.iconSize.lg} color={theme.colors.textMuted} />}
      title={t('settings.language', 'Language')}
      subtitle={t(`settings.languageNames.${locale}`)}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <LanguageOptions testIDPrefix="settings-language" />
    </CollapsibleSection>
  );
}
