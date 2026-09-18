import { useMutation } from '@tanstack/react-query'
import { getKlashAuthorContact } from '../../api/klashes'

/** Looks up a klash author's email (spec §2, moderator/authority/admin
 * only). Modelled as a mutation rather than a query, deliberately: every
 * call is journalised server-side (`get_klash_author_contact`'s audit
 * trail), so this must only ever run in response to an explicit "voir
 * l'email de l'auteur" click — a query could refetch on window focus or
 * remount and silently log a lookup nobody asked for. */
export function useKlashAuthorContact() {
  return useMutation({
    mutationFn: (klashId: string) => getKlashAuthorContact(klashId),
  })
}
