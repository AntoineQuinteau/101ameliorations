# Correct Procedure for Adding a New Category

Follow these steps to add a new category to the project going forward.

---

### 1. Database Migration
Create a new migration file in `supabase/migrations/`. Put only the enum update in this file:

```sql
ALTER TYPE public.klash_category ADD VALUE 'category_N';
```

> **Note:** Postgres requires the new enum value to be committed before it can be used elsewhere in subsequent scripts (per the comment in `20260917004504_klash_category_enum_values.sql`).

### 2. Local Database Reset
Apply migrations and seed locally:
```bash
npx supabase db reset
```

### 3. Generate Types
Regenerate `src/types/database.ts` (this command automatically runs Prettier):
```bash
npm run gen:types
```

### 4. Update Application Types & UI Order
Manually edit `src/types/klash.ts`:
* Add the new value to the `klashCategorySchema` array.
* Position it wherever you want it to appear in the UI.
* **Important:** Always keep `category_7` last, as it is the special *"Autre"* option.

### 5. Add Translations
Manually edit `src/i18n/fr.ts`:
* Add the corresponding French label under `category`.

### 6. Test & Verify
Run linters, type checks, and test suites:
```bash
npm run lint && npm run typecheck && npm test
```

### 7. Commit & Preview
Commit your changes, push to a feature branch, and review the preview deployment:
```bash
git commit -m "db: add category_8 (manque de stationnement)"
```

### 8. Production Deployment
Deploy the database changes to production (refer to `README` § *Base de données*):
```bash
npx supabase db push
```