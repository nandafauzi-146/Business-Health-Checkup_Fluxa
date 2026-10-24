import { redirect } from 'next/navigation'

/**
 * Backward-compatibility redirect.
 * The canonical subscription page now lives at /owner/langganan.
 * Any old bookmarks, links, or external references to /langganan
 * will land here and be redirected to the new route, preserving
 * all query parameters (onboard, planId, etc.).
 */
export default function LanggananRedirectPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v))
    } else if (value !== undefined) {
      params.set(key, value)
    }
  }
  const qs = params.toString()
  redirect(`/owner/langganan${qs ? `?${qs}` : ''}`)
}
