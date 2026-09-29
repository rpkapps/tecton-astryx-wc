/// <reference types="@vitest/browser-playwright" />
/**
 * Media emulation over CDP (Chromium only; A§15.2): forced colours, colour scheme, reduced motion,
 * contrast. Returns a restore function; the setup file also resets emulation after every test.
 */
import {cdp} from 'vitest/browser';

export interface MediaEmulation {
  forcedColors?: 'active' | 'none';
  colorScheme?: 'light' | 'dark';
  reducedMotion?: 'reduce' | 'no-preference';
  contrast?: 'more' | 'less' | 'no-preference';
}

const FEATURE_NAMES: Record<keyof MediaEmulation, string> = {
  forcedColors: 'forced-colors',
  colorScheme: 'prefers-color-scheme',
  reducedMotion: 'prefers-reduced-motion',
  contrast: 'prefers-contrast',
};

let emulated = false;

/** Applies the emulation and returns a function that clears it. */
export async function emulateMedia(options: MediaEmulation): Promise<() => Promise<void>> {
  const features = (Object.keys(options) as (keyof MediaEmulation)[])
    .filter((key) => options[key] !== undefined)
    .map((key) => ({name: FEATURE_NAMES[key], value: options[key] as string}));
  await cdp().send('Emulation.setEmulatedMedia', {features});
  emulated = true;
  return clearMediaEmulation;
}

/** Clears every media emulation (called by the setup file after each test). */
export async function clearMediaEmulation(): Promise<void> {
  if (!emulated) return;
  emulated = false;
  await cdp().send('Emulation.setEmulatedMedia', {features: []});
}
