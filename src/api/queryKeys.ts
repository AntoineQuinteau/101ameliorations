import type { Bbox } from '../utils/bbox'
import { bboxKey } from '../utils/bbox'

export const klashKeys = {
  all: ['klashes'] as const,
  bbox: (bbox: Bbox) => [...klashKeys.all, 'bbox', bboxKey(bbox)] as const,
  detail: (id: string) => [...klashKeys.all, 'detail', id] as const,
  byAuthor: (authorId: string) => [...klashKeys.all, 'byAuthor', authorId] as const,
}

export const profileKeys = {
  all: ['profiles'] as const,
  detail: (userId: string) => [...profileKeys.all, 'detail', userId] as const,
}
