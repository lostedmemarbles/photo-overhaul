import type { ProcessedPhoto } from '../lib/types'

interface Props {
  groups: ProcessedPhoto[][]
  onToggleExcluded: (id: string) => void
  onAutoRemove: () => void
}

export function DuplicatesPanel({ groups, onToggleExcluded, onAutoRemove }: Props) {
  if (groups.length === 0) return null

  const totalDuplicates = groups.reduce((sum, g) => sum + g.length - 1, 0)

  return (
    <div
      data-testid="duplicates-panel"
      style={{
        border: '1px solid #e8c37a',
        background: '#fffaf0',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <strong>
          {totalDuplicates} likely duplicate{totalDuplicates === 1 ? '' : 's'} found (identical file content)
        </strong>
        <button onClick={onAutoRemove}>Remove duplicates automatically</button>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.4rem 0 0.75rem' }}>
        Everything is kept by default. Uncheck a copy below to leave it out of the download, or use the
        button above to keep only the first copy of each and skip review.
      </p>

      {groups.map((group, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {group.map((photo) => (
            <label
              key={photo.id}
              style={{ textAlign: 'center', fontSize: '0.7rem', width: 70, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={!photo.excluded}
                onChange={() => onToggleExcluded(photo.id)}
              />
              {photo.thumbnailUrl ? (
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.originalFilename}
                  style={{
                    width: 60,
                    height: 60,
                    objectFit: 'cover',
                    display: 'block',
                    margin: '2px auto',
                    borderRadius: 4,
                    opacity: photo.excluded ? 0.4 : 1,
                  }}
                />
              ) : (
                <div style={{ width: 60, height: 60, background: '#eee', margin: '2px auto', borderRadius: 4 }} />
              )}
              <span
                style={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={photo.originalFilename}
              >
                {photo.originalFilename}
              </span>
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}
