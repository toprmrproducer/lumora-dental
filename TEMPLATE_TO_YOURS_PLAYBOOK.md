# TEMPLATE-TO-YOURS: turn ANY template into an original, branded, deployed site

> WHAT THIS IS
> A complete, reusable prompt + playbook. Paste the whole thing into any capable coding agent
> (Claude Code, Cursor, Windsurf), point it at any exported/purchased HTML template (Webflow, Framer,
> Wix export, a ThemeForest HTML kit, anything) and any business type (roofer, plumber, dentist, med
> spa, law firm, gym, SaaS), fill the INPUTS block, and it reproduces exactly what was done for the
> "Mola Dental" build: a self-contained, de-branded, rebranded site with original AI imagery, a
> working lead-capture form, fixed animations, legal pages, an optional color variant, and a live
> deploy. It is template-agnostic and industry-agnostic.
>
> This file has two parts:
>   PART A: the paste-in PROMPT (give this to the agent).
>   PART B: the human operator notes (why each step exists, the gotchas, the exact code snippets).

================================================================================
BULLETPROOF ADDENDUM (read first; overrides anything below on conflict)
================================================================================
The output must look complete and polished on the first run, for anyone, even if a step fails:
1. VISIBLE BY DEFAULT. The finished page must render fully with JavaScript OFF. For a from-scratch
   build, never put `opacity:0` in HTML/CSS; animate with `gsap.from(..., {immediateRender:false,
   once:true})`. For a converted template that already ships baked `opacity:0` on `[data-w-id]`
   elements, FIRST clear it so content is visible, THEN animate in, and keep a 2.6s safety net that
   force-shows anything still at opacity 0. The hero H1 and every heading must never be blank.
   Failsafe reveal for the conversion case:
   ```js
   els.forEach(function(el){
     gsap.set(el,{clearProps:'opacity,transform,filter'});           // visible by default
     gsap.from(el,{opacity:0,y:40,duration:.9,ease:'power2.out',immediateRender:false,
       scrollTrigger: hasST ? {trigger:el,start:'top 94%',once:true} : undefined});
   });
   setTimeout(function(){ els.forEach(function(el){
     if(parseFloat(getComputedStyle(el).opacity)===0){el.style.opacity='1';el.style.transform='none';} }); },2600);
   ```
2. NEVER SHIP BROKEN IMAGES. If the image tool is unavailable, fall back automatically to a reliable
   stock/placeholder source (`https://loremflickr.com/1280/720/<industry>,clinic` or
   `https://picsum.photos/seed/<slot>/1280/720`), downloaded locally; last resort a brand-gradient SVG.
   No empty gray boxes, ever. Do not stop to ask.
3. ANIMATIONS ARE CODE, NOT WORDS. Include hover CSS (buttons + cards lift, image zoom, nav underline,
   slider arrow hover) and the scroll-reveal JS verbatim.
4. SELF-VERIFY before done: on every page, confirm no element is at opacity 0, no `<img>` has
   naturalWidth 0, and an `<h1>` exists. Fix before declaring done.

================================================================================
PART A — THE PROMPT (paste everything in this part into the agent)
================================================================================

You are a senior front-end engineer + brand designer. I will give you an exported HTML website
template and a business. Your job: transform the template into a fully original, self-contained,
conversion-optimized website for my business, remove every trace that it came from a template or
website builder, replace all imagery with AI-generated originals, fix the common export bugs, and
deploy it. Work autonomously through every step and verify in a real browser before declaring done.

