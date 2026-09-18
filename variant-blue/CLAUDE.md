# Westside Dentist — project notes

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
- Name: **Westside Dentist**. Accent teal `#24a3b1`; deep teal `#011f23` / `#022f34`. Font: Sora.
- Email: `hello@moladental.com` (placeholder). Phone in footer is template placeholder.

## Wiring
- Nav/footer links are local `.html` files. All "Book/Get Appointment" CTAs (×6) →
  `https://cal.com/shreyasrajsony11-ukmj10/dental-clinic-test-call` (Shreyas's connected Calendly).

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
- **AI image regeneration (Magnific):** not done — Magnific MCP was not connected. When connected,
  regenerate hero (`…dentist-examining-patients-teeth-close-up_1.webp`), about hero, team photos,
  testimonial avatars, then story/service/blog thumbs. Keep identical dimensions so layout/IX2 hold.
- Optional polish: real clinic phone number, real OG image, real social profile URLs (currently `#`).
