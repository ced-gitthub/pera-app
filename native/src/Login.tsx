import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { sendCode, verifyCode, signInWithGoogle, verifyTotp } from './auth';
import { supabase } from './supabase';
import { Btn } from './Btn';
import { c, s } from './ui';

// One screen for both: "Create account" (name + email, code, you are in) and "Sign in" (email, code).
export function Login({ start }: { start: 'signup' | 'login' }) {
  const [signup, setSignup] = useState(start === 'signup');
  const [name, setName] = useState('');
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
    setMsg({ bad: false, t: 'A 6-digit code is on its way. Check your inbox and spam folder.' });
  };
  const switchMode = () => {
    setSignup(!signup);
    setSent(false);
    setCode('');
    setMsg(null);
  };
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View
        style={{
          backgroundColor: c.purple,
          paddingTop: 70,
          paddingBottom: 34,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      >
        <Text style={{ fontSize: 52 }}>{signup ? '🚀' : '👋'}</Text>
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 6 }}>
          {signup ? 'Start your streak today' : 'Welcome back'}
        </Text>
        <Text style={{ color: '#fff', opacity: 0.9, fontSize: 16, marginTop: 6 }}>
          {signup ? 'Free forever. Takes under a minute.' : 'Sign in to pick up where you left off.'}
        </Text>
      </View>
      <View style={{ padding: 16 }}>
        <View style={s.card}>
          {signup && !sent && (
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              accessibilityLabel="Your name"
              maxLength={40}
            />
          )}
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            accessibilityLabel="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!sent}
          />
          {!sent ? (
            <Btn
              label={signup ? 'Create my account' : 'Send me a code'}
              busy={busy}
              onPress={() => run(() => sendCode(email.trim(), signup ? { name } : undefined), onSent)}
            />
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
              <Btn
                label={signup ? 'Confirm and start' : 'Sign in'}
                busy={busy}
                onPress={() => run(() => verifyCode(email.trim(), code.trim()))}
              />
              <Pressable onPress={() => setSent(false)} style={{ padding: 8 }}>
                <Text style={{ color: c.purple, textAlign: 'center', fontWeight: '700' }}>Wrong email? Go back</Text>
              </Pressable>
            </>
          )}
          {msg && <Text style={msg.bad ? s.err : s.ok}>{msg.t}</Text>}
        </View>
        <Btn label="Continue with Google" alt busy={busy} onPress={() => run(signInWithGoogle)} />
        <Pressable accessibilityRole="button" onPress={switchMode} style={{ padding: 12 }}>
          <Text style={{ color: c.purple, textAlign: 'center', fontWeight: '700', fontSize: 16 }}>
            {signup ? 'I already have an account' : 'New here? Create an account'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
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
