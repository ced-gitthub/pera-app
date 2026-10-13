import { supabase } from './supabase';
import { countRows, resetWith, type Db } from './resetCore';
import type { ResetKind } from './resetLogic';

const db = supabase as unknown as Db;

export const countFor = (kind: ResetKind): Promise<number | null> => countRows(db, kind);
export const resetData = (kind: ResetKind): Promise<string | null> => resetWith(db, kind);
