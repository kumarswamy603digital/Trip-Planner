/**
 * Vercel serverless function — POST /api/narrate
 * Thin wrapper around the same handler `npm run dev` mounts, so dev and production
 * answer identically. It never throws a 5xx: silence means "use the template narration".
 */
import { narrate } from '../server/narrateHandler.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST')
    return res.status(200).json({ fallback: true, reason: 'method-not-post' })
  }
  await narrate(req, res)
}

export const config = {
  runtime: 'edge'
}
