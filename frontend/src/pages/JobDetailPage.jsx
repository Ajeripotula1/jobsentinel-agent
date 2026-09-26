import { useParams } from "react-router-dom"
import { NotFoundPage } from "./NotFoundPage"
import { JobDetail } from "@/components/jobs/JobDetail"

// Only validates the URL param. JobDetail owns the whole page layout
// (header, posting, and the ScoreFit/Job Agent aside) so the aside only
// mounts once the job has actually loaded - see JobDetail.jsx.
export const JobDetailPage = () => {
  const jobId = Number(useParams().jobId)

  // Catches "abc" (NaN), "1.5", "0" and negatives - none can be a real id.
  if (!Number.isInteger(jobId) || jobId <= 0) return <NotFoundPage />

  return <JobDetail jobId={jobId} />
}
