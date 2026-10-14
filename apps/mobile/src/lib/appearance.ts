import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseAppearance, type AppearanceChoice } from '@compences/core';

/**
 * System, Light or Dark, chosen on the Me tab and kept on the phone.
 *
 * Appearance.setColorScheme() changes what useColorScheme() reports across the
 * whole app, so useTheme() and the status bar follow it without knowing a
 * choice exists.
 */

const STORAGE_KEY = 'compences.theme';

let chosen: AppearanceChoice = 'system';
const listeners = new Set<() => void>();

function apply(choice: AppearanceChoice) {
  // 'unspecified' hands the colours back to the device.
  Appearance.setColorScheme(choice === 'system' ? 'unspecified' : choice);
  chosen = choice;
  for (const listener of listeners) listener();
}

/**
 * Applies the saved choice. Run once at startup, from the root layout; until
 * the read answers, and if it fails, the app follows the device as before.
 */
export function applySavedAppearance() {
  AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => {
      const choice = parseAppearance(stored);
      // System is what the app is already doing.
      if (choice !== 'system') apply(choice);
    })
    .catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current choice, and a setter that applies and saves a new one. */
export function useAppearance() {
  const choice = useSyncExternalStore(subscribe, () => chosen);
  const choose = (next: AppearanceChoice) => {
    apply(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };
  return [choice, choose] as const;
}
