import { groupByDate } from '../lib/groupByDate'
import type { ProcessedPhoto } from '../lib/types'
import { PhotoGrid } from './PhotoGrid'

export function DateGroups({ photos }: { photos: ProcessedPhoto[] }) {
  return (
    <>
      {groupByDate(photos).map(([dateKey, groupPhotos]) => (
        <section key={dateKey} style={{ marginBottom: '2rem' }}>
          <h3>{dateKey}</h3>
          <PhotoGrid photos={groupPhotos} />
        </section>
      ))}
    </>
  )
}