## INPUTS (I fill these in)
```
[TEMPLATE_PATH]    = path/folder of the exported template (HTML/CSS/JS), or a URL to fetch
[BUILDER]          = the source builder if known (Webflow / Framer / Wix / generic HTML). If unknown, detect it.
[BUSINESS_TYPE]    = e.g. "roofing company" / "plumbing service" / "dental clinic" / "law firm"
[BUSINESS_NAME]    = e.g. "Summit Roofing"
[SHORT_NAME]       = one-word brand for the logo, e.g. "Summit"
[TAGLINE]          = short promise, e.g. "Roofs Built to Last"
[EMAIL]            = contact email
[PHONE_DISPLAY]    = e.g. "+1 (555) 120-8787"   (exactly as shown to users)
[PHONE_TEL]        = same digits, no spaces/symbols, for tel:/wa.me e.g. "+15551208787"
[WHATSAPP_NUMBER]  = digits only for wa.me, e.g. "15551208787"
[BOOKING_URL]      = scheduling link (Calendly etc.) for every primary CTA
[ACCENT]           = primary brand color hex (the template's accent, or a new one)
[INK_DARK]         = deep brand dark hex (for dark sections + body text)
[CREDIT]           = footer maker credit, e.g. "Crafted by RapidXAI"
[IMAGE_TOOL]       = the image model/MCP to use (e.g. Magnific gpt-2, quality low, 1k). If none, ask me to connect one.
[DEPLOY_TARGET]    = "GitHub Pages" (default) / "Netlify" / "Vercel"
[GITHUB_OWNER]     = github account to push to
[REPO_VISIBILITY]  = "private" or "public" (Pages on a free plan needs public)
```
Treat `[SHORT_NAME]` as the only thing that visibly defines the brand in copy. Anywhere the template
refers to itself, replace with `[SHORT_NAME]`. Keep all the template's layout, animations, and "feel".

## NON-NEGOTIABLE PRINCIPLES
1. Self-contained: download every asset (CSS, JS, fonts optional, images, icons) into local `assets/`.
   Zero runtime calls to the builder's CDN. Google Fonts via `<link>` is the only allowed remote.
2. Indistinguishable: a final grep over all HTML+CSS+JS must return ZERO for any builder fingerprint
   (see the de-brand invariant in step 3). It must not be identifiable as that template.
3. Nothing ever invisible: animations may reveal content, but a safety net guarantees everything ends
   visible. Conversion elements (the lead form) are NEVER gated behind a scroll trigger.
4. No blur in reveals. Fade + slide only. Strip any baked-in `filter:blur` from the export.
5. Original imagery: every visible photo is AI-generated so the site is not a copy of the template's
   stock. Keep identical dimensions/aspect ratios so layout and animations hold.
6. Conversion-first: the hero has a lead-capture form (name + phone, "callback in 10 minutes") in
   addition to the primary booking CTA. Every page funnels to booking/contact.
7. Verify RENDERED layout, not just presence. After any change, check the element's actual on-screen
   position (bounding boxes / screenshot) against intent, not merely that it exists or is visible.
8. No em dashes anywhere (copy, titles, meta, comments). Use commas, periods, or a pipe.
9. After EVERY change, test in a real browser (Playwright): load the page, interact with the feature,
   check the console. "It deployed" or "zero errors in a log" is not a test.

## STEP-BY-STEP

### Step 0 — Set up
- Copy the template into a clean project folder named after the brand (e.g. `summit-roofing/`).
- Inventory the files: list every HTML page, the CSS, the JS, and every image (including responsive
  `-p-500/800/...` srcset variants). Identify the builder from comments, meta `generator`, and
  data attributes (Webflow uses `data-wf-*` + `webflow.js`; Framer uses `framerusercontent.com`; etc.).
- Rename the home file to `index.html` if needed.

### Step 1 — Localize ALL remote assets (kills the builder CDN footprint)
- Extract every remote URL referenced in the HTML and the CSS (CSS often hides background images!).
- Download each into `assets/css/`, `assets/js/`, `assets/img/`. Rewrite every reference to a relative
  local path. Drop `integrity`/`crossorigin` attributes (renamed/edited files fail SRI checks).
- KEEP the builder's runtime JS if the template's animations depend on it (e.g. Webflow's `webflow.js`
  + jQuery + GSAP). Serving it locally is fine and preserves the "feel"; the goal is removing the
  builder's hosted-domain calls and visible branding, not re-implementing the engine.
- Re-scan the CSS specifically for `url(...)` images and localize those too.

