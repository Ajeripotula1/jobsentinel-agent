import { Link } from 'react-router-dom'
import { useJob } from '@/hooks/useJobs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { ScoreFitPanel } from './ScoreFitPanel'
import ErrorAlert from '@/components/ErrorAlert'
import ReactMarkdown from 'react-markdown'
import { SCROLL_CARD, SCROLL_CARD_CONTENT } from '@/lib/layout'

export const JobDetail = ({ jobId }) => {
    const { data: job, isPending, isError, error } = useJob(jobId)

    if (isPending) {
        // Shaped like the real content below (back link / title / badges /
        // posting card) so the page doesn't jump once data arrives.
        return (
            <div className="mx-auto max-w-3xl space-y-6">
                <Skeleton className="h-8 w-24" />
                <div className="space-y-3">
                    <Skeleton className="h-8 w-2/3" />
                    <div className="flex gap-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-32" />
                    </div>
                </div>
                <Card>
                    <CardContent className="space-y-3 pt-6">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (isError) {
        return (
            <div className="mx-auto max-w-3xl">
                <ErrorAlert error={error} title="Couldn't load this job" />
            </div>
        )
    }

    // lg+: an "app shell" layout. The page is exactly one viewport tall
    // (100dvh minus the h-14 navbar and main's py-6), so the window itself
    // never scrolls - each Card scrolls its own content instead (see
    // ScrollCard below). flex-col + flex-1 on the grid hands the columns
    // "whatever height is left after the header", with no hard-coded header
    // height, so a title that wraps to two lines still fits. Below lg it's a
    // normal page that scrolls as one column.
    return (
        <div className="space-y-4 lg:flex lg:h-[calc(100dvh-6.5rem)] lg:flex-col">
            {/* One-line header: every pixel here comes out of the two
                scrolling columns below, since the page is exactly one viewport
                tall. lg+: a single row (flex-nowrap) where only the title is
                allowed to shrink - it truncates with "…" (full text in the
                tooltip via `title`) while the back link, company badge, date,
                and link keep their natural width (shrink-0). Below lg it wraps:
                basis-full gives the title its own line so it isn't cut off
                on a phone, where the page scrolls normally anyway. */}
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:shrink-0 lg:flex-nowrap">
                {/* -ml-2.5 cancels the ghost button's px-2.5 so the arrow
                    lines up with the cards' left edge below. */}
                <Link to="/jobs" className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2.5' })}>
                    <ArrowLeft />
                    All jobs
                </Link>
                <span aria-hidden className="hidden h-5 w-px shrink-0 bg-border lg:block" />
                <h1
                    title={job.title}
                    className="basis-full text-lg font-semibold tracking-tight lg:min-w-0 lg:basis-auto lg:truncate"
                >
                    {job.title}
                </h1>
                <Badge variant="secondary">{job.board_token}</Badge>
                <span className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">
                    Fetched {formatDate(job.fetched_at)}
                </span>
                {job.url && (
                    <Button
                        variant="link"
                        size="sm"
                        className="px-0"
                        render={<a href={job.url} target="_blank" rel="noreferrer" />}
                    >
                        Original posting
                        <ExternalLink />
                    </Button>
                )}
            </header>
            {/* Main Page grid. lg: 50/50 (grid-cols-2 is already
                repeat(2, minmax(0,1fr)), so long URLs in the posting can't
                blow out the left column). xl+: 2fr/3fr - the fit panel and
                chat are the denser, working side, so they get the bigger
                share; the posting stays ~480-590px, still a comfortable
                line length for reading. minmax(0, …) keeps the same
                overflow protection grid-cols-2 gives us for free. */}
            {/* flex-1 + min-h-0: take the remaining height, and allow
                shrinking below content height (a flex item's default min
                height is its content, which would defeat the whole thing).
                grid-rows-[minmax(0,1fr)]: same idea for the grid's single row -
                an implicit `auto` row grows to fit its tallest column. */}
            <div className='grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'>
                <Card className={SCROLL_CARD}>
                    <CardHeader>
                        <CardTitle>Posting</CardTitle>
                    </CardHeader>
                    <CardContent className={SCROLL_CARD_CONTENT}>
                        <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-heading prose-headings:font-medium">
                            <ReactMarkdown>{job.description}</ReactMarkdown>
                        </div>
                    </CardContent>
                </Card>
                <aside className='order-first lg:order-0 lg:min-h-0'>
                    <ScoreFitPanel jobId={jobId} />
                </aside>
            </div>
        </div>
    )
}
