/** WCAG 2.x contrast math over `#RGB` / `#RRGGBB` colours. */

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

function hexToRgb(hex: string): [number, number, number] {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  return [0, 1, 2].map((i) => parseInt(full.slice(i * 2, i * 2 + 2), 16)) as [number, number, number];
}

function rgbToHex(rgb: readonly number[]): string {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Linear blend of two hex colours; `amount` 0 = `from`, 1 = `to`. */
export function mixHex(from: string, to: string, amount: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex(a.map((channel, i) => channel * (1 - amount) + b[i]! * amount));
}

const MIX_STEPS = 20;

/**
 * Keeps `color`'s hue where it already reads, and otherwise blends it toward `toward` (the theme's
 * text colour, which always clears `min` on `background`) until it does. User-chosen colours are
 * stored per category and rendered on every theme, so they cannot be validated once at save time.
 * A value that is not a hex colour cannot be measured, so `toward` is returned instead.
 */
export function ensureContrast(color: string, background: string, min: number, toward: string): string {
  if (!isHexColor(color)) return toward;
  if (contrastRatio(color, background) >= min) return color.toUpperCase();
  for (let step = 1; step <= MIX_STEPS; step += 1) {
    const candidate = mixHex(color, toward, step / MIX_STEPS);
    if (contrastRatio(candidate, background) >= min) return candidate;
  }
  return toward;
}
