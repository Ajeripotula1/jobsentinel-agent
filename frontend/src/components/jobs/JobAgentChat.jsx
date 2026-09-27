import { useState } from 'react'
import { Loader2, SendHorizontal } from 'lucide-react'
import { useJobAgentHistory, useSendJobAgentMessage } from '@/hooks/useJobAgent'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { Card, CardTitle, CardHeader, CardDescription, CardContent, CardFooter } from '../ui/card'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '../ui/empty'
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
// import { ChatMessage } from './ChatMessage'  // uncomment once ChatMessage exports it

// TODO(UI.md Step 5): message history (useJobAgentHistory) + input
// (useSendJobAgentMessage), gated on the job having a Score Fit result.
// Renders inside the right column's TabsContent, which already provides the
// Card frame and scrolling - so no Card here (a card inside a card reads as
// a nested box).
export const JobAgentChat = ({ jobId }) => {
    console.log("id", jobId)
    const { data: history, isPending: historyIsPending, isError: historyIsError, error: agentError } = useJobAgentHistory(jobId, { enabled: true })
    console.log("history", jobId, history)

    const sendMessage = useSendJobAgentMessage(jobId)
    return (
        <div>
            <p className="text-sm text-muted-foreground">
                Chat with JobAgent about this role
            </p>
            <MessageScrollerProvider>
                <div>
                    <CardContent>
                        {history?.length === 0 ? (
                            <Empty className="h-full">
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        {/* <MessageCircleDashedIcon /> */}
                                        JobSentinel
                                    </EmptyMedia>
                                    <EmptyTitle>Hey there!</EmptyTitle>
                                    <EmptyDescription>
                                        I can answer qustions about this job, explain how you fit, help your tailor your resume or draft a cover letter. Just say the word!"
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        ) : <div>
                            Will display messages here
                        </div>}
                    </CardContent>
                    <CardFooter>
                        <div className='flex items-end gap-2 w-full'>
                            <Textarea placeHolder = "Help me tailor my resume...">
                            </Textarea>
                            <Button size='icon'>
                                <SendHorizontal aria-label='send'/>
                            </Button>
                        </div>


                    </CardFooter>

                </div>
            </MessageScrollerProvider>

        </div>
    )

}
