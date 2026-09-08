import { fr } from './i18n/fr'

export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-2xl font-semibold text-teal-800">{fr.app.name}</h1>
      <p className="max-w-md text-sm text-neutral-500">{fr.app.tagline}</p>
    </main>
  )
}
