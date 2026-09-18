# West High Dentist — design contract

Public marketing site is the cloned Lumora template, rebranded. Do not restyle it.

## Widget (left bubble + voice orb)

- Sits above the cloned site. Does not restyle clinic pages.
- Resting state: one speech bubble, bottom-left, nothing else.
- Copy: “Now you don't need to call our clinic. Just click on the bubble and book your appointment.”
- Open state: dark glass panel, teal glow, VoicePoweredOrb, End call.
- Teal: `#24a3b1`. Deep: `#011f23`. Orb hue shifts when Maya or the caller speaks.

## Admin (`/admin`)

Linear-like dark operations desk, not a marketing page.

- Canvas `#0b0f12`
- Panel `#12181c`
- Line `#1e2a30`
- Text `#e8eef1`
- Muted `#8aa0aa`
- Accent `#24a3b1`
- Booked `#3dd68c`
- Missed `#e85d5d`
- Font: Sora / ui-sans-serif
- Density: table + detail, not cards for everything
- Login is the only unauthenticated screen
