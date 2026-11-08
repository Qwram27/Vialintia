import type { Material, MaterialType, NoteLevel } from '@shared/types'
import { uid } from '@/lib/id'

// Starter palette. Tenacity values are rough blotter estimates.
// IFRA limits and prices are intentionally left blank — fill them in from your
// supplier's IFRA certificate / the current IFRA Amendment.
type Seed = [name: string, cas: string, family: string, note: NoteLevel, tenacityH: number, dilution: number, type: MaterialType, description: string]

const SEEDS: Seed[] = [
  // ---- Top ----
  ['Bergamot oil', '8007-75-8', 'citrus', 'top', 2, 100, 'natural', 'Fresh, sparkling, slightly floral citrus'],
  ['Lemon oil', '8008-56-8', 'citrus', 'top', 1, 100, 'natural', 'Bright, zesty, juicy'],
  ['Sweet orange oil', '8008-57-9', 'citrus', 'top', 1, 100, 'natural', 'Sweet, juicy peel'],
  ['Grapefruit oil', '8016-20-4', 'citrus', 'top', 1, 100, 'natural', 'Bitter-fresh, sulfurous facet'],
  ['Mandarin oil', '8008-31-9', 'citrus', 'top', 2, 100, 'natural', 'Sweet, tangerine-like, soft'],
  ['Lime oil distilled', '8008-26-2', 'citrus', 'top', 1, 100, 'natural', 'Sharp, terpenic, cola-like'],
  ['Citral', '5392-40-5', 'citrus', 'top', 3, 10, 'synthetic', 'Intense lemon peel'],
  ['Dihydromyrcenol', '18479-58-8', 'citrus', 'top', 6, 100, 'synthetic', 'Fresh metallic lime, clean'],
  ['Linalool', '78-70-6', 'floral', 'top', 4, 100, 'synthetic', 'Fresh floral-woody, lavender/bois de rose'],
  ['Linalyl acetate', '115-95-7', 'aromatic', 'top', 4, 100, 'synthetic', 'Bergamot-lavender, fruity-fresh'],
  ['Aldehyde C-10 (decanal)', '112-31-2', 'aldehydic', 'top', 8, 10, 'synthetic', 'Waxy orange peel'],
  ['Aldehyde C-11 undecylenic', '112-45-8', 'aldehydic', 'top', 12, 10, 'synthetic', 'Waxy, clean, ozonic'],
  ['Aldehyde C-12 MNA', '110-41-8', 'aldehydic', 'top', 24, 10, 'synthetic', 'Ambergris-like, incense, waxy'],
  ['cis-3-Hexenol', '928-96-1', 'green', 'top', 1, 10, 'synthetic', 'Freshly cut grass'],
  ['Galbanum oil', '8023-91-6', 'green', 'top', 12, 10, 'natural', 'Sharp, bitter green, pea-pod'],
  ['Triplal (Ligustral)', '68039-49-6', 'green', 'top', 6, 10, 'synthetic', 'Powerful green, leafy'],
  ['Lavender oil', '8000-28-0', 'aromatic', 'top', 6, 100, 'natural', 'Herbaceous, floral, camphoraceous'],
  ['Rosemary oil', '8000-25-7', 'herbal', 'top', 3, 100, 'natural', 'Camphoraceous, herbal'],
  ['Peppermint oil', '8006-90-4', 'herbal', 'top', 3, 10, 'natural', 'Cooling, minty'],
  ['Eucalyptus oil', '8000-48-4', 'herbal', 'top', 2, 100, 'natural', 'Cineolic, fresh, medicinal'],
  ['Pink pepper oil', '68917-52-2', 'spicy', 'top', 4, 100, 'natural', 'Rosy, peppery, sparkling'],
  ['Black pepper oil', '8006-82-4', 'spicy', 'top', 6, 100, 'natural', 'Dry, warm-spicy, woody'],
  ['Cardamom oil', '8000-66-6', 'spicy', 'top', 6, 100, 'natural', 'Fresh-spicy, eucalyptol facet'],
  ['Calone', '28940-11-6', 'aquatic', 'top', 48, 1, 'synthetic', 'Marine, watermelon, ozonic'],
  ['Ethyl 2-methylbutyrate', '7452-79-1', 'fruity', 'top', 1, 10, 'synthetic', 'Green apple, fruity'],
  ['Allyl amyl glycolate', '67634-00-8', 'fruity', 'top', 12, 10, 'synthetic', 'Pineapple, galbanum-green'],

  // ---- Heart ----
  ['Hedione', '24851-98-7', 'floral', 'heart', 100, 100, 'synthetic', 'Transparent jasmine, radiant'],
  ['Phenylethyl alcohol', '60-12-8', 'floral', 'heart', 24, 100, 'synthetic', 'Rose, honeyed'],
  ['Geraniol', '106-24-1', 'floral', 'heart', 24, 100, 'synthetic', 'Rosy, sweet, citrusy'],
  ['Citronellol', '106-22-9', 'floral', 'heart', 24, 100, 'synthetic', 'Fresh rose, citronella'],
  ['Rose oil (Bulgarian)', '8007-01-0', 'floral', 'heart', 48, 10, 'natural', 'Deep, honeyed rose'],
  ['Jasmine absolute', '8022-96-6', 'floral', 'heart', 60, 10, 'natural', 'Rich, indolic, fruity jasmine'],
  ['Ylang-ylang oil', '8006-81-3', 'floral', 'heart', 48, 100, 'natural', 'Creamy, banana, spicy floral'],
  ['Geranium oil', '8000-46-2', 'floral', 'heart', 24, 100, 'natural', 'Rosy-minty, green'],
  ['Benzyl acetate', '140-11-4', 'floral', 'heart', 6, 100, 'synthetic', 'Fruity jasmine, pear'],
  ['Indole', '120-72-9', 'floral', 'heart', 200, 1, 'synthetic', 'Animalic, mothball, white floral'],
  ['Hydroxycitronellal', '107-75-5', 'floral', 'heart', 100, 100, 'synthetic', 'Lily-of-the-valley, linden'],
  ['Helional', '1205-17-0', 'aquatic', 'heart', 48, 10, 'synthetic', 'Ozonic, marine, cyclamen'],
  ['Clary sage oil', '8016-63-9', 'herbal', 'heart', 24, 100, 'natural', 'Herbal, tea-like, ambery'],
  ['alpha-Ionone', '127-41-3', 'powdery', 'heart', 80, 10, 'synthetic', 'Violet, woody, raspberry'],
  ['Methyl ionone gamma', '127-51-5', 'powdery', 'heart', 150, 100, 'synthetic', 'Orris, violet, powdery'],
  ['Irone alpha', '79-69-6', 'powdery', 'heart', 200, 1, 'synthetic', 'Orris butter, buttery violet root'],
  ['Heliotropin', '120-57-0', 'powdery', 'heart', 200, 10, 'synthetic', 'Almond, cherry-blossom, powdery'],
  ['Eugenol', '97-53-0', 'spicy', 'heart', 60, 10, 'synthetic', 'Clove, spicy'],
  ['Clove bud oil', '8000-34-8', 'spicy', 'heart', 60, 10, 'natural', 'Clove, warm-spicy'],
  ['Cinnamon bark oil', '8015-91-6', 'spicy', 'heart', 48, 1, 'natural', 'Hot, sweet cinnamon'],
  ['Nutmeg oil', '8008-45-5', 'spicy', 'heart', 12, 100, 'natural', 'Spicy, terpenic, nutty'],
  ['beta-Damascone', '23726-91-2', 'fruity', 'heart', 150, 0.1, 'synthetic', 'Plum, rose, tobacco'],
  ['gamma-Decalactone', '706-14-9', 'fruity', 'heart', 100, 10, 'synthetic', 'Creamy peach'],
  ['Frambinone', '5471-51-2', 'fruity', 'heart', 300, 10, 'synthetic', 'Raspberry, jammy'],
  ['Iso E Super', '54464-57-2', 'woody', 'heart', 300, 100, 'synthetic', 'Velvety cedar-amber, radiant'],
  ['Isobutyl quinoline', '65442-31-1', 'leather', 'heart', 300, 1, 'synthetic', 'Leather, earthy, green-bitter'],

  // ---- Base ----
  ['Ambroxan', '6790-58-5', 'amber', 'base', 400, 10, 'synthetic', 'Ambergris, mineral, woody'],
  ['Benzoin resinoid Siam', '9000-72-0', 'amber', 'base', 400, 50, 'natural', 'Vanillic, balsamic'],
  ['Labdanum absolute', '', 'amber', 'base', 400, 10, 'natural', 'Leathery, resinous amber'],
  ['Myrrh oil', '8016-37-3', 'amber', 'base', 200, 100, 'natural', 'Bitter, resinous, mushroomy'],
  ['Olibanum oil', '8016-36-2', 'amber', 'base', 48, 100, 'natural', 'Incense, lemony, resinous'],
  ['Vanillin', '121-33-5', 'gourmand', 'base', 400, 10, 'synthetic', 'Sweet vanilla'],
  ['Ethyl vanillin', '121-32-4', 'gourmand', 'base', 400, 10, 'synthetic', 'Intense creamy vanilla'],
  ['Ethyl maltol', '4940-11-8', 'gourmand', 'base', 300, 1, 'synthetic', 'Cotton candy, caramel'],
  ['Coumarin', '91-64-5', 'gourmand', 'base', 300, 10, 'synthetic', 'Hay, tonka, almond'],
  ['Tonka bean absolute', '8046-22-8', 'gourmand', 'base', 400, 10, 'natural', 'Coumarinic, tobacco, sweet'],
  ['Sandalore', '65113-99-7', 'woody', 'base', 400, 100, 'synthetic', 'Creamy sandalwood'],
  ['Javanol', '198404-98-7', 'woody', 'base', 400, 1, 'synthetic', 'Rosy, milky sandalwood'],
  ['Cedarwood Virginia oil', '8000-27-9', 'woody', 'base', 200, 100, 'natural', 'Dry, pencil shavings'],
  ['Vetiver oil', '8016-96-4', 'woody', 'base', 400, 100, 'natural', 'Earthy, smoky, rooty'],
  ['Patchouli oil', '8014-09-3', 'woody', 'base', 400, 100, 'natural', 'Earthy, camphor, chocolate'],
  ['Guaiacwood oil', '8016-23-7', 'woody', 'base', 300, 100, 'natural', 'Smoky, rosy wood'],
  ['Oakmoss absolute', '9000-50-4', 'mossy', 'base', 400, 10, 'natural', 'Mossy, inky, forest floor'],
  ['Evernyl', '4707-47-5', 'mossy', 'base', 400, 10, 'synthetic', 'Oakmoss-like, dry'],
  ['Birch tar oil (rectified)', '8001-88-5', 'leather', 'base', 400, 1, 'natural', 'Smoky leather, tarry'],
  ['Cashmeran', '33704-61-9', 'musk', 'base', 300, 100, 'synthetic', 'Musky, woody, velvety'],
  ['Galaxolide', '1222-05-5', 'musk', 'base', 400, 50, 'synthetic', 'Clean, sweet musk (usually 50% in IPM/DEP)'],
  ['Habanolide', '111879-80-2', 'musk', 'base', 400, 100, 'synthetic', 'Metallic, ironed linen musk'],
  ['Ethylene brassylate', '105-95-3', 'musk', 'base', 400, 100, 'synthetic', 'Sweet, powdery musk'],
  ['Exaltolide', '106-02-5', 'musk', 'base', 400, 10, 'synthetic', 'Fine, animalic musk'],
  ['Helvetolide', '141773-73-1', 'musk', 'base', 400, 100, 'synthetic', 'Fruity pear musk'],
  ['Benzyl salicylate', '118-58-1', 'floral', 'base', 400, 100, 'synthetic', 'Faint balsamic floral, fixative']
]

export function seedMaterials(): Material[] {
  const now = new Date().toISOString()
  return SEEDS.map(([name, cas, family, note, tenacityHours, defaultDilution, type, description]) => ({
    id: uid(),
    name,
    cas: cas || undefined,
    family,
    note,
    tenacityHours,
    defaultDilution,
    solvent: defaultDilution < 100 ? 'DPG' : undefined,
    pricePerKg: null,
    supplier: '',
    ifraLimit: null,
    description,
    type,
    createdAt: now,
    updatedAt: now
  }))
}
