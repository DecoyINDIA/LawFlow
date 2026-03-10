/**
 * Intro screen — plays intro.mp4 on native (iOS/Android).
 * Web: Platform.OS guard → navigateAway() immediately (no video).
 * Skip button always visible on native.
 */
import React, { useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVideoPlayer, VideoView } from 'expo-video';

const TOKEN_KEY = 'lawflow_auth_token';
const PROFILE_KEY = 'lawflow_advocate_profile';

export default function IntroScreen() {
  const router = useRouter();
  const navigatedRef = useRef(false);

  const navigateAway = useCallback(async () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;

    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) {
        router.replace('/login');
        return;
      }
      const stored = await AsyncStorage.getItem(PROFILE_KEY);
      const profile = stored ? JSON.parse(stored) : null;
      const isProfileComplete = !!(profile?.name && profile?.enrollmentNumber && profile?.barCouncil);
      router.replace(isProfileComplete ? '/(tabs)' : '/login');
    } catch {
      router.replace('/login');
    }
  }, [router]);

  // ── Web guard: skip video entirely on web ──────────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') {
      navigateAway();
    }
  }, []);

  // ── Fallback: force-navigate after 10s if video event never fires ──────
  useEffect(() => {
    if (Platform.OS === 'web') return;
    navigatedRef.current = false;
    const timeout = setTimeout(() => { navigateAway(); }, 10000);
    return () => clearTimeout(timeout);
  }, []);

  const player = useVideoPlayer(
    require('../assets/intro.mp4'),
    (p) => {
      p.loop = false;
      p.play();
    }
  );

  // ── Listen for video end (payload is { isPlaying: boolean }, not boolean) ──
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = player.addListener('playingChange', (payload: { isPlaying: boolean }) => {
      if (!payload.isPlaying && player.currentTime > 0) {
        navigateAway();
      }
    });
    return () => sub.remove();
  }, [player]);

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls={false}
        contentFit="cover"
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />

      <TouchableOpacity
        testID="intro-skip-btn"
        style={styles.skipButton}
        onPress={navigateAway}
        activeOpacity={0.8}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  video: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    zIndex: 10,
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
