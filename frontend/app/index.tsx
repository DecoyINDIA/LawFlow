import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMe } from '../src/services/api';

const TOKEN_KEY = 'lawflow_auth_token';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          // Validate token with backend
          try {
            const res = await getMe(token);
            if (res.success) {
              router.replace('/(tabs)');
              return;
            }
          } catch (err: any) {
            if (err?.status === 401) {
              // Token expired — clear it
              await AsyncStorage.removeItem(TOKEN_KEY);
            }
            // Network error — still allow offline mode
            router.replace('/(tabs)');
            return;
          }
        }
        router.replace('/login');
      } catch {
        router.replace('/login');
      }
    };
    init();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.logo}>LF</Text>
        <Text style={styles.name}>LawFlow</Text>
        <Text style={styles.tagline}>Your Legal Practice, Organised</Text>
      </View>
      <ActivityIndicator
        style={styles.loader}
        color="rgba(255,255,255,0.4)"
        size="small"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 72,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -3,
    lineHeight: 76,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 8,
    marginTop: 8,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.5,
    marginTop: 16,
  },
  loader: {
    position: 'absolute',
    bottom: 60,
  },
});
