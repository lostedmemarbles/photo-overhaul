import { groupByDate } from '../lib/groupByDate'
import type { DateGranularity, ProcessedPhoto } from '../lib/types'
import { PhotoGrid } from './PhotoGrid'

export function DateGroups({
  photos,
  granularity,
}: {
  photos: ProcessedPhoto[]
  granularity: DateGranularity
}) {
  return (
    <>
      {groupByDate(photos, granularity).map(([dateKey, groupPhotos]) => (
        <section key={dateKey} style={{ marginBottom: '2rem' }}>
          <h3>{dateKey}</h3>
          <PhotoGrid photos={groupPhotos} />
        </section>
      ))}
    </>
  )
}
