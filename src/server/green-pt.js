import { env } from 'node:process';

// Currently unused: reserved for a future Green PT integration.
// Server-only. Do not import into browser code or log the returned value.
export function getGreenPtApiKey() {
  return env.GREEN_PT_API_KEY || null;
}
