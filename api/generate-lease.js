// Generates one lease document from the Season Invites template: copies the
// template into the destination Drive folder, fills in the merge fields via
// the Docs API, right-aligns the financial table's value column, and
// returns the new document's Drive view URL.
//
// Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN
// in the Vercel environment — an OAuth2 client plus a refresh token for
// whichever Google account should own the generated leases (see
// scripts/get-refresh-token.js for obtaining the refresh token). That
// account needs its own access to the template file and destination folder
// — same as before with the service account, Drive access is granted
// per-file/folder, a token alone isn't enough.
//
// Not yet run against the real API in this environment: none of the three
// env vars exist in Vercel today (confirmed via `vercel env ls`), so this
// has been verified for syntax, auth wiring, and its request shapes against
// the documented Drive v3 / Docs v1 APIs, but not against the actual
// template document — see the alignment note below.

import { google } from 'googleapis'
import { buildLeaseData } from '../src/lib/generateLease.js'

const TEMPLATE_FILE_ID = '14FtLEqfUDsUEJeQu2ZiAhZ-PoX1dAddBqO-OIyyYpcQ'
const DEST_FOLDER_ID = '1fPJYQ1snNWgmvGk9Eo_4doHKzkMmFauR'

function getAuth() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env
  const missing = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN']
    .filter(name => !process.env[name])
  if (missing.length > 0) {
    const err = new Error(`Missing from the environment: ${missing.join(', ')}.`)
    err.code = 'missing_credentials'
    throw err
  }
  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN })
  return auth
}

// Right-aligns the value column of the lease's financial summary table.
// The real template's exact structure can't be inspected without live
// credentials, so this locates it generically: the first table in the
// document body, assumed to be a 2-column "label | value" layout per the
// brief's row list (Total Rent, Damage Protection Fee, Total Due, Deposit,
// the two installments, lodging tax) — every row's last cell gets END
// alignment. If the real template has more than one table, or isn't 2
// columns, this will need adjusting once it can actually run against it.
async function rightAlignValueColumn(docs, documentId) {
  const { data: doc } = await docs.documents.get({ documentId })
  const body = doc.body?.content || []
  const tableEl = body.find(el => el.table)
  if (!tableEl) return

  const requests = []
  for (const row of tableEl.table.tableRows || []) {
    const cells = row.tableCells || []
    const valueCell = cells[cells.length - 1]
    if (!valueCell) continue
    for (const content of valueCell.content || []) {
      if (!content.paragraph) continue
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: content.startIndex, endIndex: content.endIndex },
          paragraphStyle: { alignment: 'END' },
          fields: 'alignment',
        },
      })
    }
  }
  if (requests.length > 0) {
    await docs.documents.batchUpdate({ documentId, requestBody: { requests } })
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { name, email, start_date, end_date, proposed_rent } = req.body || {}
  if (!name || !start_date || !end_date || proposed_rent == null) {
    return res.status(400).json({ error: 'Missing required fields: name, start_date, end_date, proposed_rent' })
  }

  try {
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    const docs = google.docs({ version: 'v1', auth })

    const { mergeFields, year } = buildLeaseData({ name, email, start_date, end_date, proposed_rent })

    const { data: copied } = await drive.files.copy({
      fileId: TEMPLATE_FILE_ID,
      requestBody: {
        name: `Cahoon Hollow Lease ${year} - ${name}`,
        parents: [DEST_FOLDER_ID],
      },
      fields: 'id, webViewLink',
    })
    const documentId = copied.id

    const replaceRequests = Object.entries(mergeFields).map(([search, replacement]) => ({
      replaceAllText: {
        containsText: { text: search, matchCase: true },
        replaceText: replacement,
      },
    }))
    await docs.documents.batchUpdate({ documentId, requestBody: { requests: replaceRequests } })

    await rightAlignValueColumn(docs, documentId)

    const url = copied.webViewLink || `https://drive.google.com/file/d/${documentId}/view`
    return res.status(200).json({ url, documentId })
  } catch (err) {
    console.error('[generate-lease] failed:', err?.message || err)
    return res.status(500).json({ error: err?.message || 'Lease generation failed' })
  }
}
