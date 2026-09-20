import type { ProcessingOptions } from '../lib/types'

interface Field {
  key: keyof ProcessingOptions
  label: string
  hint: string
}

const FIELDS: Field[] = [
  {
    key: 'sortByDate',
    label: 'Organize by date',
    hint: 'Group the gallery and zip download into year/date folders based on when each photo was taken (or its file date, if no EXIF date is found).',
  },
  {
    key: 'convertHeic',
    label: 'Convert HEIC to JPEG',
    hint: "iPhone photos are often HEIC, which many apps and tools can't open directly. Leave unchecked to keep them as-is.",
  },
  {
    key: 'squarify',
    label: 'Pad to square (1:1)',
    hint: 'Adds black borders so every photo becomes a square. Always re-encodes to JPEG, even for HEIC photos, since padding requires redrawing the image.',
  },
]

export function OptionsPanel({
  options,
  onChange,
}: {
  options: ProcessingOptions
  onChange: (options: ProcessingOptions) => void
}) {
  return (
    <fieldset style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem 1rem' }}>
      <legend style={{ padding: '0 0.5rem', fontSize: '0.85rem', color: '#444' }}>Options</legend>
      {FIELDS.map(({ key, label, hint }) => (
        <label
          key={key}
          title={hint}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={options[key]}
            onChange={(e) => onChange({ ...options, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
      <p style={{ fontSize: '0.75rem', color: '#888', margin: '0.5rem 0 0' }}>
        Applies to newly dropped photos - already-processed ones aren't reprocessed if you change these.
      </p>
    </fieldset>
  )
}
