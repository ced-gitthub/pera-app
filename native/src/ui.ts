import { StyleSheet } from 'react-native';
import { c, sp, t, r, applyPalette } from './uiTokens';
import type { ThemeId } from './themeLogic';
export { c, sp, t, e, r, themeState } from './uiTokens';

// The shared styles are rebuilt from the current colours (buildStyles) and re-assigned onto `s` when the theme changes.
export const buildStyles = () =>
  StyleSheet.create({
    screen: { flex: 1, paddingTop: 56, paddingHorizontal: sp.l, backgroundColor: c.bg },
    card: { backgroundColor: c.card, borderRadius: r.m, padding: sp.l, marginBottom: sp.m, borderWidth: 1, borderColor: c.line },
    h1: { fontSize: t.head, fontWeight: '800', color: c.ink },
    h2: { fontSize: t.lead, fontWeight: '700', color: c.ink, marginBottom: sp.s },
    p: { fontSize: t.body, color: c.mute },
    input: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: r.s,
      padding: sp.m,
      fontSize: t.lead,
      color: c.ink,
      backgroundColor: c.raised,
      marginBottom: sp.m,
    },
    btn: { backgroundColor: c.primary, borderRadius: r.s, paddingVertical: sp.l, alignItems: 'center', marginBottom: sp.m, minHeight: 48 },
    btnAlt: { backgroundColor: c.raised, borderWidth: 1, borderColor: c.line },
    btnDanger: { backgroundColor: c.down },
    btnText: { color: c.onPrimary, fontWeight: '800', fontSize: t.body },
    btnAltText: { color: c.ink },
    err: { color: c.down, fontSize: t.body, marginBottom: sp.s },
    ok: { color: c.up, fontSize: t.body, marginBottom: sp.s },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: sp.s },
    chip: {
      borderRadius: r.pill,
      paddingVertical: sp.xs,
      paddingHorizontal: sp.m,
      backgroundColor: c.raised,
      borderWidth: 1,
      borderColor: c.line,
    },
  });
export const s = buildStyles();

// Switch the whole look: replace the colours in c and rebuild every key of s. The app root then remounts so screens re-read c.
export function applyTheme(id: unknown): ThemeId {
  const used = applyPalette(id);
  Object.assign(s, buildStyles());
  return used;
}
