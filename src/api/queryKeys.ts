import type { Bbox } from '../utils/bbox'
import { bboxKey } from '../utils/bbox'

export const klashKeys = {
  all: ['klashes'] as const,
  bbox: (bbox: Bbox) => [...klashKeys.all, 'bbox', bboxKey(bbox)] as const,
  detail: (id: string) => [...klashKeys.all, 'detail', id] as const,
  byAuthor: (authorId: string) => [...klashKeys.all, 'byAuthor', authorId] as const,
  nearby: (lat: number, lng: number, radiusM: number) =>
    [...klashKeys.all, 'nearby', lat, lng, radiusM] as const,
  photos: (klashId: string) => [...klashKeys.all, 'photos', klashId] as const,
}

export const confirmationKeys = {
  all: ['confirmations'] as const,
  mine: (klashId: string, userId: string) =>
    [...confirmationKeys.all, 'mine', klashId, userId] as const,
}

export const profileKeys = {
  all: ['profiles'] as const,
  detail: (userId: string) => [...profileKeys.all, 'detail', userId] as const,
}

export const commentKeys = {
  all: ['comments'] as const,
  byKlash: (klashId: string) => [...commentKeys.all, 'byKlash', klashId] as const,
}

export const statusChangeKeys = {
  all: ['statusChanges'] as const,
  byKlash: (klashId: string) => [...statusChangeKeys.all, 'byKlash', klashId] as const,
}

export const adminKlashKeys = {
  all: ['adminKlashes'] as const,
  list: (filtersKey: string, page: number) =>
    [...adminKlashKeys.all, 'list', filtersKey, page] as const,
  triage: () => [...adminKlashKeys.all, 'triage'] as const,
}

export const settingsKeys = {
  all: ['settings'] as const,
  serviceAreaBbox: () => [...settingsKeys.all, 'serviceAreaBbox'] as const,
  tileProvider: () => [...settingsKeys.all, 'tileProvider'] as const,
}
