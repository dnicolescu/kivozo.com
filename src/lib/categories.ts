export const CATEGORIES = {
  games: { label: 'Games', emoji: '🎮', blurb: 'Small browser games and toys.' },
  tools: { label: 'Tools', emoji: '🛠️', blurb: 'Handy utilities and helpers.' },
  dictionaries: { label: 'Dictionaries', emoji: '📚', blurb: 'Word lists, glossaries, lookups.' },
  utilities: { label: 'Utilities', emoji: '🔧', blurb: 'Practical converters and gadgets.' },
  experiments: { label: 'Experiments', emoji: '🧪', blurb: 'Prototypes and demos.' },
  random: { label: 'Random', emoji: '🎲', blurb: 'Everything else.' },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];
