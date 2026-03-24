export async function register() {
  // רץ רק ב-Node.js runtime (לא Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSyncCron } = await import('./lib/sync-cron')
    startSyncCron()
  }
}
