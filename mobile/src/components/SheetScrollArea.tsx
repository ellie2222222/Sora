import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { useTheme } from '@/app/providers';

/** The scrolling picker region between a keypad sheet's header and its footer. */
export function SheetScrollArea({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={{ flexShrink: 1, minHeight: 0 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // Not flex: 1 — the sheet is content-sized, so a zero flex-basis collapses this to 0px tall.
        style={{ flexGrow: 0, flexShrink: 1 }}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
