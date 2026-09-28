import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Message, MessageContent, MessageFooter } from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'

// One chat turn. Anything that isn't 'user' is treated as the agent (UI.md
// §3), so an unexpected role string still renders instead of vanishing.
export const ChatMessage = ({ role, text }) => {
    const isUser = role === 'user'
    // Local UI state only (Decision 1): flips the icon to a check for 1.5s
    // after copying, so the click has visible feedback.
    const [copied, setCopied] = useState(false)

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch {
            // Clipboard can be blocked (non-HTTPS origin, denied permission).
            // Nothing useful to show; the text is still selectable.
        }
    }

    return (
        // align user messages to the end (right), the agent's to the start
        <Message align={isUser ? 'end' : 'start'}>
            <MessageContent>
                {/* Agent replies get more width than the default 80%: drafted
                    resumes/cover letters are long and wrap badly in a narrow column. */}
                <Bubble
                    variant={isUser ? 'default' : 'muted'}
                    align={isUser ? 'end' : 'start'}
                    className={isUser ? undefined : 'max-w-[92%]'}
                >
                    <BubbleContent>
                        {isUser ? (
                            <p className="whitespace-pre-wrap">{text}</p>
                        ) : (
                            // first/last-child margin reset: prose adds top/bottom
                            // margins to headings/paragraphs, which would pad the
                            // bubble unevenly.
                            <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                <ReactMarkdown>{text}</ReactMarkdown>
                            </div>
                        )}
                    </BubbleContent>
                </Bubble>
                {/* Copy only on agent replies: those are the deliverable (Decision 7);
                    copying your own message back is noise. */}
                {!isUser && (
                    <MessageFooter>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={copied ? 'Copied' : 'Copy message'}
                            onClick={copy}
                        >
                            {copied ? <Check /> : <Copy />}
                        </Button>
                    </MessageFooter>
                )}
            </MessageContent>
        </Message>
    )
}
