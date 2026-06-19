// Backend base URL.
// - Dev (emulator): run `adb reverse tcp:3000 tcp:3000`, then localhost:3000 reaches
//   the Next.js dev server on your machine.
// - Prod: set EXPO_PUBLIC_API_URL to your deployed URL (e.g. https://inventory.ebright.my).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
