import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { needsTotp, handleLink } from './auth';
import { Login, Totp } from './Login';
import { Gate } from './Gate';
import { Btn } from './Btn';
import { c, s } from './ui';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [totp, setTotp] = useState(false);
  const [unsure, setUnsure] = useState(false); // could not tell whether two-step is needed: never show (empty) data
  const check = useCallback(async (sess: Session | null) => {
    try {
      setTotp(sess ? await needsTotp() : false);
      setUnsure(false);
    } catch {
      setUnsure(true);
    }
    setSession(sess);
  }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, sess) => {
      setTimeout(() => check(sess), 0); // never await supabase calls inside this callback
    });
    Linking.getInitialURL()
      .then(handleLink)
      .catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handleLink(e.url).catch(() => {}));
    return () => {
      data.subscription.unsubscribe();
      sub.remove();
    };
  }, [check]);

  let body;
  if (session === undefined) body = <ActivityIndicator color={c.purple} size="large" style={{ marginTop: 120 }} />;
  else if (!session) body = <Login />;
  else if (unsure)
    body = (
      <View style={s.screen}>
        <Text style={s.p}>Could not check your sign-in. Check your connection.</Text>
        <Btn label="Try again" onPress={() => check(session)} />
        <Btn label="Sign out" alt onPress={() => supabase.auth.signOut()} />
      </View>
    );
  else if (totp) body = <Totp onDone={() => check(session)} />;
  else body = <Gate />;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={c.bg} />
      {body}
    </KeyboardAvoidingView>
  );
}
