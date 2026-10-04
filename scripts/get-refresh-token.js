// One-time script to obtain a Google OAuth2 refresh token for Drive + Docs
// API access (lease generation, api/generate-lease.js). Run locally from
// your own terminal — this is not deployed, not imported by the app.
//
// Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment,
// from an OAuth2 client (not a service account) in Google Cloud Console.
// Export them yourself, or run with:
//   set -a && source .env.local && set +a
// after adding both to .env.local.
//
// Usage — two separate runs:
//   1. node scripts/get-refresh-token.js
//      Prints an authorization URL. Open it, sign in as the Google account
//      that should own the generated leases, and grant access.
//   2. node scripts/get-refresh-token.js <code>
//      Exchanges the authorization code Google gave you for tokens and
//      prints the refresh_token.
//
// Redirect URI: defaults to the out-of-band value
// ("urn:ietf:wg:oauth:2.0:oob"), which has Google show the code directly on
// its own confirmation page rather than redirecting anywhere — no server
// needed for this script. Google has been phasing OOB out for newer OAuth
// clients, though; if the authorization URL errors or refuses to show a
// code, your OAuth client likely doesn't support it. In that case:
//   - Add http://localhost as an authorized redirect URI on the OAuth
//     client in Google Cloud Console.
//   - Re-run this script with GOOGLE_REDIRECT_URI=http://localhost set.
//   - After granting access, the browser will redirect to a
//     http://localhost/?code=...&scope=... URL that fails to load (nothing
//     is listening there) — that's expected. Copy the "code" value straight
//     out of the address bar and pass it as the argument in step 2.
//
// access_type: 'offline' + prompt: 'consent' are both required to actually
// get a refresh_token back — Google only issues one on first consent, or
// when prompt=consent forces the consent screen again even for an account
// that already authorized this app before.

import { google } from 'googleapis'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
]

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET in the environment.')
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

const code = process.argv[2]

if (!code) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  })
  console.log('Open this URL, sign in, and grant access:\n')
  console.log(authUrl)
  console.log('\nThen run this script again with the authorization code as an argument:')
  console.log('  node scripts/get-refresh-token.js <code>')
} else {
  try {
    const { tokens } = await oauth2Client.getToken(code)
    if (!tokens.refresh_token) {
      console.error(
        'No refresh_token in the response — Google only issues one on first consent. ' +
        'Revoke this app\'s access at https://myaccount.google.com/permissions and run ' +
        'the script again from step 1 so a fresh one is issued.'
      )
      process.exit(1)
    }
    console.log('refresh_token:\n')
    console.log(tokens.refresh_token)
  } catch (err) {
    console.error('Token exchange failed:', err.message)
    process.exit(1)
  }
}
