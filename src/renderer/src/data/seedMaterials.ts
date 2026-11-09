import type { Material, MaterialType, NoteLevel } from '@shared/types'
import { uid } from '@/lib/id'

// Starter library. CAS numbers were cross-checked against supplier / database listings
// (Nov 2026). Natural materials often carry more than one CAS (EU vs TSCA, oil vs absolute) —
// always confirm against your supplier's documents. Tenacity, IFRA limits and prices are left
// blank on purpose: fill them in from TGSC / the IFRA Standards / your supplier.
// Default dilution is only a practical stock-solution suggestion.
type Seed = [name: string, cas: string, family: string, note: NoteLevel, dilution: number, type: MaterialType, description: string]

/** Bump when seeds are added so existing libraries receive the new materials once. */
export const SEED_VERSION = 3
/** Number of seeds shipped in v1 (the rest were added in v2). */
const V1_COUNT = 78

const SEEDS: Seed[] = [
  // ---- original library (v1) ----
  ['Bergamot oil', '8007-75-8', 'citrus', 'top', 100, 'natural', 'Fresh, sparkling, slightly floral citrus'],
  ['Lemon oil', '8008-56-8', 'citrus', 'top', 100, 'natural', 'Bright, zesty, juicy'],
  ['Sweet orange oil', '8008-57-9', 'citrus', 'top', 100, 'natural', 'Sweet, juicy peel'],
  ['Grapefruit oil', '8016-20-4', 'citrus', 'top', 100, 'natural', 'Bitter-fresh, sulfurous facet'],
  ['Mandarin oil', '8008-31-9', 'citrus', 'top', 100, 'natural', 'Sweet, tangerine-like, soft'],
  ['Lime oil distilled', '8008-26-2', 'citrus', 'top', 100, 'natural', 'Sharp, terpenic, cola-like'],
  ['Citral', '5392-40-5', 'citrus', 'top', 10, 'synthetic', 'Intense lemon peel'],
  ['Dihydromyrcenol', '18479-58-8', 'citrus', 'top', 100, 'synthetic', 'Fresh metallic lime, clean'],
  ['Linalool', '78-70-6', 'floral', 'top', 100, 'synthetic', 'Fresh floral-woody, lavender/bois de rose'],
  ['Linalyl acetate', '115-95-7', 'aromatic', 'top', 100, 'synthetic', 'Bergamot-lavender, fruity-fresh'],
  ['Aldehyde C-10 (decanal)', '112-31-2', 'aldehydic', 'top', 10, 'synthetic', 'Waxy orange peel'],
  ['Aldehyde C-11 undecylenic', '112-45-8', 'aldehydic', 'top', 10, 'synthetic', 'Waxy, clean, ozonic'],
  ['Aldehyde C-12 MNA', '110-41-8', 'aldehydic', 'top', 10, 'synthetic', 'Ambergris-like, incense, waxy'],
  ['cis-3-Hexenol', '928-96-1', 'green', 'top', 10, 'synthetic', 'Freshly cut grass'],
  ['Galbanum oil', '8023-91-4', 'green', 'top', 10, 'natural', 'Sharp, bitter green, pea-pod'],
  ['Triplal (Ligustral)', '68039-49-6', 'green', 'top', 10, 'synthetic', 'Powerful green, leafy'],
  ['Lavender oil', '8000-28-0', 'aromatic', 'top', 100, 'natural', 'Herbaceous, floral, camphoraceous'],
  ['Rosemary oil', '8000-25-7', 'herbal', 'top', 100, 'natural', 'Camphoraceous, herbal'],
  ['Peppermint oil', '8006-90-4', 'herbal', 'top', 10, 'natural', 'Cooling, minty'],
  ['Eucalyptus oil', '8000-48-4', 'herbal', 'top', 100, 'natural', 'Cineolic, fresh, medicinal'],
  ['Pink pepper oil', '68917-52-2', 'spicy', 'top', 100, 'natural', 'Rosy, peppery, sparkling'],
  ['Black pepper oil', '8006-82-4', 'spicy', 'top', 100, 'natural', 'Dry, warm-spicy, woody'],
  ['Cardamom oil', '8000-66-6', 'spicy', 'top', 100, 'natural', 'Fresh-spicy, eucalyptol facet'],
  ['Calone', '28940-11-6', 'aquatic', 'top', 1, 'synthetic', 'Marine, watermelon, ozonic'],
  ['Ethyl 2-methylbutyrate', '7452-79-1', 'fruity', 'top', 10, 'synthetic', 'Green apple, fruity'],
  ['Allyl amyl glycolate', '67634-00-8', 'fruity', 'top', 10, 'synthetic', 'Pineapple, galbanum-green'],
  ['Hedione', '24851-98-7', 'floral', 'heart', 100, 'synthetic', 'Transparent jasmine, radiant'],
  ['Phenylethyl alcohol', '60-12-8', 'floral', 'heart', 100, 'synthetic', 'Rose, honeyed'],
  ['Geraniol', '106-24-1', 'floral', 'heart', 100, 'synthetic', 'Rosy, sweet, citrusy'],
  ['Citronellol', '106-22-9', 'floral', 'heart', 100, 'synthetic', 'Fresh rose, citronella'],
  ['Rose oil (Bulgarian)', '8007-01-0', 'floral', 'heart', 10, 'natural', 'Deep, honeyed rose'],
  ['Jasmine absolute', '8022-96-6', 'floral', 'heart', 10, 'natural', 'Rich, indolic, fruity jasmine'],
  ['Ylang-ylang oil', '8006-81-3', 'floral', 'heart', 100, 'natural', 'Creamy, banana, spicy floral'],
  ['Geranium oil', '8000-46-2', 'floral', 'heart', 100, 'natural', 'Rosy-minty, green'],
  ['Benzyl acetate', '140-11-4', 'floral', 'heart', 100, 'synthetic', 'Fruity jasmine, pear'],
  ['Indole', '120-72-9', 'floral', 'heart', 1, 'synthetic', 'Animalic, mothball, white floral'],
  ['Hydroxycitronellal', '107-75-5', 'floral', 'heart', 100, 'synthetic', 'Lily-of-the-valley, linden'],
  ['Helional', '1205-17-0', 'aquatic', 'heart', 10, 'synthetic', 'Ozonic, marine, cyclamen'],
  ['Clary sage oil', '8016-63-5', 'herbal', 'heart', 100, 'natural', 'Herbal, tea-like, ambery'],
  ['alpha-Ionone', '127-41-3', 'powdery', 'heart', 10, 'synthetic', 'Violet, woody, raspberry'],
  ['Methyl ionone gamma', '127-51-5', 'powdery', 'heart', 100, 'synthetic', 'Orris, violet, powdery'],
  ['Irone alpha', '79-69-6', 'powdery', 'heart', 1, 'synthetic', 'Orris butter, buttery violet root'],
  ['Heliotropin', '120-57-0', 'powdery', 'heart', 10, 'synthetic', 'Almond, cherry-blossom, powdery'],
  ['Eugenol', '97-53-0', 'spicy', 'heart', 10, 'synthetic', 'Clove, spicy'],
  ['Clove bud oil', '8000-34-8', 'spicy', 'heart', 10, 'natural', 'Clove, warm-spicy'],
  ['Cinnamon bark oil', '8015-91-6', 'spicy', 'heart', 1, 'natural', 'Hot, sweet cinnamon'],
  ['Nutmeg oil', '8008-45-5', 'spicy', 'heart', 100, 'natural', 'Spicy, terpenic, nutty'],
  ['beta-Damascone', '35044-68-9', 'fruity', 'heart', 0.1, 'synthetic', 'Plum, rose, tobacco'],
  ['gamma-Decalactone', '706-14-9', 'fruity', 'heart', 10, 'synthetic', 'Creamy peach'],
  ['Frambinone', '5471-51-2', 'fruity', 'heart', 10, 'synthetic', 'Raspberry, jammy'],
  ['Iso E Super', '54464-57-2', 'woody', 'heart', 100, 'synthetic', 'Velvety cedar-amber, radiant'],
  ['Isobutyl quinoline', '65442-31-1', 'leather', 'heart', 1, 'synthetic', 'Leather, earthy, green-bitter'],
  ['Ambroxan', '6790-58-5', 'amber', 'base', 10, 'synthetic', 'Ambergris, mineral, woody'],
  ['Benzoin resinoid Siam', '9000-72-0', 'amber', 'base', 50, 'natural', 'Vanillic, balsamic'],
  ['Labdanum absolute', '', 'amber', 'base', 10, 'natural', 'Leathery, resinous amber'],
  ['Myrrh oil', '8016-37-3', 'amber', 'base', 100, 'natural', 'Bitter, resinous, mushroomy'],
  ['Olibanum oil', '8016-36-2', 'amber', 'base', 100, 'natural', 'Incense, lemony, resinous'],
  ['Vanillin', '121-33-5', 'gourmand', 'base', 10, 'synthetic', 'Sweet vanilla'],
  ['Ethyl vanillin', '121-32-4', 'gourmand', 'base', 10, 'synthetic', 'Intense creamy vanilla'],
  ['Ethyl maltol', '4940-11-8', 'gourmand', 'base', 1, 'synthetic', 'Cotton candy, caramel'],
  ['Coumarin', '91-64-5', 'gourmand', 'base', 10, 'synthetic', 'Hay, tonka, almond'],
  ['Tonka bean absolute', '8046-22-8', 'gourmand', 'base', 10, 'natural', 'Coumarinic, tobacco, sweet'],
  ['Sandalore', '65113-99-7', 'woody', 'base', 100, 'synthetic', 'Creamy sandalwood'],
  ['Javanol', '198404-98-7', 'woody', 'base', 1, 'synthetic', 'Rosy, milky sandalwood'],
  ['Cedarwood Virginia oil', '8000-27-9', 'woody', 'base', 100, 'natural', 'Dry, pencil shavings'],
  ['Vetiver oil', '8016-96-4', 'woody', 'base', 100, 'natural', 'Earthy, smoky, rooty'],
  ['Patchouli oil', '8014-09-3', 'woody', 'base', 100, 'natural', 'Earthy, camphor, chocolate'],
  ['Guaiacwood oil', '8016-23-7', 'woody', 'base', 100, 'natural', 'Smoky, rosy wood'],
  ['Oakmoss absolute', '9000-50-4', 'mossy', 'base', 10, 'natural', 'Mossy, inky, forest floor'],
  ['Evernyl', '4707-47-5', 'mossy', 'base', 10, 'synthetic', 'Oakmoss-like, dry'],
  ['Birch tar oil (rectified)', '8001-88-5', 'leather', 'base', 1, 'natural', 'Smoky leather, tarry'],
  ['Cashmeran', '33704-61-9', 'musk', 'base', 100, 'synthetic', 'Musky, woody, velvety'],
  ['Galaxolide', '1222-05-5', 'musk', 'base', 50, 'synthetic', 'Usually sold ~50% in IPM/DEP/BB; clean, sweet musk'],
  ['Habanolide', '111879-80-2', 'musk', 'base', 100, 'synthetic', 'Metallic, ironed linen musk'],
  ['Ethylene brassylate', '105-95-3', 'musk', 'base', 100, 'synthetic', 'Sweet, powdery musk'],
  ['Exaltolide', '106-02-5', 'musk', 'base', 10, 'synthetic', 'Fine, animalic musk'],
  ['Helvetolide', '141773-73-1', 'musk', 'base', 100, 'synthetic', 'Fruity pear musk'],
  ['Benzyl salicylate', '118-58-1', 'floral', 'base', 100, 'synthetic', 'Faint balsamic floral, fixative'],

  // ---- added in seed v2 ----
  ['Aldehyde C-6 (hexanal)', '66-25-1', 'green', 'top', 1, 'synthetic', 'Green, grassy, unripe apple. Very volatile'],
  ['Aldehyde C-7 (heptanal)', '111-71-7', 'aldehydic', 'top', 1, 'synthetic', 'Fatty-green, oily, slightly fruity'],
  ['Aldehyde C-8 (octanal)', '124-13-0', 'aldehydic', 'top', 10, 'synthetic', 'Waxy, fatty orange peel'],
  ['Aldehyde C-9 (nonanal)', '124-19-6', 'aldehydic', 'top', 10, 'synthetic', 'Waxy, rosy-citrus, fatty'],
  ['Aldehyde C-11 undecylic (undecanal)', '112-44-7', 'aldehydic', 'top', 10, 'synthetic', 'Waxy, soapy, citrus-floral; saturated twin of C-11 undecylenic'],
  ['Aldehyde C-12 lauric (dodecanal)', '112-54-9', 'aldehydic', 'top', 10, 'synthetic', 'Waxy, soapy, clean linen, violet-like'],
  ['Aldehyde C-13 (tridecanal)', '10486-19-8', 'aldehydic', 'top', 10, 'synthetic', 'Waxy, citrus peel, slightly fatty'],
  ['trans-2-Hexenal (leaf aldehyde)', '6728-26-3', 'green', 'top', 1, 'synthetic', 'Sharp green leaf, unripe apple'],
  ['cis-4-Decenal', '21662-09-9', 'aldehydic', 'top', 1, 'synthetic', 'Fresh orange peel, waxy, green; very powerful'],
  ['trans-2-Decenal', '3913-81-3', 'aldehydic', 'top', 1, 'synthetic', 'Waxy, fatty, coriander leaf, orange'],
  ['2-Tridecenal', '7774-82-5', 'aldehydic', 'top', 1, 'synthetic', 'Waxy citrus peel, cilantro-like; usually mostly trans'],
  ['Nonadienal (violet leaf aldehyde)', '557-48-2', 'green', 'top', 0.1, 'synthetic', 'trans,cis-2,6-Nonadienal: cucumber, violet leaf; extremely powerful'],
  ['Adoxal', '141-13-9', 'aldehydic', 'heart', 10, 'synthetic', '2,6,10-Trimethylundec-9-enal: aldehydic, waxy, floral, marine-fresh'],
  ['Aldehyde C-14 "peach" (γ-undecalactone)', '104-67-6', 'fruity', 'heart', 10, 'synthetic', 'Creamy peach skin. Historic trade name — a lactone, not an aldehyde'],
  ['Aldehyde C-16 "strawberry" (ethyl methylphenylglycidate)', '77-83-8', 'fruity', 'heart', 10, 'synthetic', 'Sweet jammy strawberry. Historic trade name — a glycidic ester, not an aldehyde'],
  ['Aldehyde C-18 "coconut" (γ-nonalactone)', '104-61-0', 'gourmand', 'heart', 10, 'synthetic', 'Coconut, creamy, milky. Historic trade name — a lactone, not an aldehyde'],
  ['Citronellal', '106-23-0', 'citrus', 'top', 100, 'synthetic', 'Fresh citronella, lemony-green'],
  ['Melonal', '106-72-9', 'fruity', 'top', 10, 'synthetic', '2,6-Dimethyl-5-heptenal: melon, cucumber, green'],
  ['Cyclamen aldehyde', '103-95-7', 'floral', 'heart', 10, 'synthetic', 'Floral, cyclamen, lily of the valley, green'],
  ['Bourgeonal', '18127-01-0', 'floral', 'heart', 1, 'synthetic', 'Watery green muguet, aldehydic; powerful'],
  ['Floralozone', '67634-15-5', 'aquatic', 'heart', 10, 'synthetic', 'Ozonic, fresh air, sea breeze. Trade grade is a para/ortho/meta isomer mix'],
  ['Hexyl cinnamic aldehyde', '101-86-0', 'floral', 'heart', 100, 'synthetic', 'Soft jasmine, waxy, slightly herbal'],
  ['Amyl cinnamic aldehyde', '122-40-7', 'floral', 'heart', 100, 'synthetic', 'Jasmine, floral-waxy; oxidises — keep stabilised'],
  ['Cinnamaldehyde', '104-55-2', 'spicy', 'heart', 1, 'synthetic', 'Hot, sweet cinnamon bark'],
  ['Anisaldehyde', '123-11-5', 'floral', 'heart', 10, 'synthetic', 'p-Anisaldehyde: hawthorn, sweet anise, mimosa'],
  ['Benzaldehyde', '100-52-7', 'gourmand', 'top', 1, 'synthetic', 'Bitter almond, cherry-pit'],
  ['Phenylacetaldehyde', '122-78-1', 'floral', 'top', 1, 'synthetic', 'Green hyacinth, honeyed; very powerful'],
  ['Cuminaldehyde', '122-03-2', 'spicy', 'top', 1, 'synthetic', 'Cumin seed, warm, sweaty-spicy'],
  ['cis-3-Hexenyl salicylate', '65405-77-8', 'green', 'heart', 100, 'synthetic', 'Green-floral, balsamic, leafy salicylate'],
  ['Hexyl salicylate', '6259-76-3', 'floral', 'base', 100, 'synthetic', 'Soft floral, green, slightly powdery-waxy; blender'],
  ['Amyl salicylate', '2050-08-0', 'floral', 'heart', 100, 'synthetic', 'Herbaceous floral, clover, orchid; often an isomer mix'],
  ['Isobutyl salicylate', '87-19-4', 'floral', 'heart', 100, 'synthetic', 'Clover, orchid, hay-like fresh floral'],
  ['Phenylethyl salicylate', '87-22-9', 'floral', 'base', 100, 'synthetic', 'Balsamic floral: rose, hyacinth, carnation. Crystalline, melts ≈ 40 °C'],
  ['Cyclohexyl salicylate', '25485-88-5', 'floral', 'base', 100, 'synthetic', 'White flowers, green, carnation-like, balsamic'],
  ['Methyl salicylate', '119-36-8', 'herbal', 'top', 10, 'synthetic', 'Wintergreen, sweet-medicinal'],
  ['Ethyl salicylate', '118-61-6', 'herbal', 'top', 10, 'synthetic', 'Wintergreen-like, sweet, softer than methyl'],
  ['cis-3-Hexenyl acetate', '3681-71-8', 'green', 'top', 10, 'synthetic', 'Sharp green, unripe banana and pear'],
  ['cis-3-Hexenyl butyrate', '16491-36-4', 'green', 'top', 10, 'synthetic', 'Green, fruity, slightly buttery'],
  ['cis-3-Hexenyl isobutyrate', '41519-23-7', 'green', 'top', 10, 'synthetic', 'Green, fruity, apple-like'],
  ['cis-3-Hexenyl tiglate', '67883-79-8', 'green', 'heart', 10, 'synthetic', 'Green, earthy, fruity'],
  ['cis-3-Hexenyl benzoate', '25152-85-6', 'green', 'heart', 100, 'synthetic', 'Green, balsamic, floral; long-lasting green'],
  ['Liffarome', '67633-96-9', 'green', 'top', 10, 'synthetic', 'cis-3-Hexenyl methyl carbonate (IFF): fresh green leaf, pear, violet leaf'],
  ['Hedione HC', '24851-98-7', 'floral', 'heart', 100, 'synthetic', 'High-cis methyl dihydrojasmonate (Firmenich): stronger, more radiant than standard Hedione'],
  ['Florol', '63500-71-0', 'floral', 'heart', 100, 'synthetic', 'Pyranol (Florosa): fresh, clean muguet, soft floral'],
  ['Verdox HC', '88-41-5', 'fruity', 'top', 100, 'synthetic', '2-tert-Butylcyclohexyl acetate, high cis (IFF): fruity, woody, green apple'],
  ['Lime oil expressed', '8008-26-2', 'citrus', 'top', 100, 'natural', 'Cold-pressed lime peel: juicy, green, true peel. Phototoxic (furocoumarins) — check IFRA. CAS often shared with distilled lime; EU also uses 90063-52-8'],
  ['Tonalide', '21145-77-7', 'musk', 'base', 10, 'synthetic', 'Polycyclic musk (AHTN): sweet, powdery, slightly woody. Also listed as 1506-02-1. Solid'],
  ['Celestolide', '13171-00-1', 'musk', 'base', 10, 'synthetic', 'Polycyclic musk (ADBI): musky, woody, amber. Solid'],
  ['Phantolide', '15323-35-0', 'musk', 'base', 10, 'synthetic', 'Polycyclic musk (AHMI): musky, powdery, slightly woody'],
  ['Traseolide', '68140-48-7', 'musk', 'base', 100, 'synthetic', 'Polycyclic musk (ATII): musky, woody; viscous liquid'],
  ['Muscone', '541-91-3', 'musk', 'base', 10, 'synthetic', '3-Methylcyclopentadecanone, key odorant of natural deer musk: warm, rich, animalic'],
  ['Exaltone (cyclopentadecanone)', '502-72-7', 'musk', 'base', 10, 'synthetic', 'Macrocyclic ketone: fine, powdery, animalic musk. Solid'],
  ['Civetone', '542-46-1', 'musk', 'base', 1, 'synthetic', 'Macrocyclic ketone of civet: strongly animalic, musky'],
  ['Muscenone delta', '82356-51-2', 'musk', 'base', 10, 'synthetic', 'Macrocyclic ketone (Firmenich): rich, powdery, nitro-musk-like'],
  ['Velvione', '37609-25-9', 'musk', 'base', 100, 'synthetic', '5-Cyclohexadecen-1-one (Givaudan; = Ambretone): powdery, velvety musk'],
  ['Globanone', '3100-36-5', 'musk', 'base', 100, 'synthetic', 'Cyclohexadec-8-en-1-one (Symrise): musky, powdery, slightly animalic'],
  ['Cosmone', '259854-70-1', 'musk', 'base', 100, 'synthetic', '3-Methylcyclotetradec-5-en-1-one (Givaudan): warm, powdery musk'],
  ['Ambrettolide', '28645-51-4', 'musk', 'base', 100, 'synthetic', 'Macrocyclic lactone (also in ambrette seed): fine, fruity-musky, sweet'],
  ['Cervolide', '6707-60-4', 'musk', 'base', 100, 'synthetic', '12-Oxahexadecanolide (Musk 781, Hibiscolide): clean, powdery musk'],
  ['Romandolide', '236391-76-7', 'musk', 'base', 100, 'synthetic', 'Alicyclic musk (Firmenich): soft, clean, powdery, slightly soapy-fruity'],
  ['Musk ketone', '81-14-1', 'musk', 'base', 10, 'synthetic', 'Nitro musk: sweet, powdery, animalic. IFRA: must contain < 0.1% musk xylene — check the current standard. Solid'],
  ['Ambrette seed oil', '8015-62-1', 'musk', 'base', 100, 'natural', 'Abelmoschus moschatus: musky, fruity-pear, wine-like; contains ambrettolide and farnesol'],
  ['Agarwood (oud) oil', '94350-09-1', 'woody', 'base', 10, 'natural', 'Aquilaria resinous heartwood: woody, animalic, leathery, balsamic. Aquilaria is CITES-listed'],
  ['Cypriol oil (nagarmotha)', '68916-60-9', 'woody', 'base', 100, 'natural', 'Cyperus scariosus root: earthy, smoky, woody-leathery, vetiver-like. Also listed as 91771-62-9'],
  ['Tobacco absolute', '8037-19-2', 'amber', 'base', 10, 'natural', 'Nicotiana tabacum: hay, dried fruit, honeyed tobacco. EU CAS 84961-66-0'],
  ['Coffee absolute', '', 'gourmand', 'base', 10, 'natural', 'Roasted coffee, bitter, dark. CAS differs between absolute and CO2 extract — check supplier'],
  ['Styrax resinoid', '8046-19-3', 'amber', 'base', 50, 'natural', 'Liquidambar balsam: balsamic, leathery-smoky, cinnamic, styrene facet. Check IFRA grade requirements'],
  ['Cade oil rectified', '90046-02-9', 'leather', 'base', 1, 'natural', 'Juniperus oxycedrus tar: smoky, phenolic, birch-tar-like. IFRA allows only rectified (PAH-limited) grades. Also 8013-10-3'],
  ['Elemi oil', '8023-89-0', 'amber', 'top', 100, 'natural', 'Canarium luzonicum resin: fresh lemony-peppery, resinous; mostly limonene, elemol'],
  ['Cannabis flower oil', '89958-21-4', 'herbal', 'heart', 100, 'natural', 'Hemp flower/leaf essential oil: herbaceous, green, earthy. Not hempseed oil (8016-24-8)'],
  ['Norlimbanol', '70788-30-6', 'woody', 'base', 10, 'synthetic', 'Firmenich: extremely powerful dry woody-amber, animalic'],
  ['Vertofix', '32388-55-9', 'woody', 'base', 100, 'synthetic', 'Methyl cedryl ketone / acetyl cedrene: dry cedar, woody-amber, slightly leathery'],
  ['Ambrocenide', '211299-54-6', 'amber', 'base', 1, 'synthetic', 'Symrise: extremely powerful, long-lasting woody amber. Crystalline'],
]

