/**
 * Pictures for pyramid notes, fetched on demand from Wikimedia Commons (freely
 * licensed media, CORS enabled) and kept only in the user's own data — nothing
 * is bundled with the app or stored in the repository.
 */
import { noteCategory } from '@/data/noteCatalog'

export interface CommonsImage {
  thumb: string
  title: string
  credit: string // "Author · Licence"
  page: string
}

const API = 'https://commons.wikimedia.org/w/api.php'

/** Search words per note where the bare name would find the wrong thing (or nothing). */
const OVERRIDES: Record<string, string> = {
  'white flowers': 'white flowers bouquet',
  'floral notes': 'flower bouquet',
  'fruity notes': 'fruit assortment',
  'citrus notes': 'citrus fruits',
  'green notes': 'green leaves',
  'aromatic notes': 'aromatic herbs',
  'spicy notes': 'spices assortment',
  'sweet notes': 'sweets candy',
  'woody notes': 'wood texture',
  'blonde woods': 'light wood texture',
  'balsamic notes': 'resin tree',
  'animalic notes': 'fur texture',
  'white sugar': 'white sugar cubes',
  'brown sugar': 'brown sugar',
  'white musk': 'white cotton boll',
  'musk': 'musk deer',
  'skin musk': 'human skin close-up',
  'clean musk': 'white cotton boll',
  'white amber': 'amber stone',
  'amber': 'amber gemstone',
  'ambroxan': 'ambergris',
  'cashmeran': 'cashmere wool',
  'iso e super': 'cedar wood texture',
  'cashmere wood': 'cashmere wool',
  'snow': 'fresh snow close-up',
  'ice': 'ice crystals',
  'ozonic notes': 'sky clouds',
  'sea notes': 'sea waves',
  'water notes': 'water drops',
  'fresh air': 'blue sky',
  'metallic notes': 'brushed steel',
  'mineral notes': 'stones pebbles',
  'aldehydes': 'soap bubbles',
  'clean laundry': 'laundry drying',
  'powdery notes': 'face powder',
  'rain': 'rain drops',
  'oud': 'agarwood',
  'cut grass': 'mown grass',
  'cotton candy': 'cotton candy',
  'marshmallow': 'marshmallows',
  'smoke': 'smoke',
  'leather': 'leather texture',
  'suede': 'suede texture',
  'lime': 'lime fruit',
  'orange blossom': 'orange blossom flower',
  'lily of the valley': 'convallaria majalis',
  'tonka bean': 'tonka beans',
  'iris': 'iris flower',
  'violet': 'viola odorata',
  'violet leaf': 'viola leaves',
  'champagne': 'champagne glass',
  'mate': 'yerba mate',
  'chai': 'masala chai',
  'velvet': 'velvet fabric',
  'silk': 'silk fabric',
  'cotton': 'cotton boll',
  'paper': 'paper texture',
  'ink': 'ink',
  'sand': 'sand dunes',
  'hay': 'hay bales',
  'castoreum': 'beaver',
  'civet': 'civet',
  'tiaré flower': 'gardenia taitensis',
  'cedar': 'cedar wood',
  'birch': 'birch bark',
  'moss': 'moss close-up',
  'rose': 'rose flower'
}

const CATEGORY_HINT: Record<string, string> = {
  citrus: 'fruit', fruits: 'fruit', florals: 'flower', white: 'flower', spices: 'spice', woods: 'wood', resins: 'resin', drinks: 'drink'
}

/** Default search text for a note. */
export function noteQuery(name: string): string {
  const k = name.trim().toLowerCase()
  if (OVERRIDES[k]) return OVERRIDES[k]
  const hint = CATEGORY_HINT[noteCategory(name).id]
  return hint && !k.includes(hint) ? `${name} ${hint}` : name
}

const strip = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

export async function searchCommons(query: string, limit = 12): Promise<CommonsImage[]> {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*',
    generator: 'search', gsrsearch: `${query} filetype:bitmap`, gsrnamespace: '6', gsrlimit: String(limit),
    prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '320', iiextmetadatafilter: 'LicenseShortName|Artist'
  })
  const res = await fetch(`${API}?${params}`)
  if (!res.ok) throw new Error(`Commons ${res.status}`)
  const data = await res.json()
  const pages = Object.values(data?.query?.pages ?? {}) as {
    index?: number
    title: string
    imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[]
  }[]
  return pages
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((p) => {
      const ii = p.imageinfo?.[0]
      const meta = ii?.extmetadata ?? {}
      const author = strip(meta.Artist?.value ?? '') || 'Unknown author'
      const lic = strip(meta.LicenseShortName?.value ?? '')
      return { thumb: ii?.thumburl ?? '', title: p.title.replace(/^File:/, ''), credit: [author, lic].filter(Boolean).join(' · '), page: ii?.descriptionurl ?? '' }
    })
    .filter((x) => x.thumb)
}

/** Read any image source into a centre-cropped square JPEG data URL. */
export async function squareThumb(src: string, size = 200): Promise<string> {
  const img = new Image()
  img.src = src
  await img.decode()
  const s = Math.min(img.naturalWidth, img.naturalHeight)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size)
  return c.toDataURL('image/jpeg', 0.82)
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })

/** File from the device → thumb (data: URL — the CSP allows data: images, not blob:). */
export async function fileToThumb(file: File): Promise<string> {
  return squareThumb(await blobToDataUrl(file))
}

/** Remote picture → thumb stored locally, so it works offline afterwards. */
export async function urlToThumb(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image ${res.status}`)
  return squareThumb(await blobToDataUrl(await res.blob()))
}
