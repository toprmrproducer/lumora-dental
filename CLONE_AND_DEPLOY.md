# Mola Dental — Clone & Deploy (the reliable one-shot)

> **READ THIS FIRST. This is not a "build" task. The finished website already exists in a public Git
> repo. Your job is to CLONE it and DEPLOY it, byte-for-byte. Do NOT recreate it, do NOT redesign it,
> do NOT use a framework. If you start scaffolding React/Vue/Next/Astro/Vite/Tailwind, you have already
> failed — stop and just clone the repo.**

The site is a plain static site (multi-page `.html` + one CSS + vanilla JS + GSAP + jQuery + the
Webflow IX2 runtime). It opens by double-clicking `index.html` or via `python3 -m http.server`. There
is **no build step**, no `npm install`, no dev server, no bundler. A `localhost:5173` (Vite) output is
an automatic failure.

**Source of truth (public):** `https://github.com/toprmrproducer/lumora-dental`
**Live reference (what the result must look like):** `https://toprmrproducer.github.io/lumora-dental/`

The repo is fully self-contained: all 8 JS libs, ~186 images (including 37 AI-generated `gen_*.jpg`
photos), both color variants (teal at root, blue in `variant-blue/`), and all legal pages are
committed. Cloning gets you the real photos, so the site looks finished and "redone" out of the box —
**you never need to generate a single image.** Even if some image ever fails to load, every page has
a small inline image-guard script (just before `</body>`) that swaps it to an on-brand gradient SVG
card, so nothing ever shows a gray box, a red box, or a broken-image icon.

All JS is plain and either a vendored library in `assets/js/` (jQuery, GSAP, the Webflow IX2 runtime)
or a small inline `<script>` before `</body>` on each page (the "reveal engine v2" that fades sections
in, the `lumoraLead` lead-form handler, and the image guard). There is no `app.js` and no build output.

---

## STEP 1 — Clone the repo (Mac, Windows, or Linux)

You need `git`. Pick the block for your OS. Replace nothing in the URL.

**macOS / Linux (Terminal):**
```bash
git clone https://github.com/toprmrproducer/lumora-dental.git
cd lumora-dental
```

**Windows (PowerShell or CMD):**
```powershell
git clone https://github.com/toprmrproducer/lumora-dental.git
cd lumora-dental
```

**No git installed?** Download the ZIP instead and unzip it:
- Browser: open `https://github.com/toprmrproducer/lumora-dental/archive/refs/heads/main.zip`, unzip,
  and `cd` into the unzipped `lumora-dental-main` folder.
- macOS/Linux one-liner: `curl -L -o lumora.zip https://github.com/toprmrproducer/lumora-dental/archive/refs/heads/main.zip && unzip lumora.zip && cd lumora-dental-main`
- Windows PowerShell: `Invoke-WebRequest https://github.com/toprmrproducer/lumora-dental/archive/refs/heads/main.zip -OutFile lumora.zip; Expand-Archive lumora.zip -Force; cd lumora-dental-main\lumora-dental-main`

After this you have the COMPLETE site on disk. Do not modify the structure.

---

## STEP 2 — Run it locally (verify before deploying)

Static site, so any static server works. Easiest is Python (preinstalled on macOS, available on Windows).

**macOS / Linux:**
```bash
python3 -m http.server 8123 --bind 127.0.0.1
# open http://127.0.0.1:8123/index.html
```

**Windows:**
```powershell
python -m http.server 8123
# open http://127.0.0.1:8123/index.html
```

**No Python?** Use Node (`npx serve .`) or VS Code "Live Server", or literally double-click
`index.html` (most things work from `file://`; a few images/animations need a server, which is why the
http.server option above is preferred).

Confirm in the browser: the hero headline is visible, the hero "Book a visit" form shows, sections
fade in as you scroll, both sliders (story + testimonials) drag, the animated number counters run, and
photos load. The teal site is the root; the blue variant is at `/variant-blue/`.

---

## STEP 3 — Deploy it (choose ONE)

### Option A — GitHub Pages (free, recommended; needs a free GitHub account)
1. On GitHub, **Fork** `toprmrproducer/lumora-dental` into your own account (button top-right), OR
   create a new empty repo and push this code to it:
   ```bash
   # from inside the cloned folder, pointing at YOUR new empty repo:
   git remote set-url origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
   git push -u origin main
   ```
2. In your repo: **Settings → Pages → Build and deployment → Source: "Deploy from a branch" →
   Branch: `main` / folder: `/ (root)` → Save.**
3. Wait ~1 minute. Your site is live at `https://<YOUR_USERNAME>.github.io/<YOUR_REPO>/`.
   (A `.nojekyll` file is already in the repo so GitHub serves it as-is.)

