import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Keys live in iOS Keychain via SecureStore.
// Android uses EncryptedSharedPreferences.
// Web uses localStorage fallback.

export const StorageKeys = {
  jwt: 'auth.jwt',
  sessionToken: 'auth.sessionToken',
  user: 'auth.user',
  themeMode: 'pref.themeMode',
} as const;

type Key = (typeof StorageKeys)[keyof typeof StorageKeys];

export async function setItem(key: Key, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }


  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getItem(key: Key): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }

  return await SecureStore.getItemAsync(key);
}

export async function removeItem(key: Key): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function clearAuth(): Promise<void> {
  await Promise.all([
    removeItem(StorageKeys.jwt),
    removeItem(StorageKeys.sessionToken),
    removeItem(StorageKeys.user),
  ]);
}