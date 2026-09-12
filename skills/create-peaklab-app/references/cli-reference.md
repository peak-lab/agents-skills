# create-peaklab-app CLI reference

Verify the installed CLI's `--help` output before relying on a flag. This reference describes the
catalogue-supported generator interface.

## Project selection

| Need | Template | Typical options |
| --- | --- | --- |
| Marketing or content site | `web` | `--with-seo`, `--with-blog`, `--with-glossary`, `--cms directus` |
| Contact and newsletter site | `web` | `--with-email --with-newsletter` |
| Product dashboard or SaaS | `web-app` | database and Prisma are required; optionally email, auth, and payments |
| Internal application | `web-app` | appropriate auth provider and database |

For `web-app`, include `--with-db --with-prisma`. Add OAuth providers only when the product needs
them. Add Stripe only for a payment or subscription requirement.

## Common options

| Option | Meaning |
| --- | --- |
| `[github-url]` | Repository as `owner/repository` |
| `--template web\|web-app` | Project shape; defaults to `web` |
| `--with-email --email-provider resend\|brevo` | Email capability and provider |
| `--with-db --with-prisma` | PostgreSQL and Prisma |
| `--auth-providers google,github` | Comma-separated OAuth providers |
| `--with-seo`, `--with-blog`, `--with-glossary`, `--with-newsletter`, `--with-n8n`, `--with-stripe` | Optional modules |
| `--cms none\|directus\|wordpress` | Content-management integration |
| `--dir <directory>` | Output directory |
| `--config <path>` | JSON configuration file |
| `--port <number>` | Docker port base; use an available value from 1024 to 65000 |
| `--company-name <name>` | Application company name |
| `--locales <list> --default-locale <locale>` | Internationalization settings |
| `--no-docker`, `--db-url <url>` | External-service mode; keep URLs out of shared config |
| `--dry-run` | Preview without writing files |
| `--yes` | Non-interactive execution |

## Config example

```json
{
  "name": "my-project",
  "githubUrl": "owner/my-project",
  "template": "web-app",
  "modules": {
    "database": { "enabled": true, "orm": "prisma" },
    "email": { "enabled": true, "provider": "resend" },
    "seo": true,
    "stripe": true
  },
  "authProviders": ["google", "github"],
  "portBase": 8500,
  "i18n": { "defaultLocale": "en", "locales": ["en"] }
}
```

Do not add credentials, external database URLs, or real business addresses to a configuration
that will be committed or shared.

## Port map

| Service | Offset |
| --- | --- |
| Application | +0 |
| PostgreSQL | +1 |
| Mailpit SMTP | +2 |
| Mailpit web | +3 |
| n8n | +4 |
| Directus | +5 |

## Add a module later

```bash
create-peaklab-app add blog
create-peaklab-app add stripe
create-peaklab-app add email --provider brevo
create-peaklab-app add glossary
```