function toMaterial([name, cas, family, note, defaultDilution, type, description]: Seed, now: string): Material {
  return {
    id: uid(),
    name,
    cas: cas || undefined,
    family,
    note,
    tenacityHours: null,
    defaultDilution,
    solvent: defaultDilution < 100 ? 'EtOH' : undefined,
    pricePerKg: null,
    supplier: '',
    ifraLimit: null,
    description,
    type,
    createdAt: now,
    updatedAt: now
  }
}

export function seedMaterials(): Material[] {
  const now = new Date().toISOString()
  return SEEDS.map((s) => toMaterial(s, now))
}

// Values shipped by seed v1 — corrected in v2 only where the user never changed them.
const V1_WRONG_CAS: Record<string, [wrong: string, right: string]> = {"Galbanum oil": ["8023-91-6", "8023-91-4"], "Clary sage oil": ["8016-63-9", "8016-63-5"], "beta-Damascone": ["23726-91-2", "35044-68-9"]}
const V1_TENACITY: Record<string, number> = {"Bergamot oil": 2.0, "Lemon oil": 1.0, "Sweet orange oil": 1.0, "Grapefruit oil": 1.0, "Mandarin oil": 2.0, "Lime oil distilled": 1.0, "Citral": 3.0, "Dihydromyrcenol": 6.0, "Linalool": 4.0, "Linalyl acetate": 4.0, "Aldehyde C-10 (decanal)": 8.0, "Aldehyde C-11 undecylenic": 12.0, "Aldehyde C-12 MNA": 24.0, "cis-3-Hexenol": 1.0, "Galbanum oil": 12.0, "Triplal (Ligustral)": 6.0, "Lavender oil": 6.0, "Rosemary oil": 3.0, "Peppermint oil": 3.0, "Eucalyptus oil": 2.0, "Pink pepper oil": 4.0, "Black pepper oil": 6.0, "Cardamom oil": 6.0, "Calone": 48.0, "Ethyl 2-methylbutyrate": 1.0, "Allyl amyl glycolate": 12.0, "Hedione": 100.0, "Phenylethyl alcohol": 24.0, "Geraniol": 24.0, "Citronellol": 24.0, "Rose oil (Bulgarian)": 48.0, "Jasmine absolute": 60.0, "Ylang-ylang oil": 48.0, "Geranium oil": 24.0, "Benzyl acetate": 6.0, "Indole": 200.0, "Hydroxycitronellal": 100.0, "Helional": 48.0, "Clary sage oil": 24.0, "alpha-Ionone": 80.0, "Methyl ionone gamma": 150.0, "Irone alpha": 200.0, "Heliotropin": 200.0, "Eugenol": 60.0, "Clove bud oil": 60.0, "Cinnamon bark oil": 48.0, "Nutmeg oil": 12.0, "beta-Damascone": 150.0, "gamma-Decalactone": 100.0, "Frambinone": 300.0, "Iso E Super": 300.0, "Isobutyl quinoline": 300.0, "Ambroxan": 400.0, "Benzoin resinoid Siam": 400.0, "Labdanum absolute": 400.0, "Myrrh oil": 200.0, "Olibanum oil": 48.0, "Vanillin": 400.0, "Ethyl vanillin": 400.0, "Ethyl maltol": 300.0, "Coumarin": 300.0, "Tonka bean absolute": 400.0, "Sandalore": 400.0, "Javanol": 400.0, "Cedarwood Virginia oil": 200.0, "Vetiver oil": 400.0, "Patchouli oil": 400.0, "Guaiacwood oil": 300.0, "Oakmoss absolute": 400.0, "Evernyl": 400.0, "Birch tar oil (rectified)": 400.0, "Cashmeran": 300.0, "Galaxolide": 400.0, "Habanolide": 400.0, "Ethylene brassylate": 400.0, "Exaltolide": 400.0, "Helvetolide": 400.0, "Benzyl salicylate": 400.0}

