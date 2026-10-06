import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useJobs } from '@/hooks/useJobs'
import { useCompanies } from '@/hooks/useCompanies'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SourceBadge } from '../SourceBadge'
import { Skeleton } from '@/components/ui/skeleton'
// import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import ErrorAlert from '@/components/ErrorAlert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/format'

export const JobsTable = () => {
  const { data: jobs, isPending, isError, error } = useJobs()
  const { data: companies } = useCompanies()
  const [filter, setFilter] = useState('')
  // '' = all companies; otherwise a company id as a string (a <select>'s
  // value is always a string - compared against String(job.company_id)).
  const [companyId, setCompanyId] = useState('')
  // Client-side only - per BUILD_PLAN.md, server-side filtering arrives
  // with Slice 9's per-user feed. useMemo just avoids re-filtering on
  // renders that touch neither `jobs` nor the filters.
  const filteredJobs = useMemo(() => {
    if (!jobs) return []
    const needle = filter.trim().toLowerCase()
    return jobs.filter(
      (job) =>
        (!companyId || String(job.company_id) === companyId) &&
        (!needle || job.title.toLowerCase().includes(needle))
    )
  }, [jobs, filter, companyId])

  const sortedCompanies = useMemo(
    () => (companies ? [...companies].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [companies]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        {jobs && (
          <p className="text-sm text-muted-foreground">
            Showing {filteredJobs.length} of {jobs.length} jobs
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="text"
          placeholder="Search jobs by title..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {/* Native <select>: one plain dropdown doesn't justify adding a
            shadcn Select component. Classes mirror ui/input.jsx so the two
            controls match. */}
        <select
          aria-label="Filter by company"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 sm:w-56"
        >
          <option value="">All companies</option>
          {sortedCompanies.map((company) => (
            <option key={company.id} value={String(company.id)}>
              {company.name}
            </option>
          ))}
        </select>
      </div>

      {isError && ( <ErrorAlert error={error} title="Couldn't load jobs"/>)}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Posted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending &&
            Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={4}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}

          {!isPending && !isError && filteredJobs.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                {jobs && jobs.length === 0 ? 'No jobs loaded yet.' : 'No jobs match these filters.'}
              </TableCell>
            </TableRow>
          )}

          {filteredJobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-medium">
                <Link to={`/jobs/${job.id}`} className="hover:underline">
                  {job.title}
                </Link>
              </TableCell>
              <TableCell>{job.company}</TableCell>
              <TableCell>
                <SourceBadge source={job.source}/>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(job.posted_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
