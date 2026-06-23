export type UtmDraft = {
  source: string
  medium: string
  campaign: string
}

export const emptyUtmForm: UtmDraft = {
  source: '',
  medium: '',
  campaign: '',
}

export function destinationWithUtm(destination: string, utm: UtmDraft) {
  const url = new URL(destination)
  const fields = {
    utm_source: utm.source,
    utm_medium: utm.medium,
    utm_campaign: utm.campaign,
  }

  for (const [key, value] of Object.entries(fields)) {
    const trimmed = value.trim()
    if (trimmed) {
      url.searchParams.set(key, trimmed)
    }
  }

  return url.toString()
}
