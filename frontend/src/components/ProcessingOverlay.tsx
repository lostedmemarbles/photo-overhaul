import smiley from '../assets/pixelatedsmiley.png'

interface Props {
  doneCount: number
  failedCount: number
  total: number
}

export function ProcessingOverlay({ doneCount, failedCount, total }: Props) {
  const settled = doneCount + failedCount
  const percent = total > 0 ? Math.round((settled / total) * 100) : 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <style>
        {`@keyframes po-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
      </style>
      <div
        style={{
          background: 'white',
          borderRadius: 10,
          padding: '1.5rem 2rem',
          minWidth: 280,
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          textAlign: 'center',
        }}
      >
        <img
          src={smiley}
          alt="Processing"
          width={64}
          height={64}
          style={{
            display: 'block',
            margin: '0 auto 0.75rem',
            animation: 'po-spin 1s linear infinite',
            imageRendering: 'pixelated',
          }}
        />
        <p style={{ margin: '0 0 0.75rem', fontWeight: 600 }}>
          {total > 0 ? (
            <>
              {doneCount}/{total} processed
              {failedCount > 0 && <span style={{ color: 'crimson' }}> ({failedCount} failed)</span>}
            </>
          ) : (
            'Reading files…'
          )}
        </p>
        <div
          style={{
            width: '100%',
            height: 8,
            borderRadius: 4,
            background: '#eee',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: '100%',
              background: '#4287f5',
              transition: 'width 150ms ease',
            }}
          />
        </div>
      </div>
    </div>
  )
}
