import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  UNSAVED_TITLE,
  UNSAVED_TEXT,
  UNSAVED_KEEP,
  UNSAVED_DISCARD,
  UNSAVED_SAVE,
  PROFILE_SAVED_TOAST,
  isProfileDirty,
  parseCachedProfile,
  profileCacheKey,
  type Profile,
} from '../native/src/profileLogic.ts';

const read = (f: string) => fs.readFileSync(`native/src/${f}`, 'utf8');
const base: Profile = { avatar: '🦊', avatarColor: 'violet', frame: 'none', status: 'Saving' };

// ---- unsaved changes in the profile editor
test('dirty check: any change to avatar, colour, frame, status or name counts, spaces alone do not', () => {
  const saved = { name: 'Ced', profile: base };
  assert.equal(isProfileDirty(saved, { name: 'Ced', status: 'Saving', profile: base }), false);
  assert.equal(isProfileDirty(saved, { name: ' Ced ', status: ' Saving  ', profile: base }), false);
  assert.equal(isProfileDirty(saved, { name: 'Ced R', status: 'Saving', profile: base }), true);
  assert.equal(isProfileDirty(saved, { name: 'Ced', status: 'Saving up', profile: base }), true);
  assert.equal(isProfileDirty(saved, { name: 'Ced', status: 'Saving', profile: { ...base, avatar: '🐼' } }), true);
  assert.equal(isProfileDirty(saved, { name: 'Ced', status: 'Saving', profile: { ...base, avatarColor: 'lime' } }), true);
  assert.equal(isProfileDirty(saved, { name: 'Ced', status: 'Saving', profile: { ...base, frame: 'glow' } }), true);
});

test('the unsaved-changes prompt offers Save, Discard and Keep editing, and says what happened', () => {
  assert.equal(UNSAVED_KEEP, 'Keep editing');
  assert.equal(UNSAVED_DISCARD, 'Discard');
  assert.equal(UNSAVED_SAVE, 'Save');
  assert.match(UNSAVED_TITLE, /save/i);
  assert.match(UNSAVED_TEXT, /changed|not saved/i);
  const src = read('Personalize.tsx');
  assert.match(src, /Alert\.alert\(UNSAVED_TITLE, UNSAVED_TEXT/);
  for (const w of ['UNSAVED_KEEP', 'UNSAVED_DISCARD', 'UNSAVED_SAVE']) assert.ok(src.includes(w), w);
  const close = src.slice(src.indexOf('const close = '), src.indexOf('return (', src.indexOf('const close = ')));
  assert.match(close, /dirty/); // Done checks for unsaved changes first
});

test('switching between the Theme and Profile tabs never throws away unsaved profile edits (both stay mounted)', () => {
  const src = read('Personalize.tsx');
  assert.doesNotMatch(src, /tab === 'theme' \? \(\s*<ThemeSection[\s\S]*?\) : \(\s*<ProfileSection/); // the old either-or render unmounted the editor
  assert.match(src, /display: tab === 'profile' \? 'flex' : 'none'/);
});

// ---- the Save button is pinned and the confirmation pops out
test('Save profile is pinned in the sheet footer, always visible on the Profile tab, not inside the scrolling content', () => {
  const sheet = read('Sheet.tsx');
  assert.match(sheet, /footer\??:/);
  const after = sheet.slice(sheet.indexOf('</ScrollView>'));
  assert.match(after, /\{footer\}|footer &&|!!footer/); // rendered after (below) the scroller
  const p = read('Personalize.tsx');
  assert.match(p, /footer=\{/);
  assert.match(p, /Save profile/);
  const editor = p.slice(p.indexOf('function ProfileSection'), p.indexOf('export function Personalize'));
  assert.doesNotMatch(editor, /label="Save profile"/); // not in the scrolling editor any more
});

test('saving pops out a clear confirmation that cannot be missed (centred card with a check, announced to screen readers)', () => {
  assert.match(PROFILE_SAVED_TOAST, /saved/i);
  const sheet = read('Sheet.tsx');
  assert.match(sheet, /toast\??:/);
  assert.match(sheet, /accessibilityLiveRegion="assertive"|accessibilityLiveRegion="polite"/);
  assert.match(sheet, /✓/);
  assert.match(sheet, /StyleSheet.absoluteFill|position: 'absolute'/); // drawn over the sheet
  const p = read('Personalize.tsx');
  assert.match(p, /toast=\{/);
  assert.match(p, /PROFILE_SAVED_TOAST/);
  const editor = p.slice(p.indexOf('function ProfileSection'), p.indexOf('export function Personalize'));
  assert.doesNotMatch(editor, /setOk\('Saved'\)/); // the small text above the button is gone
});

// ---- no glimpse of the original profile on reopen
test('cached profile: valid JSON is read back through the same rules, junk and missing fields give null', () => {
  assert.equal(profileCacheKey('u1'), 'zv_profile:u1');
  const raw = JSON.stringify({ name: 'Ced', email: 'c@x.ph', profile: { ...base, avatar: '🐼', frame: 'glow' } });
  const got = parseCachedProfile(raw);
  assert.equal(got?.name, 'Ced');
  assert.equal(got?.profile.avatar, '🐼');
  assert.equal(got?.profile.frame, 'glow');
  assert.equal(parseCachedProfile(null), null);
  assert.equal(parseCachedProfile('not json'), null);
  assert.equal(parseCachedProfile(JSON.stringify({ email: 'x' })), null);
  const tampered = parseCachedProfile(JSON.stringify({ name: 'Ced', email: 'c@x.ph', profile: { avatar: 'evil', frame: 'zzz' } }));
  assert.ok(tampered && tampered.profile.frame === 'none' && tampered.profile.avatar !== ('evil' as never));
});

test('the app never shows a placeholder profile and then swaps it: the avatar waits (neutral disc) until the real one is known, and the last one is cached', () => {
  const avatar = read('Avatar.tsx');
  assert.match(avatar, /loading\??:/);
  const home = read('Home.tsx');
  assert.match(home, /loading=\{!prof\.state && !prof\.failed\}/);
  const card = read('PersonalizeCard.tsx');
  assert.match(card, /loading=\{!state && !failed\}/);
  const prof = read('profile.ts');
  assert.match(prof, /readCachedProfile/);
  assert.match(prof, /profileCacheKey/);
  assert.match(prof, /useState<ProfileState \| null>\(memo\)/); // within a session there is no flash at all
  assert.match(prof, /clearProfileMemo/);
  assert.match(read('signout.ts'), /clearProfileMemo/);
});

// ---- the skeleton matches the live Home
test('the loading skeleton mirrors the live Home (header with avatar and Edit, total card, 2x2 tiles, level card, rows) and the tab bar', () => {
  const sk = read('Skeleton.tsx');
  const home = sk.slice(sk.indexOf('export function HomeSkeleton'), sk.indexOf('export function ListSkeleton'));
  assert.match(home, /round=\{r\.pill\}/); // the avatar disc
  assert.match(home, /width: '48%'/); // the two-column tile grid like Home
  assert.match(home, /s\.card/); // the level card
  assert.match(home, /s\.row/); // recent entries use the real row style
  assert.match(sk, /export function TabBarSkeleton/);
  assert.match(sk, /borderTopWidth: 1/); // same bar styling as the real tab bar
  const gate = read('Gate.tsx');
  assert.match(gate, /<HomeSkeleton \/>\s*<TabBarSkeleton \/>/);
  const list = sk.slice(sk.indexOf('export function ListSkeleton'));
  assert.match(list, /s\.row/); // list skeleton rows look like the real rows
});
