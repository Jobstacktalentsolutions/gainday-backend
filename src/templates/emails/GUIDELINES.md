# Building a Gainday email template

This folder is the single source of truth for every transactional email Gainday
sends. Read this before adding or editing a template.

## How a template gets its data

`EmailService.renderTemplate()` (`src/modules/email/email.service.ts`) renders
`<name>.ejs` with whatever `context` the caller passes, **plus** three fields it
injects into *every* template automatically:

| Variable | Value | Notes |
|---|---|---|
| `appUrl` | `email.appUrl` config (`APP_URL` env var — the deployed frontend, e.g. `https://gainday-app.vercel.app`) | The one base URL for links and assets. Don't introduce another base URL variable (`frontendUrl`, `baseUrl`, etc.) — every template and every caller uses `appUrl`. |
| `logoUrl` | `${appUrl}/gainday-logo.png` | Points at the logo file in `gainday-frontend/public/`. If the logo ever changes, replace that file — don't hardcode a different path in a template. |
| `year` | Current year, unless the caller passes one | Used in the footer copyright line. |

A caller only needs to pass what's specific to that email (a link, a name, a
score). Never re-derive `appUrl`/`logoUrl`/`year` inside a template or a
notification method — they're already there.

## Structure: use the shared partials, don't copy markup

Every template follows the same skeleton:

```ejs
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>...</title>
  <%- include('partials/_styles') %>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <%- include('partials/_header', { bannerTitle: 'Your Heading Here' }) %>

      <div class="content">
        <!-- this email's actual content -->
      </div>

      <%- include('partials/_footer', { year: year, appUrl: appUrl }) %>
    </div>
  </div>
</body>
</html>
```

- `partials/_styles.ejs` — the shared stylesheet (colors, layout, component
  classes). Add a new *reusable* component class here if a future template
  needs one; don't invent a one-off class inline in a single template.
- `partials/_header.ejs` — logo + the blue title banner. Takes one param,
  `bannerTitle`. This is the only place the logo `<img>` tag exists.
- `partials/_footer.ejs` — social icons, copyright, Help/Privacy/Terms links.
  Takes `year` and `appUrl`.

If a new use case needs a genuinely new visual piece (a new kind of card, a
different layout section), add it as a class in `_styles.ejs` so the next
template can reuse it too, rather than writing a scoped `<style>` block per
template.

## The one rule that matters most: inline the button color

Gmail, Outlook.com, and several mobile mail apps strip `<style>` blocks
entirely or override an `<a>` tag's color with their own link-color default.
Relying on `.cta-button { color: #ffffff }` alone is why a button can render
with unreadable, washed-out text in some clients even though it looks correct
in a browser preview.

Every button and every colored link must carry its critical styles **inline**,
in addition to the class:

```html
<a href="<%= someLink %>" class="cta-button"
   style="background-color:#1817fe; color:#ffffff !important; text-decoration:none; padding:12px 28px; border-radius:6px; font-weight:600; font-size:14px; display:inline-block;">
  Button Label
</a>
```

The class is kept for clients that do honor `<style>` (so a future palette
change only needs one edit); the inline style is the guarantee for the ones
that don't. Apply the same treatment to any other `<a>` whose color matters
(footer links, verification/reset link text).

## Palette and components already available

- Brand blue: `#1817fe` — buttons, links, accents.
- Page background: `#eef0fb`. Card background: `#ffffff`. Neutral text:
  `#4a5568` / `#718096`.
- `.highlight-box` — a left- or top-accented callout box (used for "what
  happens next" style messaging, or a centered stat like the overall score).
- `.link-section` — a boxed, monospace display of a raw URL (verify/reset
  links), for the "if the button doesn't work" fallback.
- `.alert` — amber warning box (expiry notices, security callouts).
- `.badge` — small pill label (e.g. a job title tag).
- `.metric-row` / `.score-value` / `.card-number` — score and count displays.

Reuse these before inventing new markup — a new template should mostly be new
copy and new variables slotted into existing components.

## Adding a new template for a new use case

1. Check whether an existing component in `_styles.ejs` already covers what
   you need. Extend it there if it needs a small variant, rather than writing
   new CSS in the template.
2. Write `<name>.ejs` following the skeleton above.
3. Wire up the sender: wherever the email is triggered (see
   `notifications.service.ts` for the pattern), pass only the
   template-specific context — never re-pass `appUrl`, `logoUrl`, or `year`.
4. Render it with real sample data before committing. There's no test harness
   wired into CI for this yet, so do it manually — `ejs.render(readFileSync(...), context, { filename, views: [templatesDir] })`
   — and check the output for unresolved `<%= %>` tags or thrown errors.
5. If the email includes a link users click, verify the route actually exists
   on the frontend at that path under `appUrl`. Don't guess a route — check
   `gainday-frontend/src` for it, the same way you'd check a backend schema
   before wiring a frontend field.

## Known gap

None of these templates currently have a working unsubscribe link — there's no
unsubscribe endpoint or preference mechanism in the codebase yet. Don't add a
decorative "Unsubscribe" link that points nowhere; add the real link once that
mechanism exists (and revisit whether transactional emails like these need one
at all versus only marketing sends).
