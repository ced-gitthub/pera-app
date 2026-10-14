// The Save / Discard / Keep editing prompt shared by every sheet that can have unsaved changes (pure, no react-native).
import { UNSAVED_DISCARD, UNSAVED_KEEP, UNSAVED_SAVE } from './profileLogic.ts';

export const UNSAVED_TEXT_ANY = 'You changed something but have not saved it yet.';
export type UnsavedButton = { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void | Promise<void> };

/** onClose = leave the sheet. onSave (optional) saves and returns true when it worked: the sheet closes only then. */
export function unsavedButtons(o: { onClose: () => void; onSave?: () => Promise<boolean> | boolean }): UnsavedButton[] {
  const out: UnsavedButton[] = [
    { text: UNSAVED_KEEP, style: 'cancel' },
    { text: UNSAVED_DISCARD, style: 'destructive', onPress: () => o.onClose() },
  ];
  if (o.onSave) {
    const save = o.onSave;
    out.push({
      text: UNSAVED_SAVE,
      onPress: async () => {
        if (await save()) o.onClose();
      },
    });
  }
  return out;
}

/** What a sheet does when someone tries to close it: ask first when there are unsaved changes. */
export const promptOnClose = (dirty?: boolean): 'ask' | 'close' => (dirty ? 'ask' : 'close');
