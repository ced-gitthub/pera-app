import { supabase } from './supabase';
import { countAllWith, countRows, resetAllWith, resetWith, type Db, type ResetAllResult, type ResetResult } from './resetCore';
import type { ResetChoice, ResetKind } from './resetLogic';

const db = supabase as unknown as Db;

export const countFor = (kind: ResetKind): Promise<number | null> => countRows(db, kind);
export const countAll = (): Promise<number | null> => countAllWith(db);
export const resetData = (kind: ResetKind): Promise<ResetResult> => resetWith(db, kind);
export const resetChoice = (choice: ResetChoice): Promise<ResetAllResult> =>
  choice === 'all' ? resetAllWith(db) : resetWith(db, choice).then((r) => ({ ...r, done: r.error ? [] : [choice] }));
