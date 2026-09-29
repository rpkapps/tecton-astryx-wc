/**
 * Chromium for the docs tools. Same rule as vitest.config.ts: `$CHROMIUM_PATH`, else the local
 * `/opt/pw-browsers/chromium`, else Playwright's own build. Never installs a browser.
 */
import {existsSync} from 'node:fs';
import {chromium, type Browser} from 'playwright';

const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';

export function chromiumExecutable(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.CHROMIUM_PATH) return env.CHROMIUM_PATH;
  return existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined;
}

export async function launchChromium(): Promise<Browser> {
  const executablePath = chromiumExecutable();
  try {
    return await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
  } catch (error) {
    throw new Error(
      'Could not start Chromium. Point CHROMIUM_PATH at an installed Chrome or Edge (137 or newer), e.g. ' +
        'PowerShell: $env:CHROMIUM_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" ' +
        '(see AGENTS.md).',
      {cause: error},
    );
  }
}
