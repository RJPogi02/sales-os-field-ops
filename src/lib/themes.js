import { Gem, Heart, Moon, Snowflake, Sparkles, Sun, Waves } from 'lucide-react'

/**
 * The canonical theme catalogue used by both the workspace and Call Mode.
 * Keep identifiers stable because they are persisted in localStorage.
 */
export const themes = [
  { id: 'field', label: 'Light', description: 'Clear editorial field cockpit', Icon: Sun, tone: 'light', swatch: ['#f6f1e5', '#d54d16', '#567a48'] },
  { id: 'midnight', label: 'Dark', description: 'Dark focused operations', Icon: Moon, tone: 'dark', swatch: ['#171714', '#d54d16', '#eee8dc'] },
  { id: 'glass', label: 'Liquid Glass', description: 'Glossy, reflective spatial glass', Icon: Sparkles, tone: 'light', swatch: ['#eaf5ff', '#087cf0', '#a97fff'] },
  { id: 'frosted', label: 'Frosted Glass', description: 'Soft OS-style diffused glass', Icon: Snowflake, tone: 'light', swatch: ['#e8eff5', '#3478c8', '#ffffff'] },
  { id: 'aurora', label: 'Aurora Glass Ops', description: 'Calm dark glass with cyan-violet signal light', Icon: Waves, tone: 'dark', swatch: ['#071222', '#25d6df', '#a56cff'] },
  { id: 'rose', label: 'Rose Quartz', description: 'Warm blush glass with polished berry accents', Icon: Heart, tone: 'light', swatch: ['#fff2f7', '#c42e69', '#d9a9e9'] },
  { id: 'orchid', label: 'Velvet Orchid', description: 'Deep plum glass with luminous lilac focus', Icon: Gem, tone: 'dark', swatch: ['#160c20', '#c67af4', '#df4f9a'] },
]

export const callThemeOptions = [
  { id: 'inherit', label: 'Match workspace' },
  ...themes.map(({ id, label }) => ({ id, label })),
]

export const themeIds = themes.map(({ id }) => id)

export function isThemeId(value) {
  return themeIds.includes(value)
}
