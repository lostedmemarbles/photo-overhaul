import { compareSizes, formatBytes } from '../lib/formatSize'
import type { ProcessedPhoto } from '../lib/types'

/**
 * Deliberately text-only, no thumbnail - decoding an image just to preview
 * it is the slowest step in the pipeline (worse still for HEIC), so this
 * view stays free of that cost even for large batches. Actual thumbnails
 * only ever get generated for photos flagged as likely duplicates, and
 * those are shown separately in DuplicatesPanel where a visual comparison
 * is actually useful.
 */
interface Props {
  photos: ProcessedPhoto[]
  // When provided, each row gets a checkbox to toggle `excluded` directly -
  // used for the "Excluded duplicates" section, since that's otherwise the
  // only place a photo can end up excluded with no way back short of
  // disabling "Automatically remove duplicates" first to reach the
  // DuplicatesPanel's checkboxes instead.
  onToggleExcluded?: (id: string) => void
}

export function PhotoGrid({ photos, onToggleExcluded }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {photos.map((photo) => (
        <div
          key={photo.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.4rem 0.6rem',
            border: '1px solid #eee',
            borderRadius: 6,
            fontSize: '0.85rem',
            opacity: photo.excluded ? 0.5 : 1,
          }}
        >
          {onToggleExcluded && (
            <input
              type="checkbox"
              checked={!photo.excluded}
              onChange={() => onToggleExcluded(photo.id)}
              title={photo.excluded ? 'Include this photo in the download' : 'Exclude this photo from the download'}
              style={{ flexShrink: 0 }}
            />
          )}
          <span
            style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={photo.originalFilename}
          >
            {photo.originalFilename}
          </span>

          <span style={{ color: '#666', flexShrink: 0 }}>
            {photo.exifDate ?? 'Unknown date'}
            {photo.dateSource === 'file-modified' && (
              <span
                style={{ marginLeft: 4, cursor: 'help' }}
                title="No EXIF date found (often stripped by social media/messaging apps). Using this file's last-modified date instead, which may just be when it was downloaded."
              >
                *
              </span>
            )}
          </span>

          <span style={{ color: '#666', flexShrink: 0, minWidth: '4.5em', textAlign: 'right' }}>
            {photo.status === 'done' && photo.converted ? (
              (() => {
                const outputSize = photo.outputBlob?.size ?? photo.originalSize
                const { percentChange } = compareSizes(photo.originalSize, outputSize)
                const direction = percentChange <= 0 ? '-' : '+'
                return (
                  <span title={`${formatBytes(photo.originalSize)} → ${formatBytes(outputSize)}`}>
                    {formatBytes(outputSize)}{' '}
                    <span style={{ color: percentChange <= 0 ? '#0a7d32' : '#b8590a' }}>
                      ({direction}
                      {Math.abs(percentChange).toFixed(0)}%)
                    </span>
                  </span>
                )
              })()
            ) : (
              formatBytes(photo.originalSize)
            )}
          </span>

          {photo.status === 'done' && (
            <span
              style={{ color: photo.converted ? '#0a7d32' : '#888', flexShrink: 0 }}
              title={photo.converted ? 'Processing changed this file\'s bytes' : 'Included as-is, unchanged by current options'}
            >
              {photo.converted ? 'converted' : 'unchanged'}
            </span>
          )}
          {photo.status === 'failed' && (
            <span style={{ color: 'crimson', flexShrink: 0 }} title={photo.error ?? ''}>
              failed
            </span>
          )}
          {photo.excluded && (
            <span style={{ color: '#b00000', flexShrink: 0 }} title="Excluded as a duplicate - won't be included in the download">
              excluded
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