### Step 2 — Detect and fix common export bugs (do this every time)
Exports frequently ship broken. Check and fix all of these:
- **Reveal animations do not fire.** Builders bake each reveal element's hidden start state into inline
  styles (`opacity:0` + `transform:translateY(...)` + sometimes `filter:blur(...)`) and rely on the
  builder's interaction engine to animate them in, which often does not run on the export. Result:
  text/images stay invisible or blurred. FIX: add a small GSAP "reveal engine" (full code in PART B)
  that finds those hidden elements (outside the nav) and fades+slides them in, with a safety-net
  timeout that force-shows anything still hidden. Use fade + slide only, NO blur.
- **Stuck blur.** Strip every inline `filter:blur(...)` from the HTML and any blur in your reveal code,
  or images stay permanently blurry when a trigger misfires.
- **Hidden slider arrows / dead sliders.** Builder sliders often hide the prev/next arrows
  (e.g. an `is-hide` class). Un-hide them; confirm drag + dots + arrows all change slides.
- **Mangled links.** After any find/replace on anchors, grep to confirm you did not corrupt tags
  (a bad regex backreference once turned `404.html` into a broken `` `4.html ``). Verify every anchor.

### Step 3 — Strip every builder/template fingerprint (de-brand invariant)
Remove from every page:
- Builder HTML comments (e.g. "This site was created in Webflow"), the `<meta name="generator">`,
  builder identity attributes on `<html>` (e.g. `data-wf-domain/page/site`).
- The template's name everywhere (title, headings, copy, alt text), and the original author/agency
  name.
- Any floating "made with / buy this template / powered by" badge or sales widget the template author
  embedded (these are the biggest giveaways).
- Builder-template showcase nav items (styleguide, instructions, 404 demo links, "more templates").
Keep only harmless functional attributes (e.g. a CSS variant attribute). Then enforce the invariant:
```
grep -ri -E 'webflow|framer|wix|website-files|builder-domain|name="generator"|<TEMPLATE_NAME>|<AUTHOR_NAME>' .
```
must return ZERO across HTML+CSS+JS (allow only documented harmless exceptions you list).

### Step 4 — Rebrand
- Replace the template name with `[BUSINESS_NAME]`/`[SHORT_NAME]`; rewrite hero/section copy to fit
  `[BUSINESS_TYPE]` (keep structure, swap the words to the new industry).
- Logo: author an SVG wordmark "[SHORT_NAME]" + a small industry-appropriate mark, in `[ACCENT]`.
  Provide a DARK-text version (for light backgrounds) and a WHITE version (for nav over hero + footer).
- Favicon: a rounded-square SVG in `[ACCENT]`→`[INK_DARK]` gradient with a white mark; rasterize a
  180px PNG apple-touch-icon.
- Email/phone: set `[EMAIL]`, `[PHONE_DISPLAY]`, and wire `tel:[PHONE_TEL]`.

### Step 5 — Recolor to the brand (token-driven)
- If the CSS uses color custom properties (e.g. `--primary-500`), override those tokens at the end of
  the stylesheet to your palette. That recolors most usages at once.
- Then sweep any hardcoded brand hexes in CSS/HTML/SVGs from the template's palette to yours.
- (Optional) produce a second color VARIANT by duplicating the project and swapping the token ramp +
  a hex sweep. Same layout, distinct identity.

### Step 6 — Replace ALL imagery with AI originals
- For each photo slot, write an industry-specific prompt (for roofing: crews on roofs, shingles,
  inspections, before/after, happy homeowners; for plumbing: clean fixtures, a plumber at work, a tidy
  van, a kitchen install; etc.). Append a consistent style suffix:
  "photorealistic, premium advertising photography, natural light, shallow depth of field, high
  detail, no text."
- Generate with `[IMAGE_TOOL]` at the cheapest viable setting (e.g. Magnific `gpt-2`, quality low,
  resolution 1k), matching each slot's aspect ratio. If no image tool is connected, STOP and tell me
  to connect one (do not ship the template's stock photos).
- KEY TRICK for self-contained swaps without touching layout: save each new image as
  `gen_<slot>.jpg`, then remap EVERY old filename for that slot, including all responsive `-p-500/800`
  srcset variants, to the single `gen_<slot>.jpg` across HTML + CSS. Browsers accept duplicate srcset
  candidates pointing at one file. (If you can only write JPG, convert and update the extension in the
  references.)
- Match genders/age in any named people cards to the generated portraits (rename labels if needed).
- (Optional) a rotating hero carousel: generate 3 to 4 wide hero images and crossfade them (code in
  PART B).

### Step 7 — Add the conversion lead form to the hero
- A white card titled "Book a visit"/"Get a quote" (fit the industry) with name + phone fields and a
  "Request a callback" button. On submit: validate, open a prefilled WhatsApp message to
  `[WHATSAPP_NUMBER]`, then swap to a success state ("we will call you within 10 minutes").
- Place it in the hero's main content column, directly UNDER the headline + primary button. Do NOT let
  it inherit a navbar/grid parent that floats it elsewhere. After inserting, verify its bounding box is
  below the button and left-aligned with the headline.
- It must be ALWAYS visible (never behind a scroll reveal). Theme it with the color tokens so it adapts
  to any variant. Full code in PART B.

### Step 8 — Hero "above the fold" pass
- Make sure that on load, the hero shows the headline, the primary CTA, the lead form, AND the key
  contact/trust strip (hours, emergency contact, etc.) if the template has one. Reduce excessive hero
  top padding and tighten spacing so the important stuff is visible without scrolling. Verify at a
  realistic desktop viewport (e.g. 1512x950) that the strip's bounding box is within the viewport and
  does not overlap the form.

### Step 9 — Wire navigation, CTAs, contact
- Rewrite route-style hrefs (`/about`, `/services`) to local `.html` files.
- Point every "Book/Get/Request/Quote" CTA to `[BOOKING_URL]` (or the callback form).
- Build the legal pages the footer links to so there are no dead links: Privacy, Terms, Cookies,
  Licenses, and a real 404. Keep them on-brand and readable (real copy, no lorem). Add the `[CREDIT]`
  line in the footer.
- If the footer reads bland, upgrade it: dark brand background, accent top border, white logo + light
  links, prominent contact, tidy columns.

### Step 10 — QA in a real browser (Playwright), fix everything it finds
1. Every page: ZERO console errors, ZERO requests to the builder CDN (only Google Fonts allowed).
2. ALL text visible (hero H1, every section heading + paragraph). Nothing stuck at opacity 0.
3. NO image blurry or broken (every `<img>` has `naturalWidth>0`; computed `filter` has no live blur).
4. Reveals fire on scroll; any counters animate; sliders (arrows + dots + drag) change slides.
5. Lead form: filling name + phone and submitting hides the form, shows success, opens the prefilled
   `wa.me/[WHATSAPP_NUMBER]` message.
6. Hero above-the-fold: headline + CTA + form + contact strip all visible on load; form sits under the
   button (check bounding boxes).
7. Every nav/footer link resolves (including all legal/404 pages). No dead or malformed anchors.
8. Phone shows `[PHONE_DISPLAY]` everywhere; `tel:` uses `[PHONE_TEL]`.
9. The nav logo is the WHITE version and readable over the hero.
10. Final grep: zero builder fingerprints, zero em dashes.
11. Mobile: test at 390x844; no text touching edges, no overflow, nav collapses.
12. If a color variant exists, run 1 to 11 on it too.

### Step 11 — Deploy and verify LIVE
- `git init`, commit, push to `[GITHUB_OWNER]` (`[REPO_VISIBILITY]`). Add an empty `.nojekyll` so Pages
  serves `assets/` and any variant folder verbatim. Enable Pages (branch main, path /). For Netlify/
  Vercel, deploy the project root.
- WAIT for the build, then open the LIVE url in a browser and re-run the key QA checks (hero, form,
  images, no console errors). Report the live url. Note CDN propagation can take ~60s.

### DONE WHEN
All of Step 10 passes on the live url, the de-brand grep is zero, every image is AI-generated, the
lead form works end to end, and the site is visually original and on-brand for `[BUSINESS_TYPE]`.

================================================================================
PART B — OPERATOR NOTES + REUSABLE CODE (the "why" and the exact snippets)
================================================================================

## The mental model
A purchased/exported template is 90% of a great site: layout, spacing, animation timing, component
design. The 10% that makes it "yours" and not a copy is: (1) remove the builder/author fingerprints,
(2) replace the imagery with originals, (3) recolor + rename to your brand, (4) fix the export bugs,
(5) add real conversion mechanics, (6) host it yourself. This playbook automates that 10%.

## The single biggest "looks like a copy" tells (kill these first)
- The builder's hosted CDN domain in asset URLs (localize everything).
- A floating "buy this template / made with X / powered by Y" badge (delete the whole widget).
- The template's name in the <title> and the author's name in the footer credit.
- The exact same stock photos every other buyer uses (regenerate all imagery).
- Generator meta tag + builder data-attributes on <html>.

## Reusable: the reveal engine (paste before </body> on every page)
```html
<script src="assets/js/gsap.min.js"></script>
<script src="assets/js/ScrollTrigger.min.js"></script>
<script>
(function () {
  function run() {
    if (!window.gsap) return;
    var hasST = !!window.ScrollTrigger; if (hasST) gsap.registerPlugin(ScrollTrigger);
    // target elements the builder left hidden (inline opacity:0), excluding the nav.
    var els = gsap.utils.toArray('[data-w-id][style*="opacity:0"], [data-reveal]').filter(function(el){
      return !el.closest('.nav') && !el.closest('.navbar_wrap') && !el.closest('.w-nav');
    });
    els.forEach(function (el) {
      gsap.set(el, { clearProps: 'transform,filter' });
      gsap.fromTo(el, { opacity:0, y:40 }, { opacity:1, y:0, duration:.9, ease:'power2.out',
        scrollTrigger: hasST ? { trigger: el, start:'top 96%', once:true } : undefined });
    });
    if (hasST){ window.addEventListener('load', function(){ ScrollTrigger.refresh(); }); ScrollTrigger.refresh(); }
    setTimeout(function(){ els.forEach(function(el){
      if (parseFloat(getComputedStyle(el).opacity)===0) gsap.set(el,{opacity:1,y:0}); }); }, 2600); // safety net
  }
  document.readyState!=='loading' ? setTimeout(run,150)
    : document.addEventListener('DOMContentLoaded', function(){ setTimeout(run,150); });
})();
</script>
```

## Reusable: strip baked-in blur (run over every HTML file)
Remove inline `filter:blur(...)` (and `-webkit-/-moz-/-ms-` variants) so nothing stays blurry:
```
perl -0777 -pi -e 's/(-webkit-|-moz-|-ms-)?filter:\s*blur\([^)]*\)\s*;?//g;' *.html
```

## Reusable: the hero lead form (HTML + CSS + JS)
HTML (place in the hero's main content column, right after the primary button):
```html
<div class="lead-form_card">
  <div class="lead-form_head">
    <div class="lead-form_title">Book a visit</div>
    <div class="lead-form_sub">Get a callback within 10 minutes</div>
  </div>
  <form class="lead-form" onsubmit="return leadSubmit(event)">
    <input class="lead-form_input" type="text" name="name" placeholder="Your name" required/>
    <input class="lead-form_input" type="tel" name="phone" placeholder="Phone number" required/>
    <button class="lead-form_btn" type="submit">Request a callback</button>
    <div class="lead-form_note">No spam. A real person calls you back, fast.</div>
  </form>
  <div class="lead-form_success" style="display:none">
    <div class="lead-form_title">Thanks! You're all set.</div>
    <div class="lead-form_sub">Our team will call you within 10 minutes.</div>
  </div>
</div>
```
CSS (uses your color tokens so it themes automatically):
```css
.lead-form_card{margin-top:24px;max-width:430px;background:#fff;border-radius:20px;padding:24px 24px 20px;box-shadow:0 28px 70px rgba(2,47,52,.30);}
.lead-form_title{font-size:21px;font-weight:600;color:var(--primary-900,#011f23);letter-spacing:-.4px;}
.lead-form_sub{font-size:14px;color:#5d6c7b;margin-top:3px;}
.lead-form{display:flex;flex-direction:column;gap:11px;margin-top:16px;}
.lead-form_input{height:50px;border:1px solid #e4e8ea;border-radius:12px;padding:0 16px;font:15px inherit;color:#011f23;background:#fafcfc;outline:none;transition:border-color .2s,background .2s;}
.lead-form_input:focus{border-color:var(--primary-500,#24a3b1);background:#fff;}
.lead-form_btn{height:52px;border:none;border-radius:999px;background:var(--primary-900,#011f23);color:#fff;font:600 15px inherit;cursor:pointer;transition:transform .15s,background .2s;}
.lead-form_btn:hover{background:var(--primary-500,#24a3b1);transform:translateY(-1px);}
.lead-form_note{font-size:12px;color:#9aa6ad;text-align:center;}
@media(max-width:991px){.lead-form_card{max-width:100%;}}
```
JS:
```html
<script>
function leadSubmit(e){
  e.preventDefault();
  var f=e.target;
  var name=(f.querySelector('input[name="name"]').value||'').trim();
  var phone=(f.querySelector('input[name="phone"]').value||'').trim();
  if(!name||!phone) return false;
  var msg=encodeURIComponent("Hi [BUSINESS_NAME], I'm "+name+". Please call me back at "+phone+".");
  try{ window.open("https://wa.me/[WHATSAPP_NUMBER]?text="+msg,"_blank"); }catch(_){}
  var card=f.closest('.lead-form_card');
  if(card){ f.style.display='none';
    var h=card.querySelector('.lead-form_head'); if(h) h.style.display='none';
    var ok=card.querySelector('.lead-form_success'); if(ok) ok.style.display='block'; }
  return false;
}
</script>
```
Upgrade option: also POST the lead to a backend/Supabase/Tally/form service to store it in a CRM.

## Reusable: hero background carousel (crossfade)
Stack several `<img class="hero-carousel-img">` (first one also `is-active`) inside the hero image
container, then:
```css
.hero-carousel-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.4s ease;}
.hero-carousel-img.is-active{opacity:1;}
```
```html
<script>
(function(){function start(){var im=document.querySelectorAll('.hero-carousel-img');if(im.length<2)return;
var i=0;setInterval(function(){im[i].classList.remove('is-active');i=(i+1)%im.length;im[i].classList.add('is-active');},5000);}
document.readyState!=='loading'?start():document.addEventListener('DOMContentLoaded',start);})();
</script>
```

## Reusable: image swap-by-overwrite (no layout edits)
For each logical image `<slot>`: generate, save `assets/img/gen_<slot>.jpg`, then in all HTML+CSS
replace every old filename that matches `_<slot>(\.|-p-)` (base + all responsive variants) with
`gen_<slot>.jpg`. This recolors the whole site's imagery without touching a single layout rule.

## Reusable: color recolor recipe
1. Override the token ramp at the end of the stylesheet:
   `:root{ --primary-400:..; --primary-500:[ACCENT]; --primary-600:..; --primary-900:[INK_DARK]; }`
2. Hex-sweep the template's hardcoded brand hexes (CSS + HTML + SVGs) to your palette.
3. For a second variant: duplicate the folder, swap the ramp, sweep hexes, optionally change a section
   icon. Same layout, new identity.

## Gotchas catalog (learned the hard way, check every build)
- Inserted elements inherit the nearest grid/flex parent. After inserting (e.g. the lead form), verify
  the RENDERED position by bounding box, not just "is it visible". A form that floats to the navbar
  passes a naive visibility check but is wrong.
- The footer is often a builder-specific class (e.g. `.section_footer`), not `.footer`. Target the real
  class or your styles silently do nothing.
- A white logo is invisible on a light footer and vice-versa. Match the logo variant to the background.
- Phone numbers: keep a single source of truth and sweep all occurrences (display, tel:, wa.me). Watch
  for accidental extra digits.
- Builder sliders work but hide their arrows. Un-hide for usability.
- GitHub Pages: free plan needs a PUBLIC repo (or pay). Add `.nojekyll`. CDN can lag ~60s after a push.
- Always verify on the LIVE url after deploy, not just locally.

## One-line summary of the method
Localize, de-brand, fix the export bugs, regenerate the imagery, recolor + rename, add a real lead
form, build the legal pages, deploy, and verify live. Keep the template's bones; replace its skin and
its soul. That is how any template in the world becomes yours.
