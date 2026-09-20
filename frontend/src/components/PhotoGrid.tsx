import type { ProcessedPhoto } from '../lib/types'

export function PhotoGrid({ photos }: { photos: ProcessedPhoto[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '0.75rem',
      }}
    >
      {photos.map((photo) => (
        <div key={photo.id} style={{ position: 'relative' }}>
          {photo.thumbnailUrl ? (
            <img
              src={photo.thumbnailUrl}
              alt={photo.originalFilename}
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                objectFit: 'cover',
                borderRadius: 6,
                opacity: photo.excluded ? 0.35 : 1,
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: 6,
                background: '#eee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                color: '#666',
              }}
            >
              {photo.status}
            </div>
          )}
          {photo.status === 'failed' && (
            <span style={{ color: 'crimson', fontSize: '0.75rem' }} title={photo.error ?? ''}>
              failed
            </span>
          )}
          {photo.excluded && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                left: 4,
                background: 'rgba(180,0,0,0.75)',
                color: 'white',
                fontSize: '0.65rem',
                padding: '1px 5px',
                borderRadius: 4,
              }}
              title="Excluded as a duplicate - won't be included in the download"
            >
              excluded
            </span>
          )}
          {photo.dateSource === 'file-modified' && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                background: 'rgba(0,0,0,0.65)',
                color: 'white',
                fontSize: '0.65rem',
                padding: '1px 5px',
                borderRadius: 4,
              }}
              title="No EXIF date found (often stripped by social media/messaging apps). Grouped by this file's last-modified date instead, which may just be when it was downloaded."
            >
              file date
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
