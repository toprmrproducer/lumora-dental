# Lumora Dental — project notes

A premium dental clinic website. **Origin:** a de-branded, rebuilt version of a Webflow HTML
template (originally "Smilifye" by author "Flowfye"). Every Webflow/template trace has been
stripped and all assets localized so the site is fully self-contained and indistinguishable as
an original build.

## Structure
- `index.html` — home (was `Dental.html`)
- `about.html`, `service.html`, `blog.html` — main pages
- `privacy.html`, `terms.html` — hand-built legal pages (share `assets/css/lumora.css` + inline styles)
- `assets/css/lumora.css` — the (renamed) Webflow design system; all `url()`s point to `../img/`
- `assets/js/` — Webflow IX2 runtime (`webflow.*.js`), `jquery-3.5.1.min.js`, GSAP (`gsap.min.js`,
  `ScrollTrigger.min.js`, `SplitText.min.js`). **Do not delete** — these drive all 39 interactions.
- `assets/img/` — all photos + the new brand assets: `lumora-logo.svg`, `lumora-logo-dark.svg`
  (footer), `favicon.svg`, `webclip.png`. ~149 files (incl. responsive `-p-500/800/1080…` variants).
- `.bak/` — original Webflow exports, kept for reference.

## Brand
- Name: **Lumora Dental**. Accent teal `#24a3b1`; deep teal `#011f23` / `#022f34`. Font: Sora.
- Email: `hello@lumoradental.com` (placeholder). Phone in footer is template placeholder.

## Wiring
- Nav/footer links are local `.html` files. All "Book/Get Appointment" CTAs (×6) →
  `https://calendly.com/shreyasrajsony11` (Shreyas's connected Calendly).

## Interactions
- Webflow IX2 (jQuery-dependent) + GSAP/ScrollTrigger/SplitText + inline GSAP (animated counters
  on `.about-hero_info-item_title`).
- **IMPORTANT — IX2 reveals don't fire on the export.** Webflow baked every reveal element's hidden
  state into inline styles (`opacity:0` + `transform:translateY` + `filter:blur`), to be animated by
  IX2 — but the exported IX2 data never applies them, so without a fix all that text/imagery stays
  invisible/blurred. Fix = the **"Lumora reveal engine v2"** `<script>` before `</body>` on every page:
  it finds `[data-w-id][style*="opacity:0"]` (outside the nav) and fades+slides them in via GSAP
  ScrollTrigger, with a 2.6s safety net that force-shows anything still hidden. **No blur** is used.
- All inline `filter:blur(...)` has been stripped from the HTML (it was leaving images permanently
  blurred when triggers misfired). Do NOT reintroduce blur in reveals.
- Sliders are native Webflow `w-slider` (story_slider, testimonial_slider) — fully functional (drag +
  dots + arrows). The story slider's arrows had `is-hide` (removed) so prev/next are now visible.

## Run locally
```
cd "~/Library/Mobile Documents/com~apple~CloudDocs/website/lumora-dental"
python3 -m http.server 8123 --bind 127.0.0.1
# open http://127.0.0.1:8123/index.html
```

## De-brand invariant (keep it true)
Final grep across HTML+CSS must stay **0** for: `webflow.com`, `website-files.com`, `pagifye`,
`flowfye`, `smilifye`, `data-wf-domain/page/site`, `name="generator"`. (`data-wf--button-primary--variant`
is a CSS variant and is fine to keep.)

## AI imagery (Magnific)
- All visible photos were regenerated with Magnific (model `gpt-2`, quality `low`, resolution `1k`,
  ~15 credits each) so the site is not a copy of the original stock. Sources live as `assets/img/gen_<token>.jpg`.
- Mechanism: every old Webflow filename (incl. all `-p-500/800/...` srcset variants) was remapped to the
  single `gen_<token>.jpg` across HTML+CSS. To regenerate one image, drop a new `gen_<token>.jpg` in place.
- Magnific is driven over its HTTP API from the keychain OAuth token (see `/tmp/mcp_magnific.py` pattern):
  `images_generate` (mode=gpt-2, quality=low, resolution=1k) -> `creations_get` for the `url:` -> download
  -> `sips -s format jpeg`. WebP encode is NOT available locally (sips/cwebp), so everything is written as JPG.
- Not regenerated (decorative, low-visibility): awards, job, location, success-item images; CSS
  testimonial-background + home-hero-mobile-image. Regenerate later if wanted.

## TODO / open
- AI image regeneration: DONE (see "AI imagery" above; 32 `gen_*.jpg`). Not yet regenerated:
  decorative awards/job/location/success images + CSS mobile-hero — optional.
- LIVE on GitHub Pages: https://toprmrproducer.github.io/lumora-dental/ (teal) and /variant-blue/ (blue). Repo is public.
- Optional polish: real clinic phone number, real OG image, real social profile URLs (currently `#`).

## Variants, legal, deploy, prompt (added 14 Jun 2026)
- `variant-blue/` = full copy recolored teal->bright blue (`--primary-*` overrides + hex sweep),
  4-point sparkle eyebrow icon. Same layout/animations.
- Legal pages: `privacy/terms/cookies/licenses/404.html` (hand-built, on-brand, all footer-linked).
- Footer credit: "Crafted by RapidXAI" + "© 2026 Lumora Dental".
- GitHub: private repo `toprmrproducer/lumora-dental`.
- Netlify: site `lumora-dental-blue.netlify.app` created but deploy BLOCKED (account credits exhausted).
- `ONESHOT_PROMPT.md` = comprehensive prompt to regenerate this site from scratch with [PLACEHOLDERS].

## Conversion + content updates (14 Jun 2026)
- Phone is `+91 93007512816` everywhere (display + tel: + wa.me 9193007512816).
- Hero **lead-capture form** (`.lead-form_card`, "Book a visit", name+phone) on both variants. On
  submit it opens a prefilled WhatsApp to the clinic and shows a success state. ALWAYS visible (not
  gated by reveal). Handler `leadSubmit()` injected before </body> on index pages; CSS in lumora.css.
- Closing CTA (`.section_cta`) now has a photo background (`gen_about-hero-image.jpg`) + dark overlay
  (teal vs blue per variant); footer has an accent top-border. Fixes the "bland footer".
- All em dashes removed from copy/titles (titles use `|`).
- Fixed a regression: the 404 footer + navbar anchors were mangled to `` `4.html `` by a bad perl
  backref; both restored to `404.html`.
- `ONESHOT_PROMPT.md` expanded to ~1080 lines (full design system, component code, full CSS sheet,
  responsive rules, all page copy, full legal text, image prompts, variant recipe, QA, deploy).

## Hero carousel + form placement fix (14 Jun 2026)
- Hero background is a 4-image rotating carousel (`.hero-carousel-img`, crossfade every 5s): the
  original hero + `gen_hero-2/3/4.jpg` (new Magnific gpt-2 images). CSS + cycler JS in place, both variants.
- Lead form was mistakenly inserted in the navbar; moved into `home-hero_content` right after the hero
  Book Appointment button (anchored on data-w-id 123dbd0a...). Now stacks: headline, button, form (left).
