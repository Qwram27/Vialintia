/**
 * Olfactive notes for the formula's note pyramid (marketing notes, like on a
 * fragrance's product page — not raw materials). Users can add their own names.
 */
export interface NoteCategory {
  id: string
  code: string
  name: string
  notes: string[]
}

export const NOTE_CATEGORIES: NoteCategory[] = [
  {
    id: 'citrus', code: 'CI', name: 'Citrus',
    notes: ['Bergamot', 'Lemon', 'Lime', 'Kaffir Lime', 'Yuzu', 'Grapefruit', 'Pink Grapefruit', 'Bitter Orange', 'Sweet Orange',
      'Blood Orange', 'Mandarin', 'Green Mandarin', 'Tangerine', 'Clementine', 'Citron', 'Pomelo', 'Calamansi', 'Lemon Zest', 'Citrus Notes']
  },
  {
    id: 'fruits', code: 'FR', name: 'Fruits',
    notes: ['Kiwi', 'Green Apple', 'Red Apple', 'Pear', 'Peach', 'White Peach', 'Nectarine', 'Apricot', 'Plum', 'Cherry', 'Black Cherry',
      'Raspberry', 'Strawberry', 'Wild Strawberry', 'Blackcurrant', 'Blackberry', 'Blueberry', 'Red Berries', 'Fig', 'Coconut', 'Pineapple',
      'Mango', 'Passion Fruit', 'Lychee', 'Melon', 'Watermelon', 'Banana', 'Quince', 'Pomegranate', 'Guava', 'Rhubarb', 'Grape',
      'Cranberry', 'Gooseberry', 'Papaya', 'Dragon Fruit', 'Fruity Notes']
  },
  {
    id: 'florals', code: 'FL', name: 'Flowers',
    notes: ['Rose', 'Damask Rose', 'Turkish Rose', 'May Rose', 'Rose Petals', 'Peony', 'Violet', 'Iris', 'Orris Root', 'Lily of the Valley',
      'Lilac', 'Freesia', 'Magnolia', 'Geranium', 'Lotus', 'Water Lily', 'Cyclamen', 'Heliotrope', 'Mimosa', 'Osmanthus', 'Carnation',
      'Hibiscus', 'Cherry Blossom', 'Orchid', 'Wisteria', 'Hyacinth', 'Narcissus', 'Sweet Pea', 'Linden Blossom', 'Apple Blossom',
      'Peach Blossom', 'Lavender Flower', 'Chamomile', 'Elderflower', 'Plumeria', 'Cotton Flower', 'Floral Notes']
  },
  {
    id: 'white', code: 'WF', name: 'White Flowers',
    notes: ['White Flowers', 'Jasmine', 'Jasmine Sambac', 'Tuberose', 'Gardenia', 'Orange Blossom', 'Neroli', 'Ylang-Ylang', 'Frangipani',
      'Tiaré Flower', 'Honeysuckle', 'White Lily', 'Champaca', 'Lily', 'Star Jasmine', 'Datura']
  },
  {
    id: 'green', code: 'GR', name: 'Green & Aromatic',
    notes: ['Green Notes', 'Cut Grass', 'Galbanum', 'Violet Leaf', 'Fig Leaf', 'Tomato Leaf', 'Blackcurrant Bud', 'Bamboo', 'Petitgrain',
      'Basil', 'Mint', 'Peppermint', 'Spearmint', 'Rosemary', 'Lavender', 'Clary Sage', 'Sage', 'Thyme', 'Artemisia', 'Lemongrass',
      'Lemon Verbena', 'Ivy', 'Fern', 'Eucalyptus', 'Shiso', 'Tarragon', 'Juniper Berries', 'Cucumber', 'Green Leaves', 'Rhubarb Leaf',
      'Aromatic Notes']
  },
  {
    id: 'spices', code: 'SP', name: 'Spices',
    notes: ['Pink Pepper', 'Black Pepper', 'Szechuan Pepper', 'Cardamom', 'Cinnamon', 'Clove', 'Nutmeg', 'Ginger', 'Saffron', 'Star Anise',
      'Cumin', 'Coriander', 'Allspice', 'Bay Leaf', 'Caraway', 'Fennel', 'Mace', 'Juniper', 'Spicy Notes']
  },
  {
    id: 'gourmand', code: 'GO', name: 'Sweet & Gourmand',
    notes: ['White Sugar', 'Brown Sugar', 'Caramel', 'Vanilla', 'Bourbon Vanilla', 'Tonka Bean', 'Honey', 'Praline', 'Chocolate', 'White Chocolate',
      'Cocoa', 'Coffee', 'Almond', 'Bitter Almond', 'Pistachio', 'Hazelnut', 'Chestnut', 'Marshmallow', 'Cotton Candy', 'Candy', 'Milk',
      'Cream', 'Whipped Cream', 'Butter', 'Meringue', 'Rice', 'Licorice', 'Maple Syrup', 'Toffee', 'Biscuit', 'Sweet Notes']
  },
  {
    id: 'woods', code: 'WO', name: 'Woods & Mosses',
    notes: ['Sandalwood', 'Cedar', 'Virginia Cedar', 'Atlas Cedar', 'Vetiver', 'Patchouli', 'Oud', 'Guaiac Wood', 'Cashmere Wood', 'Birch',
      'Pine', 'Cypress', 'Fir', 'Oakmoss', 'Moss', 'Driftwood', 'Ebony', 'Teak', 'Papyrus', 'Cypriol', 'Hinoki', 'Rosewood', 'Akigalawood',
      'Blonde Woods', 'Woody Notes']
  },
  {
    id: 'resins', code: 'RE', name: 'Resins & Balsams',
    notes: ['Benzoin', 'Labdanum', 'Myrrh', 'Frankincense', 'Incense', 'Elemi', 'Opoponax', 'Peru Balsam', 'Tolu Balsam', 'Styrax', 'Copal',
      'Balsamic Notes']
  },
  {
    id: 'musk', code: 'MU', name: 'Musk & Amber',
    notes: ['White Musk', 'Musk', 'Skin Musk', 'Clean Musk', 'Ambrette', 'Amber', 'White Amber', 'Ambergris', 'Ambroxan', 'Cashmeran',
      'Iso E Super', 'Castoreum', 'Civet', 'Animalic Notes']
  },
  {
    id: 'leather', code: 'LE', name: 'Leather & Smoke',
    notes: ['Leather', 'Suede', 'Tobacco', 'Tobacco Leaf', 'Smoke', 'Birch Tar', 'Cade', 'Hay', 'Tea Smoke', 'Burnt Wood']
  },
  {
    id: 'fresh', code: 'AB', name: 'Fresh & Abstract',
    notes: ['Snow', 'Ice', 'Ozonic Notes', 'Sea Notes', 'Sea Salt', 'Rain', 'Water Notes', 'Fresh Air', 'Metallic Notes', 'Mineral Notes',
      'Wet Stone', 'Aldehydes', 'Clean Laundry', 'Cotton', 'Soap', 'Powdery Notes', 'Sand', 'Ink', 'Paper', 'Concrete', 'Velvet', 'Silk']
  },
  {
    id: 'drinks', code: 'BE', name: 'Beverages',
    notes: ['Champagne', 'Prosecco', 'Rum', 'Whiskey', 'Cognac', 'Gin', 'Vodka', 'Red Wine', 'Sake', 'Black Tea', 'Earl Grey Tea', 'Green Tea',
      'Matcha', 'Mate', 'Chai']
  }
]

export const OWN_CATEGORY: NoteCategory = { id: 'own', code: 'OW', name: 'Own', notes: [] }

const byName = new Map<string, NoteCategory>()
for (const c of NOTE_CATEGORIES) for (const n of c.notes) if (!byName.has(n.toLowerCase())) byName.set(n.toLowerCase(), c)

export function noteCategory(name: string): NoteCategory {
  return byName.get(name.trim().toLowerCase()) ?? OWN_CATEGORY
}

/** Canonical spelling for a catalogue note, otherwise the trimmed input. */
export function canonicalNote(name: string): string {
  const t = name.trim().replace(/\s+/g, ' ')
  const c = byName.get(t.toLowerCase())
  return c?.notes.find((n) => n.toLowerCase() === t.toLowerCase()) ?? t
}

/** Two-letter element-style symbol: "Kiwi" → Ki, "White Musk" → WM. */
export function noteSymbol(name: string): string {
  const words = name.replace(/\b(notes?|the|of)\b/gi, ' ').split(/[\s\-]+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  const w = words[0] ?? name
  return (w[0] ?? '?').toUpperCase() + (w[1] ?? '').toLowerCase()
}
