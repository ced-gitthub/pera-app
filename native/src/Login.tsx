import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { sendCode, verifyCode, signInWithGoogle, verifyTotp } from './auth';
import { Btn } from './Btn';
import { supabase } from './supabase';
import { s } from './ui';

export function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ bad: boolean; t: string } | null>(null);
  const run = async (f: () => Promise<string | null>, after?: () => void) => {
    setBusy(true);
    setMsg(null);
    try {
      const e = await f();
      if (e) setMsg({ bad: true, t: e });
      else after?.();
    } catch {
      setMsg({ bad: true, t: 'Could not reach the server. Check your connection.' });
    } finally {
      setBusy(false);
    }
  };
  const onSent = () => {
    setSent(true);
    setMsg({ bad: false, t: 'If an account exists for that email, a code is on its way. Check your inbox and spam.' });
  };
  return (
    <View style={s.screen}>
      <Text style={s.h1}>Zovix</Text>
      <Text style={[s.p, { marginBottom: 24 }]}>Your peso tracker. Sign in to continue.</Text>
      <View style={s.card}>
        <Text style={s.h2}>Email code</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@email.com"
          accessibilityLabel="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        {!sent ? (
          <Btn label="Send me a code" busy={busy} onPress={() => run(() => sendCode(email.trim()), onSent)} />
        ) : (
          <>
            <TextInput
              style={s.input}
              value={code}
              onChangeText={setCode}
              placeholder="Code from the email"
              accessibilityLabel="Login code"
              keyboardType="number-pad"
              maxLength={10}
            />
            <Btn label="Sign in" busy={busy} onPress={() => run(() => verifyCode(email.trim(), code.trim()))} />
          </>
        )}
        {msg && <Text style={msg.bad ? s.err : s.ok}>{msg.t}</Text>}
      </View>
      <Btn label="Continue with Google" alt busy={busy} onPress={() => run(signInWithGoogle)} />
      <Text style={[s.p, { fontSize: 12, textAlign: 'center' }]}>New here? Create your account on the website first, then sign in.</Text>
    </View>
  );
}

export function Totp({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true);
    const e = await verifyTotp(code);
    setBusy(false);
    if (e) setErr(e);
    else onDone();
  };
  return (
    <View style={s.screen}>
      <Text style={s.h1}>Two-step check</Text>
      <Text style={[s.p, { marginBottom: 16 }]}>Enter the 6-digit code from your authenticator app.</Text>
      <TextInput
        style={s.input}
        value={code}
        onChangeText={setCode}
        accessibilityLabel="Authenticator code"
        keyboardType="number-pad"
        maxLength={6}
      />
      {!!err && <Text style={s.err}>{err}</Text>}
      <Btn label="Verify" busy={busy} onPress={go} />
      <Btn label="Sign out" alt onPress={() => supabase.auth.signOut()} />
    </View>
  );
}
