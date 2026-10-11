import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCampaignLink,
  fetchCampaignSources,
  fetchCampaignStats,
  updateCampaignLink,
} from '../../api/campaigns'
import { campaignKeys } from '../../api/queryKeys'
import type { AttributionTouch } from '../../types/campaign'

export function useCampaignStats(touch: AttributionTouch) {
  return useQuery({
    queryKey: campaignKeys.stats(touch),
    queryFn: () => fetchCampaignStats(touch),
  })
}

export function useCampaignSources() {
  return useQuery({
    queryKey: campaignKeys.sources(),
    queryFn: fetchCampaignSources,
    staleTime: 10 * 60_000,
  })
}

export function useCreateCampaignLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCampaignLink,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  })
}

export function useUpdateCampaignLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      slug,
      ...changes
    }: {
      slug: string
      destination?: string
      isActive?: boolean
    }) => updateCampaignLink(slug, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  })
}
