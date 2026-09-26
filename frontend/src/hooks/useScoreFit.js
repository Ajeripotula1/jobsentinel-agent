import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "./queryKeys"
import { useApi } from "./useApi"
import { ApiError } from "@/api/client"

// Read the latest *cached* Score Fit result for this job (GET
// /jobs/{id}/score). This never runs the agent - it only reads back the
// last successful run stored in agent_runs for (this job, your latest
// profile). Running it is useRunScoreFit's job below.
//
// A 404 here is an expected state, not a failure: it means "this job
// hasn't been scored against your current profile yet" (or you have no
// profile at all - the API also 404s in that case). Same pattern as
// useProfile: resolve to `null` so components can tell three states apart:
//   isPending          -> still loading
//   isError            -> the request really failed (401/500/network)
//   data === null      -> never scored, show the "Score fit" button
//   data is an object  -> a FitAssessment, render it
// Any non-404 error is re-thrown as-is so ErrorAlert sees the server's
// real detail message.
//
// staleTime: Infinity - a stored result only changes through
// useRunScoreFit's onSuccess (which writes the new result straight into
// this cache) or a profile upload (which invalidates ['score'], see
// useProfile.js), so there's never a reason to refetch on a timer, on
// remount, or on window focus.
//
// `enabled`: JobDetail passes `isSignedIn` here. Signed out, this endpoint
// would just 401, so the query must never fire at all.
export const useScoreFit = (jobId, { enabled = true } = {}) => {
    const api = useApi()

    return useQuery({
        queryKey: queryKeys.score(jobId),
        queryFn: async () => {
            try {
                return await api(`/jobs/${jobId}/score`)
            } catch (error) {
                if (error instanceof ApiError && error.status === 404) {
                    return null
                }
                throw error
            }
        },
        enabled,
        staleTime: Infinity,
    })
}

// Trigger a fresh Score Fit run (POST /jobs/{id}/score). Always re-runs the
// agent (and always writes a new agent_runs row) - it's a mutation because
// it's a user-triggered, expensive, multi-second action, not passive data
// loading. There's no streaming (Mangum buffers the response), so
// `isPending` on this mutation IS the progress state - the component
// renders its "Analyzing fit..." UI off it.
//
// No request body: the API resolves "your latest profile" server-side.
//
// Hook-level onSuccess (not a mutate()-level callback) so the cache write
// still happens if the user navigates away mid-run. The POST response is
// the same FitAssessment shape GET returns, so we write it straight into
// the score query's cache: the panel flips to the result, and anything
// gated on "has a score" (the Job Agent chat) unlocks, with no extra
// request.
export const useRunScoreFit = (jobId) => {
    const api = useApi()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: () => api(`/jobs/${jobId}/score`, { method: 'POST' }),
        onSuccess: (assessment) => {
            queryClient.setQueryData(queryKeys.score(jobId), assessment)
        },
    })
}
