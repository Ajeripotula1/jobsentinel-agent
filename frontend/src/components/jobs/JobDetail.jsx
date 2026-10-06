import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useJob } from '@/hooks/useJobs'
import { useScoreFit } from '@/hooks/useScoreFit'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { ScoreFitPanel } from './ScoreFitPanel'
import ErrorAlert from '@/components/ErrorAlert'
import ReactMarkdown from 'react-markdown'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SCROLL_CARD, SCROLL_CARD_CONTENT, TABS_CARD, TABS_LIST, TABS_PANEL, TABS_ROOT } from '@/lib/layout'
import { JobAgentChat } from './JobAgentChat'

export const JobDetail = ({ jobId }) => {
    const { data: job, isPending, isError, error } = useJob(jobId)
    const { isSignedIn } = useAuth()
    // Same query key as ScoreFitPanel's own useScoreFit call, so React Query
    // dedupes them into one request - this is just a second reader of the
    // same cache entry. `enabled: isSignedIn`: signed out it would only 401.
    const score = useScoreFit(jobId, { enabled: isSignedIn })
    // Chat is gated on a stored score existing (Decision 5), never on
    // sending a message and parsing the backend's gate text. score.data is
    // undefined while loading and null for "never scored", so != null
    // covers both. isSignedIn is redundant today (the tabs only render
    // signed in) but keeps canChat honest if that ever changes.
    const canChat = isSignedIn && score.data != null
    // The tab the user *picked*. The tab actually *shown* is derived below.
    const [tab, setTab] = useState('score-fit')
    // Derive, don't sync: if canChat flips to false while you're on the chat
    // tab (e.g. a resume upload invalidates the score), this falls back to
    // the fit tab on the same render - no useEffect watching canChat and
    // calling setTab, which would render the wrong tab once first.
    const activeTab = canChat ? tab : 'score-fit'

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
                <Badge variant="secondary">{job.company}</Badge>
                {job.location && (
                    // Multi-location postings can be long - capped and
                    // truncated, full text in the tooltip.
                    <span title={job.location} className="max-w-64 shrink-0 truncate text-sm text-muted-foreground">
                        {job.location}
                    </span>
                )}
                {job.workplace_type && (
                    <Badge variant="outline" className="capitalize">{job.workplace_type}</Badge>
                )}
                <span className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">
                    Posted {formatDate(job.posted_at)}
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
                    {/* The Card is the frame; Tabs fill it. The tab list is
                        pinned at the top, and each TabsContent scrolls on its
                        own (see TABS_* in lib/layout.js for the height chain).
                        keepMounted: switching tabs hides a panel instead of
                        unmounting it. That keeps an in-flight Score Fit run's
                        isPending state (otherwise you'd come back to an idle
                        "Score fit" button mid-run and could start a second
                        paid run), and each tab's scroll position. */}
                    {!isSignedIn ? (
                        // Decision 10: blocked inline, not by a route redirect -
                        // the posting stays readable signed out. redirect_url
                        // brings the user back to this job after signing in.
                        <Card>
                            <CardHeader>
                                <CardTitle>See how you fit</CardTitle>
                                <CardDescription>
                                    Sign in to score this job against your resume and work with the Job Agent on a
                                    tailored resume and cover letter.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link
                                    to={`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`}
                                    className={buttonVariants({ className: 'w-full' })}
                                >
                                    Sign in
                                </Link>
                            </CardContent>
                        </Card>
                    ) : (
                    <Card className={TABS_CARD}>
                        {/* Controlled: value is the derived activeTab, not `tab`. */}
                        <Tabs value={activeTab} onValueChange={setTab} className={TABS_ROOT}>
                            <TabsList className={TABS_LIST}>
                                <TabsTrigger value="score-fit">Fit score</TabsTrigger>
                                {/* A disabled trigger gets pointer-events-none, so a
                                    hover `title` would never show - the "score this
                                    job first" hint lives in ScoreFitPanel instead,
                                    where it's visible on touch screens too. */}
                                <TabsTrigger value="agent" disabled={!canChat}>
                                    Job Agent
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="score-fit" keepMounted className={TABS_PANEL}>
                                <ScoreFitPanel jobId={jobId} />
                            </TabsContent>
                            <TabsContent value="agent" keepMounted className={TABS_PANEL}>
                                {/* Only mounted once chat is allowed, so no history
                                    GET fires for an unscored job. After that,
                                    keepMounted keeps it (and an unsent draft) alive
                                    across tab switches. */}
                                {canChat && <JobAgentChat jobId={jobId} />}
                            </TabsContent>
                        </Tabs>
                    </Card>
                    )}
                </aside>
            </div>
        </div>
    )
}
