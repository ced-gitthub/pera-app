import type { GateStep } from '../../src/lib/onboarding/onboarding';

// Which button the Wizard pins in its footer (outside the scrolling area) for a step. null = nothing pinned.
// 'first' has the QuickAdd form with its own Save; the read-only tour has only Next / Back.
export const PINNED_LABEL: Record<GateStep, string | null> = {
  first: null,
  balance: 'Save balances',
  budget: 'Set budget',
  goal: 'Add goal',
};

export function pinnedLabel(step: GateStep, tour: boolean): string | null {
  return tour ? null : PINNED_LABEL[step];
}
