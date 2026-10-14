import { forgetProfile } from './profile';
import { ToastProvider } from './Toast';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, KeyboardAvoidingView, StatusBar, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { needsTotp, handleLink } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Login, Totp } from './Login';
import { Welcome } from './Welcome';
import { Gate } from './Gate';
import { Btn } from './Btn';
import { confirmSignOut } from './signout';
import { c, s, sp, themeState } from './ui';
import { adoptAccountTheme, useThemeKey } from './themeStore';
import { shouldAdoptTheme } from './themeLogic';

export default function App() {
  const themeKey = useThemeKey(); // changes after a theme is chosen: the tree below remounts so every c.x is read again
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [totp, setTotp] = useState(false);
  const [welcome, setWelcome] = useState<'signup' | 'login' | 'show' | null>(null); // null = still reading
  useEffect(() => {
    AsyncStorage.getItem('zv_welcome_seen')
      .then((v) => setWelcome(v === '1' ? 'login' : 'show'))
      .catch(() => setWelcome('login'));
  }, []);
  const [unsure, setUnsure] = useState(false); // could not tell whether two-step is needed: never show (empty) data
  const check = useCallback(async (sess: Session | null, authEvent = 'INITIAL_SESSION') => {
    try {
      setTotp(sess ? await needsTotp() : false);
      setUnsure(false);
    } catch {
      setUnsure(true);
    }
    setSession(sess);
    if (sess && shouldAdoptTheme(authEvent)) adoptAccountTheme(sess.user.user_metadata?.theme).catch(() => {}); // a theme chosen on another phone, only at sign-in
  }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data } = supabase.auth.onAuthStateChange((ev, sess) => {
      if (ev === 'SIGNED_OUT') void forgetProfile(); // session expired, revoked or ended elsewhere: the next account must never see this one's profile
      setTimeout(() => check(sess, ev), 0); // never await supabase calls inside this callback
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
  if (session === undefined) body = <ActivityIndicator color={c.primary} size="large" style={{ marginTop: sp.xxl }} />;
  else if (!session) {
    if (welcome === null) body = <ActivityIndicator color={c.primary} size="large" style={{ marginTop: sp.xxl }} />;
    else if (welcome === 'show')
      body = (
        <Welcome
          onDone={(m) => {
            AsyncStorage.setItem('zv_welcome_seen', '1').catch(() => {});
            setWelcome(m);
          }}
        />
      );
    else body = <Login start={welcome} />;
  } else if (unsure)
    body = (
      <View style={s.screen}>
        <Text style={s.p}>Could not check your sign-in. Check your connection.</Text>
        <Btn label="Try again" onPress={() => check(session)} />
        <Btn label="Sign out" alt onPress={confirmSignOut} />
      </View>
    );
  else if (totp) body = <Totp onDone={() => check(session)} />;
  else body = <Gate />;
  return (
    <SafeAreaProvider>
      <ToastProvider>
      <KeyboardAvoidingView key={themeKey} style={{ flex: 1, backgroundColor: c.bg }} behavior="padding">
        <StatusBar barStyle={themeState.statusBarStyle} backgroundColor={c.bg} />
        {body}
      </KeyboardAvoidingView>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
