/** React Router's browser history numbers its entries in `history.state.idx`, starting
 * at 0 on the first page the app loaded. Unlike `location.key !== 'default'`, this
 * stays 0 after a `<Navigate replace>` redirect (e.g. RequireAuth sending a deep link
 * to `/login`) or a `replace: true` search-param update, where going back would leave
 * the app. */
export function hasPreviousInAppEntry(): boolean {
  const state: unknown = window.history.state
  if (typeof state !== 'object' || state === null || !('idx' in state)) return false
  return typeof state.idx === 'number' && state.idx > 0
}
