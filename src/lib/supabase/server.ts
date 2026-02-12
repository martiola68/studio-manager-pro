import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { NextApiRequest, NextApiResponse } from 'next'

export function createClient(req: NextApiRequest, res: NextApiResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies[name]
        },
        set(name: string, value: string, options: CookieOptions) {
          res.setHeader('Set-Cookie', serialize(name, value, options))
        },
        remove(name: string, options: CookieOptions) {
          res.setHeader('Set-Cookie', serialize(name, '', { ...options, maxAge: 0 }))
        },
      },
    }
  )
}

function serialize(name: string, value: string, options: CookieOptions = {}): string {
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`]

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`)
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`)
  }

  if (options.path) {
    parts.push(`Path=${options.path}`)
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`)
  }

  if (options.httpOnly) {
    parts.push('HttpOnly')
  }

  if (options.secure) {
    parts.push('Secure')
  }

  if (options.sameSite) {
    const sameSite = options.sameSite === true ? 'Strict' : options.sameSite
    parts.push(`SameSite=${sameSite}`)
  }

  return parts.join('; ')
}