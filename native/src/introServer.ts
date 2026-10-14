import { supabase } from './supabase';
import { INTRO_MARKER } from './introLogic';

// Remembered with the account so a reinstall or a new phone never shows the intro again. Failure is harmless (the phone's own markers still work).
export async function markIntroDoneServer(): Promise<void> {
  try {
    await supabase.auth.updateUser({ data: { [INTRO_MARKER]: true } });
  } catch {
    // ignore
  }
}
