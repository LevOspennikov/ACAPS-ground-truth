// Embedded storage is opt-in and only available to local test-mode servers.
export function embeddedDatabaseEnabled(env) {
  if (env.TEST_DATABASE !== 'embedded') return false;
  if (env.MODE !== 'test' || env.PROD || env.NODE_ENV === 'production' || env.VERCEL) {
    throw new Error('Embedded database requires local test mode and is forbidden in builds and deployments.');
  }
  return true;
}
