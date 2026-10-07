// react-native-web dev warnings raised by library internals, not by app code: React Navigation still
// passes `pointerEvents` as a prop, and the web responder sees mouse-ups whose mouse-down it missed.
const LIBRARY_WARNINGS = ['props.pointerEvents is deprecated', 'Cannot record touch end without a touch start'];

export function isLibraryWarning(args: readonly unknown[]): boolean {
  const first = args[0];
  return typeof first === 'string' && LIBRARY_WARNINGS.some((message) => first.startsWith(message));
}

/** Drops only the warnings above, on web in development; every other warning still prints. */
export function silenceWebLibraryWarnings(isWeb: boolean, isDev: boolean): void {
  if (!isWeb || !isDev) return;
  const warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (!isLibraryWarning(args)) warn(...args);
  };
}