### Option B — Netlify (free, drag-and-drop, no git needed)
- Go to `https://app.netlify.com/drop` and drag the whole cloned folder onto the page. Done — you get
  a live URL in seconds. (Build command: none. Publish directory: the folder itself.)

### Option C — Vercel (free)
- `npx vercel --prod` from inside the folder, or import the GitHub repo in the Vercel dashboard. When
  asked for a framework, choose **"Other"** (it is NOT a framework app). Build command: leave empty.
  Output directory: `.` (root).

### Option D — any static host / your own server
- Upload the folder contents (everything: `*.html`, `assets/`, `variant-blue/`, `.nojekyll`) to any
  web root. No server-side runtime needed.

---

## STEP 4 — Make it yours (optional re-skin — still no rebuild)

Everything below is plain find-and-replace on the cloned files. The structure, animations, and layout
stay exactly as-is. Do these edits in a code editor across all `.html` files (and `assets/css/lumora.css`
for color). **Never** swap the stack or "modernize" — just change text, links, colors, and images.

1. **Brand name:** find `Mola Dental` (and standalone `Lumora`) across all `.html` → your business name.
2. **Logo:** replace `assets/img/lumora-logo.svg` and `assets/img/lumora-logo-dark.svg` (footer) with
   your own SVG/PNG of the same dimensions. Replace `assets/img/favicon.svg` + `webclip.png` too.
3. **Booking CTA:** find `https://cal.com/shreyasrajsony11-ukmj10/dental-clinic-test-call` (×6) → your Calendly/booking URL.
4. **Phone / WhatsApp:** find `01143177002` (and `9193007512816` if present) → your number (the lead
   form opens a prefilled WhatsApp on submit — handled by the inline `lumoraLead` script before
   `</body>` on each index page).
5. **Email:** find `hello@moladental.com` → your email.
6. **Copy:** edit headings/paragraphs in the `.html` files directly. They're readable, plain HTML.
7. **Color:** the theme is driven by CSS custom properties. In `assets/css/lumora.css`, change the
   `--primary-*` values (and the appended hex overrides) — the whole site recolors. The `variant-blue/`
   folder is a worked example of exactly this (teal → bright blue).
8. **Images:** to swap a photo, drop a replacement at the SAME path/filename in `assets/img/`
   (most visible photos are `gen_<token>.jpg`). Keep the same aspect ratio so layout is unaffected.
   - **Worst case — you have NO replacement images:** do nothing. The cloned repo already ships with
     real AI-generated photos, so it looks complete. If you delete an image without replacing it, the
     inline image guard (a small `<script>` before `</body>` on each page) auto-fills that slot with a
     clean on-brand gradient SVG card (business name on a brand gradient) — it reads as intentional,
     never as broken. Do not point images at random
     stock services (loremflickr/picsum/unsplash); they return off-topic photos and look broken.

After any edits: re-run STEP 2 to eyeball it, then re-deploy (commit + push if on Pages/Vercel, or
re-drag the folder for Netlify).

---

## STEP 5 — Self-verify before calling it done

Open the deployed URL (not just localhost) in a browser and confirm, on BOTH the home page and one
inner page:
- [ ] Hero headline (`<h1>`) is visible immediately (not blank, not invisible).
- [ ] Hero "Book a visit" form is visible and, on submit, opens a prefilled WhatsApp/booking action.
- [ ] Scrolling down fades sections in; the number counters animate.
- [ ] Both sliders (story + testimonials) drag and have working arrows/dots.
- [ ] Every photo loads (no gray boxes, no red boxes, no broken-image icons).
- [ ] Nav links and all "Book/Get Appointment" CTAs go to the right pages / your booking link.
- [ ] DevTools Console shows no fatal errors.
- [ ] `variant-blue/` loads too (if you're shipping the blue variant).

Quick console check for invisible content / broken images (paste in DevTools console on the live page):
```js
console.log('hidden:', [...document.querySelectorAll('h1,h2,h3,p,img')].filter(e=>getComputedStyle(e).opacity==='0').length);
console.log('broken imgs:', [...document.images].filter(i=>i.complete && i.naturalWidth===0).length);
console.log('has H1 text:', !!document.querySelector('h1') && document.querySelector('h1').textContent.trim().length>0);
```
All three should read `0`, `0`, `true`. If not, you edited something — revert that edit; the pristine
clone passes this.

---

## Why this prompt instead of pasting all the code

Earlier handoffs embedded the entire source in the prompt, and executing agents kept "improving" it
into a Vite/React app with random stock images and missing scroll components. A `git clone` removes
all of that freedom: you get the exact, finished, deployed site — every animation, every AI image,
both color variants — and only deploy (and optionally rebrand) it. There is nothing to reinterpret.
