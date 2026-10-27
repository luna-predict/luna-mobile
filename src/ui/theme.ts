import { AppMode } from '../types';

/**
 * Design tokens. Contrast rule: `primary` is decorative (fills, rings, tints).
 * Text and filled buttons use `primaryStrong`, which is ≥ 4.5:1 against white
 * (period 6.3, conceive 5.5, pregnancy 7.0, peri 7.1, partner 6.7).
 */
export interface ThemeColors {
  primary: string;        // decorative accent
  primaryStrong: string;  // text, filled buttons, focus
  primaryDark: string;    // alias of primaryStrong (legacy name)
  onPrimary: string;
  tint: string;           // very light accent background
  background: string;
  card: string;
  surface: string;        // inputs, chips
  border: string;
  text: string;
  textMuted: string;      // secondary text, 7.6:1
  subtext: string;        // tertiary text, 4.8:1
  success: string;
  successTint: string;
  warning: string;
  warningTint: string;
  danger: string;
  dangerTint: string;
  info: string;
  infoTint: string;
}

const NEUTRAL = {
  card: '#FFFFFF',
  surface: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#475569',
  subtext: '#64748B',
  onPrimary: '#FFFFFF',
  success: '#047857',
  successTint: '#ECFDF5',
  warning: '#B45309',
  warningTint: '#FFFBEB',
  danger: '#B91C1C',
  dangerTint: '#FEF2F2',
  info: '#1D4ED8',
  infoTint: '#EFF6FF',
};

function make(primary: string, strong: string, tint: string, background: string): ThemeColors {
  return { ...NEUTRAL, primary, primaryStrong: strong, primaryDark: strong, tint, background };
}

export const WOMEN_THEMES: Record<AppMode, ThemeColors> = {
  period: make('#F43F5E', '#BE123C', '#FFE4E9', '#FFF7F8'),
  conceive: make('#14B8A6', '#0F766E', '#CCFBF1', '#F0FDFA'),
  pregnancy: make('#A855F7', '#7E22CE', '#F3E8FF', '#FAF5FF'),
  perimenopause: make('#8B5CF6', '#6D28D9', '#EDE9FE', '#F5F3FF'),
};

export const PARTNER_THEME: ThemeColors = make('#3B82F6', '#1D4ED8', '#DBEAFE', '#F6F9FF');

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

/** Type scale (system font). Minimum readable size is 12. */
export const type = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 23 },
  label: { fontSize: 14, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '600' as const },
};

export const TOUCH = 48; // dp minimum touch target (Android)
