import type { Bbox } from '../utils/bbox'
import { bboxKey } from '../utils/bbox'

export const klashKeys = {
  all: ['klashes'] as const,
  bbox: (bbox: Bbox) => [...klashKeys.all, 'bbox', bboxKey(bbox)] as const,
  detail: (id: string) => [...klashKeys.all, 'detail', id] as const,
}
