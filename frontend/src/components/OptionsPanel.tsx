import type { ProcessingOptions } from '../lib/types'

interface Field {
  key: keyof Pick<ProcessingOptions, 'sortByDate' | 'convertHeic' | 'squarify' | 'reduceQuality'>
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
  {
    key: 'reduceQuality',
    label: 'Reduce quality to save space',
    hint: 'Re-compresses photos at the quality level below to shrink file size. 100% leaves photos exactly as uploaded - below that only ever makes a file smaller, never bigger.',
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

      {options.reduceQuality && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: '1.6rem', marginBottom: '0.35rem' }}>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={options.qualityPercent}
            onChange={(e) => onChange({ ...options, qualityPercent: Number(e.target.value) })}
            style={{ width: 160 }}
          />
          <span style={{ fontSize: '0.85rem', color: '#444', minWidth: '7em' }}>
            {options.qualityPercent}% {options.qualityPercent >= 100 && '(original)'}
          </span>
        </label>
      )}

      <p style={{ fontSize: '0.75rem', color: '#888', margin: '0.5rem 0 0' }}>
        Changing these re-processes any photos you've already added, not just new ones.
      </p>
    </fieldset>
  )
}
