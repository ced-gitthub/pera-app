import { buildMissions, type MissionInput } from './missions.ts';
import { MAX_MINOR } from '../core/money.ts';
// Required first-run wizard. Four steps block the app until they are done (the 5th, the streak, cannot be forced, so it is shown as a "come back tomorrow" finish).
// Derived from real data like the missions, so nothing is stored; a plain cookie only remembers that the wizard was finished on this device.
export const GATE_STEPS = ['first', 'balance', 'budget', 'goal'] as const;
export type GateStep = (typeof GATE_STEPS)[number];
export const WIZARD_TOTAL = GATE_STEPS.length + 1;
export const ONBOARDING_COOKIE = 'zovix_onboarded'; // set once finished: skips the check (and its queries) on this device
export const BAL_COOKIE = 'zovix_wizard_bal'; // set when step 2 is submitted: typing exactly what the entries already add up to leaves every opening balance at 0, so the data alone cannot tell
export const WIZARD_COOKIE = 'zovix_wizard'; // set while the wizard is on screen: tells a just-finished user apart from a long-time user on a new device

export type Gate =
  { show: false; mark: boolean } | { show: true; step: GateStep | 'finish'; number: number; total: number; doneIds: string[] };

export function gateFor(i: MissionInput, cookies: { onboarded: boolean; wizard: boolean; balances?: boolean }): Gate {
  if (cookies.onboarded) return { show: false, mark: false };
  const { missions } = buildMissions(i),
    gating = missions
      .filter((m) => (GATE_STEPS as readonly string[]).includes(m.id))
      .map((m) => (m.id === 'balance' && cookies.balances ? { ...m, done: true } : m)),
    doneIds = gating.filter((m) => m.done).map((m) => m.id),
    next = gating.find((m) => !m.done);
  if (!next) {
    // everything required is done: a person who just finished sees the closing slide once; anyone else (existing user, new device) is simply let in
    return cookies.wizard
      ? { show: true, step: 'finish', number: WIZARD_TOTAL, total: WIZARD_TOTAL, doneIds }
      : { show: false, mark: true };
  }
  return { show: true, step: next.id as GateStep, number: doneIds.length + 1, total: WIZARD_TOTAL, doneIds };
}

// The wizard is for accounts made on or after this moment; people who were already using Zovix keep the optional "Getting started" card and are never locked out.
export const WIZARD_SINCE = '2026-10-13T12:30:00Z';
export const needsWizard = (createdAt: string | undefined) => !!createdAt && Date.parse(createdAt) >= Date.parse(WIZARD_SINCE);

// "What I have in this account today" -> the opening balance to store. The balance the app shows is opening + what was logged since, so the opening balance is
// the typed amount minus the logged movement (current - opening). Returns null when the result would be outside the allowed range.
export function openingFromToday(typed: number, current: number, opening: number): number | null {
  const o = typed - (current - opening);
  return Math.abs(o) <= MAX_MINOR ? o : null;
}
