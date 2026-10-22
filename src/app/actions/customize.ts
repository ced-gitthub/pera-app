'use server';
import { supabaseServer } from '@/lib/supabase/server';
import { TABS, normalizeLayout, normalizeTab, type TabId } from '@/lib/common/layout';
import { logErr } from '@/lib/common/safe';
import { done } from './shared';

// ---- per-user layout (Customize). One tab at a time is merged into the stored row, so two tabs never overwrite each other.
export async function saveLayout(tab: string, value: unknown): Promise<{ ok: boolean }> {
  if (!TABS.includes(tab as TabId)) return { ok: false };
  try {
    const sb = await supabaseServer(),
      {
        data: { user },
      } = await sb.auth.getUser();
    if (!user) return { ok: false };
    const { data: cur, error: e1 } = await sb.from('user_settings').select('layout').eq('user_id', user.id).maybeSingle();
    if (e1) {
      logErr('saveLayout.read', e1);
      return { ok: false };
    }
    const layout = normalizeLayout(cur?.layout);
    layout[tab as TabId] = normalizeTab(tab as TabId, value);
    const { error } = await sb.from('user_settings').upsert({ user_id: user.id, layout }, { onConflict: 'user_id' });
    if (error) {
      logErr('saveLayout', error);
      return { ok: false };
    }
    done(); // remembered screens must show the new layout
    return { ok: true };
  } catch (e) {
    logErr('saveLayout', e);
    return { ok: false };
  }
}
