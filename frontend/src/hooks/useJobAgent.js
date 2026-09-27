import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useApi } from "./useApi"
import { queryKeys } from "./queryKeys"
import { Divide } from "lucide-react"

// Fetch Agent history for particular job (GET /jobs/{id}/agent).
// No 404 -> null handling here (unlike useScoreFit): "no conversation yet"
// comes back as 200 + [], so a 404 only means the job doesn't exist - a
// real error ErrorAlert should show.
export const useJobAgentHistory = (jobId, { enabled = true } = {}) => {
    const api = useApi()
    return useQuery(
        {
            queryKey: queryKeys.agent(jobId),
            queryFn: () => api(`/jobs/${jobId}/agent`),
            enabled: enabled,
            staleTime: Infinity,
            refetchOnWindowFocus: false
        }
    )
}

// Send one message to the Job Agent (POST /jobs/{id}/agent). mutate(message)
// passes `message` into mutationFn, and TanStack hands it back to onSuccess
// as the second arg (`variables`). onSuccess appends both turns to the
// cached history instead of refetching; if nothing is cached yet, return
// undefined so the next mount fetches the real history.
export const useSendJobAgentMessage = (jobId) => {
    const api = useApi()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (message) => api(`/jobs/${jobId}/agent`, { method: 'POST', body: { message } }),
        onSuccess: (data, message) => {
            queryClient.setQueryData(queryKeys.agent(jobId), (old) =>
                old === undefined
                    ? undefined
                    : [...old, { role: 'user', text: message }, { role: 'assistant', text: data.reply }]
            )
        },
    })
}