import { useState } from 'react'
import { Loader2, SendHorizontal } from 'lucide-react'
import { useJobAgentHistory, useSendJobAgentMessage } from '@/hooks/useJobAgent'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { Textarea } from '@/components/ui/textarea'
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import ErrorAlert from '@/components/ErrorAlert'
import { ChatMessage } from './ChatMessage'

const STARTERS = [
    'Which gaps matter most for this role?',
    'Help me tailor my resume for this job',
    'Draft a cover letter for this job',
]

// Placeholder shapes while history loads: alternating sides and widths so it
// reads as "a conversation is coming", not a generic loading bar.
const SKELETON_BUBBLES = [
    { align: 'self-end', width: 'w-1/2' },
    { align: 'self-start', width: 'w-3/4' },
    { align: 'self-end', width: 'w-2/5' },
]

// Job Agent chat for one job (UI.md Step 5.3). Renders inside the right
// column's TabsContent, which already provides the Card frame - so no Card
// or outer border here (a card inside a card reads as a nested box).
//
// There's no `messages` useState: the transcript is server state (the
// history query's cache), and the one in-flight message is mutation state
// (`send.variables`). Only the unsent draft is local.
export const JobAgentChat = ({ jobId }) => {
    const history = useJobAgentHistory(jobId, { enabled: true })
    const send = useSendJobAgentMessage(jobId)
    const [draft, setDraft] = useState('')

    // Used by the send button, Enter key, and starter buttons alike.
    const submit = (text) => {
        const message = text.trim()
        if (!message || send.isPending) return
        setDraft('')
        // Call-level onError: put the text back so a failed send doesn't
        // lose what the user typed. The hook-level onSuccess still runs.
        send.mutate(message, { onError: () => setDraft(message) })
    }

    const onKeyDown = (e) => {
        // isComposing: don't send mid-IME composition (e.g. Japanese input,
        // where Enter confirms a character rather than submitting).
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit(draft)
        }
    }

    const turns = history.data ?? []
    const canSend = draft.trim().length > 0 && !send.isPending && history.isSuccess

    return (
        <div className="flex h-[70vh] min-h-105 flex-col">
            {/* Provider owns scroll state. defaultScrollPosition="end" opens a
                restored conversation at the latest message; autoScroll follows
                new content only while you're already at the bottom. */}
            <MessageScrollerProvider autoScroll defaultScrollPosition="end">
                <MessageScroller className="flex-1">
                    {/* role="log" + aria-live: screen readers announce new replies */}
                    <MessageScrollerViewport role="log" aria-live="polite">
                        <MessageScrollerContent className="p-4">
                            {history.isPending ? (
                                SKELETON_BUBBLES.map(({ align, width }, i) => (
                                    <Skeleton key={i} className={`h-12 rounded-xl ${align} ${width}`} />
                                ))
                            ) : history.isError ? (
                                <ErrorAlert
                                    error={history.error}
                                    title="Couldn't load this conversation"
                                    onRetry={history.refetch}
                                />
                            ) : turns.length === 0 && !send.isPending ? (
                                <Empty>
                                    <EmptyHeader>
                                        <EmptyTitle>Let's work on this application</EmptyTitle>
                                        <EmptyDescription>
                                            I've read this posting and your fit assessment. Ask about the gaps, or have
                                            me tailor your resume or draft a cover letter. I'll ask about your
                                            experience instead of making anything up.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    <EmptyContent>
                                        {STARTERS.map((starter) => (
                                            <Button
                                                key={starter}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => submit(starter)}
                                            >
                                                {starter}
                                            </Button>
                                        ))}
                                    </EmptyContent>
                                </Empty>
                            ) : (
                                <>
                                    {turns.map((turn, index) => (
                                        // Index keys are safe here: the list is
                                        // append-only and never reordered.
                                        // scrollAnchor on user turns pins each new
                                        // question near the top with the reply below.
                                        <MessageScrollerItem
                                            key={index}
                                            messageId={String(index)}
                                            scrollAnchor={turn.role === 'user'}
                                        >
                                            <ChatMessage role={turn.role} text={turn.text} />
                                        </MessageScrollerItem>
                                    ))}
                                    {send.isPending && (
                                        <>
                                            {/* Same messageId the real turn will get once
                                                onSuccess appends it, so the swap doesn't jump. */}
                                            <MessageScrollerItem messageId={String(turns.length)} scrollAnchor>
                                                <ChatMessage role="user" text={send.variables} />
                                            </MessageScrollerItem>
                                            <Marker>
                                                <MarkerIcon>
                                                    <Loader2 className="animate-spin" />
                                                </MarkerIcon>
                                                <MarkerContent className="shimmer">Thinking…</MarkerContent>
                                            </Marker>
                                        </>
                                    )}
                                </>
                            )}
                        </MessageScrollerContent>
                    </MessageScrollerViewport>
                    {/* "Jump to latest" arrow; only visible when scrolled up */}
                    <MessageScrollerButton />
                </MessageScroller>
            </MessageScrollerProvider>

            {send.isError && (
                <div className="px-3 pb-2">
                    <ErrorAlert error={send.error} title="Message failed" />
                </div>
            )}

            <div className="flex items-end gap-2 p-3">
                <Textarea
                    rows={2}
                    className="min-h-0 resize-none"
                    aria-label="Message the Job Agent"
                    placeholder="Ask about this job, or say 'help me tailor my resume'…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                />
                <Button size="icon" aria-label="Send" disabled={!canSend} onClick={() => submit(draft)}>
                    {send.isPending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
                </Button>
            </div>
        </div>
    )
}
