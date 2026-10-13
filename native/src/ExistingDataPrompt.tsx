import { Text } from 'react-native';
import { Sheet } from './Sheet';
import { Btn } from './Btn';
import { EXISTING_DATA_TEXT } from './freshLogic';
import { s, sp } from './ui';

// Shown once after "Create account" when the email turned out to have data already. Keep is the default; starting fresh goes through the normal typed-DELETE sheet.
export function ExistingDataPrompt({ open, onKeep, onFresh }: { open: boolean; onKeep: () => void; onFresh: () => void }) {
  return (
    <Sheet open={open} title="This account already has data" onClose={onKeep}>
      <Text style={[s.p, { marginBottom: sp.l }]}>{EXISTING_DATA_TEXT}</Text>
      <Btn label="Keep my data" onPress={onKeep} />
      <Btn label="Start fresh…" alt onPress={onFresh} />
    </Sheet>
  );
}
