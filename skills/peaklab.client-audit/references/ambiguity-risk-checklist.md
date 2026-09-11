# Ambiguity & Risk Checklist for Client Audits

## Common ambiguity patterns

### Data & triggers
- "Automatically update X when Y changes" → What is the trigger? Webhook, polling, user action?
  Who validates? What happens on failure? Can Y change back?
- "Read client emails" → Which inbox? Which email provider? OAuth2 approval needed?
  What if the email format changes? How to distinguish intent?
- "Sync with Google Agenda/Calendar" → One-way or bidirectional? Who wins on conflict?
  What events are synced? Private events? Delete propagation?
- "Generate PDF / contract / invoice" → What template? Which data fields?
  Legal review required? Which locale format (FR date, EUR currency)?

### Roles & permissions
- "Admins can see everything" → Can admin A see admin B's private data?
  Can commercial user see cost data? Impersonation scope?
- "Notify the right person" → Who decides who is "right"? Static assignment or rule-based?

### External integrations
- Any external API → Ask: does the client have API credentials?
  Is the API stable/documented? Is there a sandbox environment?
  Any approval process required? (PennyLine, Silae, etc.)
- "Connect to our existing software" → What version? Is there a public API or just CSV export?

### Business rules
- Payroll/overtime → What are the exact overtime rules? Which labor agreement (CCN)?
  Night hours? Public holidays? Part-time adjustments?
- Approval workflows → Who approves? What if approver is unavailable? Time limit?
  Can approval be delegated?

## Scope creep vectors (features that seem small)

| Stated feature | Hidden complexity |
|---------------|------------------|
| "Read emails to update quotes" | OAuth2 + inbox watch + parsing + noise filtering + failure recovery |
| "Drag and drop planning" | Conflict detection, optimistic UI, real-time multiplayer, undo |
| "Auto-generate contracts" | Legal template + variable merging + signature + legal validity |
| "Push notifications" | SW + VAPID keys + iOS restrictions + opt-in flow |
| "Reporting / statistics" | Define all metrics, aggregation rules, date ranges, export format |
| "Multi-agency" or "multi-client" | Full data isolation, billing per tenant, admin hierarchy |
| "Import from Excel/CSV" | Format validation, error handling, duplicate detection, rollback |
| "Time tracking with geolocation" | GPS permission, battery drain, background tracking, legal |

## Dependency blockers (must-build-first chains)

- Auth/roles → everything else requiring user identity
- RLS + data isolation → any feature reading another user's data
- Schema + migrations → any new data feature
- Devis/quote module → invoice module (invoice = validated quote)
- Client/mission master data → time entries, planning, billing
- Google Calendar OAuth → calendar sync features
- PennyLine API credentials + sandbox → invoice automation

## Compliance & legal flags (French context)

- **DPAE** (Déclaration Préalable à l'Embauche) — must be sent to URSSAF before each
  mission start. Automated DPAE requires a certified provider or URSSAF API access.
- **Contrats de mission** — legally binding, must include specific clauses (CCN, motif,
  durée, poste, taux). Template must be reviewed by a lawyer.
- **Relevés d'heures** — must match signed timesheets for billing (disputed hours).
- **Facturation** — French invoices must include SIRET, TVA, paiement terms, penalités.
  Electronic invoicing (facture électronique) mandatory from 2026.
- **RGPD** — employee personal data (salary, hours, health) requires a data processing
  register entry and retention policy.
- **Données de paie** — hourly rates, salaries are sensitive; restrict access strictly.

## Performance traps

| Pattern | Breaks at... | Fix |
|---------|-------------|-----|
| N+1 profile joins in hooks | ~50 users × 5 requests = 250 queries | Relational select or DB view |
| In-memory edge function cache | Every cold start loses cache | Use Redis or KV store |
| Client-side aggregation of all time entries | 1000+ entries = slow render | Aggregate in DB (view or function) |
| Polling every 30s for notifications | 100 users = 200 req/min | Supabase Realtime subscription |
| PDF generation on the client | Large PDFs crash mobile browsers | Server-side (edge function + headless) |
