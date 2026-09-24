import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { StateView } from './StateView';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches a render error below it and shows a recoverable screen instead of unmounting the whole
 * app to a blank view. "Try again" re-mounts the subtree; state held above the boundary is kept.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // No crash-reporting service is wired yet; the console keeps the stack visible in dev and device logs.
    console.error('Unhandled render error', error, info.componentStack);
  }

  private readonly reset = () => this.setState({ error: null });

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return <CrashFallback onRetry={this.reset} />;
  }
}

function CrashFallback({ onRetry }: { onRetry: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      testID="screen-crash"
      style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.background }}
    >
      <StateView
        variant="error"
        title={t('errors.crashTitle')}
        message={t('errors.somethingWentWrong')}
        primaryAction={{ label: t('common.tryAgain'), onPress: onRetry }}
        entrance="none"
      />
    </View>
  );
}