/**
 * Upgrade an existing library to the current seed version: add the materials introduced since v1
 * that are missing (matched by name, case-insensitive), fix CAS numbers that were wrong in v1, and clear the
 * unverified v1 tenacity estimates — but never touch values the user has edited.
 */
export function upgradeSeedLibrary(materials: Material[], fromVersion: number): Material[] {
  if (fromVersion >= SEED_VERSION) return materials
  const now = new Date().toISOString()
  const fixed = fromVersion >= 2 ? materials : materials.map((m) => {
    let next = m
    const cas = V1_WRONG_CAS[m.name]
    if (cas && m.cas === cas[0]) next = { ...next, cas: cas[1] }
    const t = V1_TENACITY[m.name]
    if (t != null && m.tenacityHours === t) next = { ...next, tenacityHours: null }
    return next === m ? m : { ...next, updatedAt: now }
  })
  // v3: default dilution solvent is ethanol (was DPG) — only for starter materials still on DPG.
  const seedNames = new Set(SEEDS.map((x) => x[0]))
  const solventFixed = fromVersion < 3 ? fixed.map((m) => (seedNames.has(m.name) && m.solvent === 'DPG' ? { ...m, solvent: 'EtOH', updatedAt: now } : m)) : fixed
  if (fromVersion >= 2) return solventFixed
  const have = new Set(solventFixed.map((m) => m.name.trim().toLowerCase()))
  const added = SEEDS.slice(V1_COUNT).filter((s) => !have.has(s[0].toLowerCase())).map((s) => toMaterial(s, now))
  return [...solventFixed, ...added]
}
