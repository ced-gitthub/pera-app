import { StyleSheet } from 'react-native';
import { c, sp, t, r } from './uiTokens';
export { c, sp, t, e, r } from './uiTokens';
export const s = StyleSheet.create({
  screen: { flex: 1, paddingTop: 56, paddingHorizontal: sp.l },
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
    backgroundColor: c.white,
    marginBottom: sp.m,
  },
  btn: { backgroundColor: c.purple, borderRadius: r.s, paddingVertical: sp.l, alignItems: 'center', marginBottom: sp.m, minHeight: 48 },
  btnAlt: { backgroundColor: c.yellow },
  btnText: { color: c.white, fontWeight: '800', fontSize: t.body },
  btnAltText: { color: c.ink },
  err: { color: c.red, fontSize: t.body, marginBottom: sp.s },
  ok: { color: c.green, fontSize: t.body, marginBottom: sp.s },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: sp.s },
});
