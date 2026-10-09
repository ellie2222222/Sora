import type { Locale } from '@sora/contracts';

import de from './de.ts';
import en, { type LocaleResource } from './en.ts';
import es from './es.ts';
import fr from './fr.ts';
import hi from './hi.ts';
import ja from './ja.ts';
import ko from './ko.ts';
import ru from './ru.ts';
import vi from './vi.ts';
import zh from './zh.ts';

/** Typed by the contract's tuple, so a language added there without a catalog fails to compile. */
export const CATALOGS: Readonly<Record<Locale, LocaleResource>> = { en, vi, de, es, fr, hi, ja, ko, ru, zh };
