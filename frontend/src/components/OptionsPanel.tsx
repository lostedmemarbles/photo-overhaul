import type { DateGranularity, ProcessingOptions } from '../lib/types'

const DATE_GRANULARITY_OPTIONS: Array<{ value: DateGranularity; label: string; example: string }> = [
  { value: 'year', label: 'Year', example: '2023/' },
  { value: 'month', label: 'Month', example: '2023/2023-07/' },
  { value: 'day', label: 'Day', example: '2023/2023-07/2023-07-04/' },
]

interface Field {
  key: keyof Pick<
    ProcessingOptions,
    'sortByDate' | 'checkDuplicates' | 'convertHeic' | 'squarify' | 'reduceQuality'
  >
  label: string
  hint: string
}

const FIELDS: Field[] = [
  {
    key: 'sortByDate',
    label: 'Organize by date',
    hint: 'Group the zip download into date folders based on when each photo was taken (or its file date, if no EXIF date is found). Folder depth is chosen below.',
  },
  {
    key: 'checkDuplicates',
    label: 'Check for duplicates',
    hint: 'Flags likely duplicates (identical file content) in a panel for review before downloading. Checking this also checks any photos already added.',
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
  onProcess,
  canProcess,
  isProcessing,
}: {
  options: ProcessingOptions
  onChange: (options: ProcessingOptions) => void
  onProcess: () => void
  canProcess: boolean
  isProcessing: boolean
}) {
  return (
    <fieldset style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem 1rem' }}>
      <legend style={{ padding: '0 0.5rem', fontSize: '0.85rem', color: '#444' }}>Options</legend>
      {FIELDS.map(({ key, label, hint }) => (
        <div key={key}>
          <label
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

          {key === 'sortByDate' && options.sortByDate && (
            <div style={{ marginLeft: '1.6rem', marginBottom: '0.35rem' }}>
              {DATE_GRANULARITY_OPTIONS.map(({ value, label, example }) => (
                <label
                  key={value}
                  title={`Folders will look like ${example}filename.jpg`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  <input
                    type="radio"
                    name="dateGranularity"
                    checked={options.dateGranularity === value}
                    onChange={() => onChange({ ...options, dateGranularity: value })}
                  />
                  {label}
                  <span style={{ color: '#888', fontSize: '0.8rem' }}>({example})</span>
                </label>
              ))}
            </div>
          )}

          {key === 'checkDuplicates' && options.checkDuplicates && (
            <label
              title="Keeps only the first copy of each duplicate found and excludes the rest from the download automatically - no manual review needed, so preview thumbnails aren't generated at all, which is faster for large batches."
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginLeft: '1.6rem',
                marginBottom: '0.35rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={options.autoRemoveDuplicates}
                onChange={(e) => onChange({ ...options, autoRemoveDuplicates: e.target.checked })}
              />
              Automatically remove duplicates
            </label>
          )}

          {key === 'reduceQuality' && options.reduceQuality && (
            <label
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: '1.6rem', marginBottom: '0.35rem' }}
            >
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
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.6rem' }}>
        <button onClick={onProcess} disabled={!canProcess || isProcessing} title="Apply these settings to any photos you've already added">
          {isProcessing ? 'Processing…' : 'Process'}
        </button>
        <p style={{ fontSize: '0.75rem', color: '#888', margin: 0 }}>
          New uploads always use the current settings. Click Process to apply changes to photos already added.
        </p>
      </div>
    </fieldset>
  )
}
