import assert from 'node:assert/strict'
import { destinationWithUtm, emptyUtmForm, type UtmDraft } from '../src/utm.ts'

function tagged(destination: string, utm: Partial<UtmDraft>) {
  return destinationWithUtm(destination, { ...emptyUtmForm, ...utm })
}

assert.equal(
  tagged('https://example.com/launch', {
    source: 'newsletter',
    medium: 'qr',
    campaign: 'summer launch',
  }),
  'https://example.com/launch?utm_source=newsletter&utm_medium=qr&utm_campaign=summer+launch',
)

assert.equal(
  tagged('https://example.com/launch?ref=door', {
    source: 'poster',
    medium: 'qr',
    campaign: 'store',
  }),
  'https://example.com/launch?ref=door&utm_source=poster&utm_medium=qr&utm_campaign=store',
)

assert.equal(
  tagged('https://example.com/launch?utm_source=old&utm_medium=email&utm_campaign=old', {
    source: 'retargeting',
    medium: 'qr',
    campaign: 'spring',
  }),
  'https://example.com/launch?utm_source=retargeting&utm_medium=qr&utm_campaign=spring',
)

assert.equal(
  tagged('https://example.com/launch#pricing', {
    source: ' social ',
    medium: '',
    campaign: 'pricing page',
  }),
  'https://example.com/launch?utm_source=social&utm_campaign=pricing+page#pricing',
)

assert.equal(
  tagged('https://example.com/launch?keep=1', {
    source: '',
    medium: ' ',
    campaign: '',
  }),
  'https://example.com/launch?keep=1',
)

console.log('utm ok')
