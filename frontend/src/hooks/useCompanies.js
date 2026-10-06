// Fetch companies from API (public, like /jobs)

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useApi } from "./useApi"
import { queryKeys } from "./queryKeys"
import { useAuth } from "@clerk/clerk-react"

export const useCompanies = () => {
    const api = useApi()
    return useQuery({
        queryKey: queryKeys.companies,
        queryFn: () => api('/companies'),
        // Only changes when the seed command runs - no need to refetch often.
        staleTime: 30 * 60_000,
    })
}

export const useFollowedCompanies = () => {
    // The signed-in user's followed companies (full company objects +
    // followed_at, from GET /companies/following). Keyed per user - see
    // queryKeys.followedCompanies.
    const api = useApi()
    const {userId} = useAuth()
    return useQuery({
        queryKey: queryKeys.followedCompanies(userId),
        queryFn: () => api('/companies/following'),
        enabled: !!userId,
    })
}

// Follow / unfollow. Both mutations take the company id at call time
// (`follow.mutate(company.id)`), so one hook instance can serve a whole list
// of cards rather than needing a hook per company.
//
// On success we invalidate the user's followed-companies query rather than
// patching the cache by hand: PUT/DELETE return 204 with no body, so there's
// no fresh data to write in - refetching GET /companies/following is the
// simplest way to get back the server's truth (including followed_at).
// The UI briefly shows the old state until that refetch lands; if that lag
// becomes noticeable, the upgrade is an optimistic update (onMutate).

const useInvalidateFollowed = () => {
    const queryClient = useQueryClient()
    const { userId } = useAuth()
    return () => queryClient.invalidateQueries({ queryKey: queryKeys.followedCompanies(userId) })
}

export const useFollowCompany = () => {
    const api = useApi()
    const invalidateFollowed = useInvalidateFollowed()
    return useMutation({
        // PUT, not POST - following is idempotent server-side (see the
        // companies router), so a double-click is harmless.
        mutationFn: (companyId) => api(`/companies/${companyId}/follow`, { method: 'PUT' }),
        onSuccess: invalidateFollowed,
    })
}

export const useUnfollowCompany = () => {
    const api = useApi()
    const invalidateFollowed = useInvalidateFollowed()
    return useMutation({
        mutationFn: (companyId) => api(`/companies/${companyId}/follow`, { method: 'DELETE' }),
        onSuccess: invalidateFollowed,
    })
}
