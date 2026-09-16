// Vercel function for POST /api/waitlist. The logic lives in src/server/waitlist.ts.
// Set WAITLIST_SCRIPT_URL and WAITLIST_SECRET in the Vercel project's environment variables.
import { handleWaitlist } from '../src/server/waitlist.js'

export function POST(request: Request): Promise<Response> {
  return handleWaitlist(request, {
    scriptUrl: process.env['WAITLIST_SCRIPT_URL'],
    secret: process.env['WAITLIST_SECRET'],
  })
}
