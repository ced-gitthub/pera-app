// Pure "has the user changed anything?" checks for the Budgets and Goals sheets (no react-native). Values are compared trimmed.
export type BudgetForm = { cat: string; amount: string };
export type GoalForm = { name: string; emoji: string; amount: string; account: string };

const same = (a: string, b: string) => a.trim() === b.trim();

export const isBudgetDirty = (initial: BudgetForm, now: BudgetForm): boolean => !same(initial.cat, now.cat) || !same(initial.amount, now.amount);

export const isGoalDirty = (initial: GoalForm, now: GoalForm): boolean =>
  !same(initial.name, now.name) || !same(initial.emoji, now.emoji) || !same(initial.amount, now.amount) || !same(initial.account, now.account);
