/**
 * TinyPercent waiting list: Google Apps Script that appends signups to a sheet.
 *
 * Setup (about five minutes, in your own Google account):
 *   1. Use the Google Sheet "tinypercent waiting list" in Drive, or create one.
 *   2. Go to https://script.google.com -> New project, and replace the editor's
 *      contents with this whole file. Set SHEET_ID below to the long id in the
 *      Sheet's address (docs.google.com/spreadsheets/d/<SHEET_ID>/edit).
 *   3. Replace SECRET below with a long random string (e.g. from
 *      `openssl rand -hex 32`). Keep it private.
 *   4. Deploy -> New deployment -> type "Web app".
 *        Execute as: Me
 *        Who has access: Anyone
 *      Authorise when asked, then copy the Web app URL ending in /exec.
 *   5. In Vercel -> Project -> Settings -> Environment Variables, add
 *        WAITLIST_SCRIPT_URL = the /exec URL
 *        WAITLIST_SECRET     = the same string as SECRET below
 *      then redeploy. For local testing put the same two lines in .env.local.
 *
 * "Anyone" can reach the URL, but only a request carrying SECRET writes a row,
 * and only the site's server knows it. After editing this script, publish a new
 * version (Deploy -> Manage deployments -> Edit -> New version) so the URL
 * serves the change.
 */

const SECRET = 'replace-with-a-long-random-string'
const SHEET_ID = 'replace-with-the-sheet-id'
const HEADERS = ['Submitted at', 'First name', 'Surname', 'Email', 'Source']

function doPost(e) {
  let data
  try {
    data = JSON.parse(e.postData.contents)
  } catch (error) {
    return json({ ok: false, error: 'bad_request' })
  }
  if (!data || data.secret !== SECRET) return json({ ok: false, error: 'unauthorised' })

  const lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    // Rows go to the first tab of the sheet named by SHEET_ID.
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0]
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS)

    const email = text(data.email).toLowerCase()
    const rows = sheet.getLastRow() - 1
    const known = rows > 0 ? sheet.getRange(2, 4, rows, 1).getValues().map((row) => String(row[0]).toLowerCase()) : []
    // Signing up twice is not an error, but it does not add a second row.
    if (known.indexOf(email) === -1) {
      sheet.appendRow([new Date(data.submittedAt || Date.now()), text(data.firstName), text(data.lastName), email, text(data.source)])
    }
    return json({ ok: true })
  } finally {
    lock.releaseLock()
  }
}

/** Text only: a leading =, +, - or @ would otherwise make the cell a formula. */
function text(value) {
  const s = String(value == null ? '' : value).slice(0, 254)
  return /^[=+\-@]/.test(s) ? "'" + s : s
}

function json(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON)
}
