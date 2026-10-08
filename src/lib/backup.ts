import { admin, adminConfigured } from '@/lib/admin';
import { mailConfigured } from './mail';
import type { Row } from './backupcode';
// Storage for backup emails. Everything goes through the secret-key client; callers must already have authenticated the user.
export const backupConfigured = () => adminConfigured() && mailConfigured();
const T = () => admin().from('backup_emails');
// A row with no email only carries the send-rate counters; callers see it as "no backup email" via getBackup, and nextSend reads it via getBackupRaw.
export async function getBackupRaw(userId: string): Promise<Row | null> { const { data, error } = await T().select('*').eq('user_id', userId).maybeSingle(); if (error) throw error; return data as Row | null; }
export async function getBackup(userId: string): Promise<Row | null> { const r = await getBackupRaw(userId); return r?.email ? r : null; }
export async function saveBackup(row: Row) { const { error } = await T().upsert(row, { onConflict: 'user_id' }); if (error) throw error; }
export async function patchBackup(userId: string, patch: Partial<Row>) { const { error } = await T().update(patch).eq('user_id', userId); return error; }
// Removing keeps the row (rate counters only) so remove/re-add cannot be used to dodge the hourly send limit.
export async function clearBackup(userId: string) { const { error } = await T().update({ email: null, verified_at: null, code_hash: null, code_expires_at: null, code_attempts: 0 }).eq('user_id', userId); if (error) throw error; }
export async function findVerified(email: string): Promise<Row | null> { const { data, error } = await T().select('*').eq('email', email).limit(5); if (error) throw error; return ((data ?? []) as Row[]).find(r => r.verified_at) ?? null; }
export async function emailOf(userId: string): Promise<string | null> { const { data, error } = await admin().auth.admin.getUserById(userId); if (error) throw error; return data.user?.email ?? null; }
export async function recoveryToken(email: string): Promise<string | null> { const { data, error } = await admin().auth.admin.generateLink({ type: 'recovery', email }); if (error) throw error; return data.properties?.hashed_token ?? null; }
