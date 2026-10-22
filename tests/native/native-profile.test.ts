import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AVATARS,
  AVATAR_COLOR_IDS,
  FRAMES,
  STATUS_MAX,
  cleanStatus,
  defaultAvatar,
  profileFromMeta,
  validateProfile,
  makeItYoursKey,
} from '../../native/src/profileLogic.ts';
import { AVATAR_COLORS } from '../../native/src/themes.ts';

test('profile: lists are big enough and every colour id has a colour', () => {
  assert.ok(AVATARS.length >= 24 && new Set(AVATARS).size === AVATARS.length);
  assert.ok(AVATAR_COLOR_IDS.length >= 8);
  assert.ok(FRAMES.includes('none') && FRAMES.includes('ring') && FRAMES.includes('glow'));
  for (const id of AVATAR_COLOR_IDS) assert.match(AVATAR_COLORS[id], /^#[0-9A-Fa-f]{6}$/, id);
});

test('profile: default avatar is deterministic, case/space-insensitive, and falls back to email', () => {
  const a = defaultAvatar('Ced');
  assert.deepEqual(a, defaultAvatar('  ced '));
  assert.ok(AVATARS.includes(a.avatar) && AVATAR_COLOR_IDS.includes(a.avatarColor));
  assert.deepEqual(defaultAvatar('', 'x@y.com'), defaultAvatar('x@y.com'));
  assert.ok(AVATARS.includes(defaultAvatar('').avatar));
  const spread = new Set(['Ana', 'Ben', 'Carla', 'Dino', 'Ella', 'Fe', 'Gio', 'Hana'].map((n) => defaultAvatar(n).avatar));
  assert.ok(spread.size >= 4);
});

test('profile: status strips control chars, collapses spaces, limits length, rejects links', () => {
  assert.deepEqual(cleanStatus('  saving\u0000 for\n a  bike\u202E '), { ok: true, status: 'saving for a bike' });
  assert.deepEqual(cleanStatus(undefined), { ok: true, status: '' });
  assert.equal(cleanStatus('a'.repeat(STATUS_MAX)).ok, true);
  assert.equal(cleanStatus('a'.repeat(STATUS_MAX + 1)).ok, false);
  for (const bad of ['see https://x.co', 'go to www.foo', 'visit foo.com now', 'a://b']) assert.equal(cleanStatus(bad).ok, false, bad);
  assert.equal(cleanStatus('Budget 3.5k by Dec. Ok?').ok, true);
});

test('profile: validateProfile only allows listed ids', () => {
  const good = { avatar: '🦊', avatarColor: 'teal', frame: 'ring', status: 'hi' };
  assert.deepEqual(validateProfile(good), { ok: true, profile: { ...good } });
  for (const bad of [{ avatar: 'x' }, { avatarColor: '#fff' }, { frame: 'neon' }, { status: 'www.a.b' }, { avatar: 5 }])
    assert.equal(validateProfile({ ...good, ...bad }).ok, false);
  const r = validateProfile({ ...good, avatar: 'nope' });
  assert.ok(!r.ok && r.message.length > 5);
});

test('profile: profileFromMeta falls back to the default for missing or tampered metadata', () => {
  const d = defaultAvatar('Ced');
  assert.deepEqual(profileFromMeta(null, 'Ced'), { ...d, frame: 'none', status: '' });
  assert.deepEqual(profileFromMeta({ avatar: '<script>', avatarColor: 9, frame: 'x', status: 'http://evil' }, 'Ced'), {
    ...d,
    frame: 'none',
    status: '',
  });
  assert.equal(profileFromMeta({ avatar: '🐙', frame: 'glow' }, 'Ced').avatar, '🐙');
});

test('profile: make-it-yours flag key is per user', () => {
  assert.equal(makeItYoursKey('u1'), 'zv_make_it_yours:u1');
  assert.notEqual(makeItYoursKey('u1'), makeItYoursKey('u2'));
});

test('profile: the pure files import no react-native', () => {
  for (const f of ['profileLogic.ts', 'themeLogic.ts', 'themes.ts'])
    assert.ok(!/from 'react-native/.test(fs.readFileSync(`native/src/${f}`, 'utf8')), f);
});
