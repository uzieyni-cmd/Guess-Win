export async function register() {
  // רץ רק ב-Node.js runtime (לא Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    validateSecrets()
    const { startSyncCron } = await import('./lib/sync-cron')
    startSyncCron()
  }
}

function validateSecrets() {
  const secret = process.env.CRON_SECRET ?? ''
  const PLACEHOLDER = 'replace-with-a-random-secret-string'

  if (!secret || secret === PLACEHOLDER || secret.length < 32) {
    // בסביבת production זה שגיאה קריטית — מונע הפעלה לא מאובטחת
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[security] CRON_SECRET חסר או חלש מדי. הרץ: openssl rand -hex 32 ועדכן ב-Vercel Environment Variables.'
      )
    } else {
      console.warn(
        '[security] אזהרה: CRON_SECRET לא הוגדר כראוי. לפני deploy הרץ: openssl rand -hex 32'
      )
    }
  }
}
