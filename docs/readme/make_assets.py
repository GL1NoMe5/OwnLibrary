"""Generates the decorative SVG assets used by README.md (docs/readme/)."""
import os
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.join(ROOT, "icons")
DECOR = os.path.join(ROOT, "decor")
SRC_ILLU = os.path.join(ROOT, "..", "..", "src", "renderer", "public", "illustrations")
os.makedirs(ICONS, exist_ok=True)
os.makedirs(DECOR, exist_ok=True)

INK = "#4f4636"
CREAM = "#f3ead6"
OLIVE = "#6b7a5e"
SAGE = "#93a07f"
TERRA = "#b9775a"
GOLD = "#d9a95b"
PLUM = "#8c5360"
SLATE = "#56677a"


def icon(name, body, bg=CREAM):
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">'
        f'<rect x="2" y="2" width="60" height="60" rx="16" fill="{bg}" stroke="#d8cbb0" stroke-width="2"/>'
        f"{body}</svg>"
    )
    with open(os.path.join(ICONS, name + ".svg"), "w", encoding="utf-8") as f:
        f.write(svg)


# --- feature icons -------------------------------------------------------
icon("candle", (
    f'<ellipse cx="32" cy="22" rx="9" ry="12" fill="{GOLD}" opacity=".25"/>'
    f'<path d="M32 12C27 19 28 25 32 27C36 25 37 19 32 12Z" fill="{GOLD}"/>'
    '<path d="M32 18C30 22 30 24 32 25C34 24 34 22 32 18Z" fill="#fff3cf"/>'
    f'<path d="M32 27V30" stroke="{INK}" stroke-width="1.6"/>'
    f'<rect x="25" y="30" width="14" height="22" rx="2.5" fill="#efe1c2" stroke="{INK}" stroke-width="1.6"/>'
    f'<path d="M25 35C28 37 30 34 32 37" fill="none" stroke="{INK}" stroke-width="1.2" opacity=".5"/>'
    f'<rect x="20" y="51" width="24" height="4" rx="2" fill="{TERRA}"/>'
))
icon("books", (
    f'<rect x="15" y="17" width="9" height="33" rx="1.5" fill="{OLIVE}"/>'
    f'<rect x="25" y="13" width="10" height="37" rx="1.5" fill="{PLUM}"/>'
    f'<rect x="36" y="20" width="8" height="30" rx="1.5" fill="{TERRA}"/>'
    f'<path d="M45 22L52 20L58 47L51 49Z" fill="{SLATE}" transform="translate(-4 1)"/>'
    f'<path d="M18 22H21M28 19H32M28 44H32M39 25H41" stroke="{GOLD}" stroke-width="1.6"/>'
    f'<rect x="11" y="50" width="42" height="3.5" rx="1.5" fill="{INK}"/>'
))
icon("journal", (
    f'<path d="M12 18Q22 14 31 19V49Q22 45 12 48Z" fill="#efe3c6" stroke="{INK}" stroke-width="1.6"/>'
    f'<path d="M52 18Q42 14 33 19V49Q42 45 52 48Z" fill="#e8d9b6" stroke="{INK}" stroke-width="1.6"/>'
    f'<path d="M16 25L27 27M16 30L27 32M16 35L24 36.5" stroke="{SAGE}" stroke-width="1.4"/>'
    f'<rect x="37" y="23" width="11" height="12" fill="#fff" stroke="{INK}" stroke-width="1" transform="rotate(6 42 29)"/>'
    f'<rect x="38.5" y="24.5" width="8" height="7" fill="{SAGE}" transform="rotate(6 42 29)"/>'
    f'<rect x="36" y="20" width="9" height="4" fill="{GOLD}" opacity=".75" transform="rotate(-14 40 22)"/>'
    f'<path d="M31 47V55L33.5 53L36 55V47" fill="{PLUM}"/>'
))
icon("quote", (
    f'<rect x="13" y="16" width="38" height="30" rx="5" fill="#efe3c6" stroke="{INK}" stroke-width="1.6"/>'
    f'<path d="M30 46L25 54L37 46" fill="#efe3c6" stroke="{INK}" stroke-width="1.6" stroke-linejoin="round"/>'
    f'<path d="M22 37C22 30 24 27 28 25M32 37C32 30 34 27 38 25" fill="none" stroke="{OLIVE}" stroke-width="3" stroke-linecap="round"/>'
    f'<circle cx="23.5" cy="35" r="3.6" fill="{OLIVE}"/><circle cx="33.5" cy="35" r="3.6" fill="{OLIVE}"/>'
))
icon("progress", (
    f'<circle cx="32" cy="32" r="17" fill="none" stroke="#e2d6bb" stroke-width="6"/>'
    f'<path d="M32 15A17 17 0 1 1 15.8 37.2" fill="none" stroke="{OLIVE}" stroke-width="6" stroke-linecap="round"/>'
    f'<path d="M32 26C29 30 29 35 32 39C35 35 35 30 32 26Z" fill="{SAGE}"/>'
    f'<path d="M32 39V43" stroke="{INK}" stroke-width="1.5"/>'
))
icon("card", (
    f'<rect x="20" y="10" width="24" height="44" rx="3.5" fill="#efe3c6" stroke="{INK}" stroke-width="1.6"/>'
    f'<path d="M25 17H39" stroke="{INK}" stroke-width="1.4"/>'
    f'<rect x="27.5" y="23" width="9" height="13" rx="1" fill="{OLIVE}"/>'
    f'<path d="M24 41H40M24 45H36" stroke="{SAGE}" stroke-width="1.4"/>'
    f'<path d="M45 13L46.5 16.5L50 18L46.5 19.5L45 23L43.5 19.5L40 18L43.5 16.5Z" fill="{GOLD}"/>'
))
icon("rain", (
    f'<path d="M19 37A8 8 0 0 1 21 21.5A11 11 0 0 1 42 20A8.5 8.5 0 0 1 45 37Z" fill="#dfe3dc" stroke="{SLATE}" stroke-width="1.6"/>'
    f'<path d="M22 42L20 48M31 42L29 50M40 42L38 48" stroke="{SLATE}" stroke-width="2.2" stroke-linecap="round"/>'
))
icon("radio", (
    f'<path d="M22 20L40 12" stroke="{INK}" stroke-width="1.6" stroke-linecap="round"/>'
    f'<rect x="12" y="20" width="40" height="28" rx="5" fill="{TERRA}" stroke="{INK}" stroke-width="1.6"/>'
    f'<rect x="17" y="25" width="20" height="18" rx="2.5" fill="#efe3c6"/>'
    f'<path d="M20 29H34M20 33H34M20 37H34" stroke="{TERRA}" stroke-width="1.3" opacity=".6"/>'
    f'<circle cx="44" cy="29" r="3.2" fill="{GOLD}"/><circle cx="44" cy="39" r="3.2" fill="#efe3c6"/>'
    f'<path d="M15 48V52M49 48V52" stroke="{INK}" stroke-width="2" stroke-linecap="round"/>'
))
icon("cat", (
    f'<ellipse cx="33" cy="43" rx="20" ry="5" fill="#e6dccb"/>'
    f'<path d="M14 40C14 29 24 25 34 26C44 27 50 32 50 39C50 42 47 43 44 43H18C15 43 14 42 14 40Z" fill="{TERRA}"/>'
    f'<path d="M15 34L14 25L21 30Z" fill="{TERRA}"/><path d="M24 30L25 22L30 28Z" fill="{TERRA}"/>'
    f'<path d="M17 37Q19 38.5 21 37M24 37Q26 38.5 28 37" fill="none" stroke="{INK}" stroke-width="1.3" stroke-linecap="round"/>'
    f'<path d="M50 39C55 38 55 45 46 45" fill="none" stroke="{TERRA}" stroke-width="4" stroke-linecap="round"/>'
    f'<path d="M36 29Q38 34 36 38M42 30Q44 34 42 38" fill="none" stroke="#9a5f45" stroke-width="1.6" stroke-linecap="round"/>'
    f'<text x="44" y="22" font-family="Georgia,serif" font-size="9" fill="{SAGE}">z</text>'
    f'<text x="49" y="16" font-family="Georgia,serif" font-size="7" fill="{SAGE}">z</text>'
))
icon("tea", (
    f'<path d="M27 14Q24 18 27 22M33 12Q30 17 33 22" fill="none" stroke="{SAGE}" stroke-width="1.8" stroke-linecap="round"/>'
    f'<path d="M15 26H43V35C43 43 37 48 29 48C21 48 15 43 15 35Z" fill="#efe3c6" stroke="{INK}" stroke-width="1.6"/>'
    f'<path d="M43 29C51 29 51 40 42 40" fill="none" stroke="{INK}" stroke-width="1.6"/>'
    f'<path d="M22 33C24 31 27 31 29 34C31 37 34 37 36 34" fill="none" stroke="{OLIVE}" stroke-width="1.6"/>'
    f'<ellipse cx="29" cy="51" rx="18" ry="3" fill="{TERRA}"/>'
))
icon("lock", (
    f'<path d="M23 29V23A9 9 0 0 1 41 23V29" fill="none" stroke="{INK}" stroke-width="3"/>'
    f'<rect x="17" y="29" width="30" height="23" rx="5" fill="{OLIVE}"/>'
    f'<path d="M32 36C29 39.5 29 43 32 46C35 43 35 39.5 32 36Z" fill="#efe3c6"/>'
))
icon("palette", (
    f'<path d="M32 12C20 12 12 21 12 31C12 42 21 52 31 52C35 52 36 49 34 46C32 43 34 40 38 40H43C48 40 52 36 52 31C52 20 43 12 32 12Z" fill="#efe3c6" stroke="{INK}" stroke-width="1.6"/>'
    f'<circle cx="23" cy="26" r="4" fill="{OLIVE}"/><circle cx="33" cy="21" r="4" fill="{PLUM}"/>'
    f'<circle cx="43" cy="27" r="4" fill="{GOLD}"/><circle cx="21" cy="37" r="4" fill="#2f3a2c"/>'
))
icon("download", (
    f'<path d="M32 13V37M22 28L32 38L42 28" fill="none" stroke="{OLIVE}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
    f'<path d="M15 41V48C15 50 16.5 51 18.5 51H45.5C47.5 51 49 50 49 48V41" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>'
))
icon("question", (
    f'<circle cx="32" cy="32" r="19" fill="#efe3c6" stroke="{INK}" stroke-width="1.6"/>'
    f'<path d="M25 26C25 21 29 18.5 32.5 18.5C37 18.5 40 21.5 40 25.5C40 31 33 31 33 37" fill="none" stroke="{PLUM}" stroke-width="3.6" stroke-linecap="round"/>'
    f'<circle cx="33" cy="44" r="2.6" fill="{PLUM}"/>'
))
icon("gallery", (
    f'<rect x="12" y="16" width="40" height="32" rx="4" fill="#efe3c6" stroke="{INK}" stroke-width="1.6"/>'
    f'<circle cx="41" cy="25" r="4" fill="{GOLD}"/>'
    f'<path d="M14 45L26 30L35 40L40 35L50 45Z" fill="{OLIVE}"/>'
))
icon("sparkle", (
    f'<path d="M30 12L34 26L48 30L34 34L30 48L26 34L12 30L26 26Z" fill="{GOLD}"/>'
    f'<path d="M46 40L47.6 44.4L52 46L47.6 47.6L46 52L44.4 47.6L40 46L44.4 44.4Z" fill="{SAGE}"/>'
))

# --- decor stickers reused from the journal -------------------------------
for name in ["fern", "olive", "flower", "moon", "star-book", "moth", "key", "stamp", "exlibris"]:
    src = os.path.join(SRC_ILLU, f"decor-{name}.svg")
    if os.path.exists(src):
        shutil.copyfile(src, os.path.join(DECOR, f"{name}.svg"))
shutil.copyfile(os.path.join(SRC_ILLU, "reading-corner.svg"), os.path.join(ROOT, "reading-corner.svg"))

# --- animated hero banner ---------------------------------------------------
snow = "".join(
    f'<circle cx="{x}" cy="-6" r="{r}" fill="#fff" opacity=".85">'
    f'<animate attributeName="cy" values="-6;150" dur="{d}s" begin="{b}s" repeatCount="indefinite"/></circle>'
    for x, r, d, b in [(842, 1.6, 7, 0), (868, 1.2, 9, 2), (893, 1.8, 8, 4), (915, 1.3, 10, 1),
                       (938, 1.5, 7.5, 3), (961, 1.1, 9.5, 5), (984, 1.7, 8.5, 0.5), (1004, 1.2, 11, 6)]
)
books = ""
x = 70
palette = [OLIVE, PLUM, TERRA, SLATE, "#a99366", SAGE, "#7d5a4a", OLIVE, "#9c6f5a", SLATE]
for shelf_y in (118, 196):
    xx = x
    for i, c in enumerate(palette):
        w = 13 + (i * 7) % 9
        h = 56 + (i * 11) % 18
        books += f'<rect x="{xx}" y="{shelf_y - h}" width="{w}" height="{h}" rx="2" fill="{c}"/>'
        books += f'<path d="M{xx + 3} {shelf_y - h + 8}H{xx + w - 3}" stroke="{GOLD}" stroke-width="1.4" opacity=".7"/>'
        xx += w + 2
        if xx > 260:
            break

banner = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="340" viewBox="0 0 1280 340">
<defs>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#3a2e24"/><stop offset="1" stop-color="#241c16"/></linearGradient>
  <radialGradient id="fire" cx="50%" cy="80%" r="60%"><stop stop-color="#ffcf7a" stop-opacity=".55"/><stop offset=".5" stop-color="#d9894a" stop-opacity=".18"/><stop offset="1" stop-color="#d9894a" stop-opacity="0"/></radialGradient>
  <linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#1d2a3a"/><stop offset="1" stop-color="#40546a"/></linearGradient>
  <clipPath id="win"><rect x="830" y="40" width="190" height="130" rx="6"/></clipPath>
</defs>
<rect width="1280" height="340" rx="22" fill="url(#wall)"/>
<rect width="1280" height="340" rx="22" fill="url(#fire)">
  <animate attributeName="opacity" values="1;.78;.95;.7;1" dur="3.2s" repeatCount="indefinite"/>
</rect>
<!-- bookshelf -->
<rect x="58" y="40" width="220" height="250" rx="6" fill="#5a4332"/>
<rect x="66" y="48" width="204" height="234" rx="3" fill="#2c221a"/>
{books}
<rect x="62" y="118" width="212" height="8" fill="#7a5c43"/><rect x="62" y="196" width="212" height="8" fill="#7a5c43"/>
<g transform="translate(150 262)"><ellipse rx="44" ry="10" fill="#7a5c43"/><path d="M-30 -2Q-28 -22 0 -22Q24 -22 30 -6Q36 -8 36 -2Z" fill="#c98a5c"/><path d="M-26 -14L-28 -26L-18 -20Z M-12 -20L-10 -30L-3 -22Z" fill="#c98a5c"/><path d="M-24 -12Q-21 -10 -18 -12M-14 -12Q-11 -10 -8 -12" stroke="#3a2e24" stroke-width="1.5" fill="none"/></g>
<!-- window with snow -->
<rect x="822" y="32" width="206" height="146" rx="10" fill="#5a4332"/>
<rect x="830" y="40" width="190" height="130" rx="6" fill="url(#night)"/>
<g clip-path="url(#win)">
  <circle cx="985" cy="72" r="14" fill="#f4e7c3"/><circle cx="991" cy="68" r="12" fill="#25344a" opacity=".9"/>
  <path d="M830 170L870 120L905 150L945 105L990 145L1020 125V170Z" fill="#2c3d4f"/>
  <path d="M858 170L870 140L882 170Z M930 170L945 130L960 170Z" fill="#1c2a24"/>
  {snow}
</g>
<path d="M925 40V170M830 105H1020" stroke="#5a4332" stroke-width="6"/>
<!-- candles -->
<g transform="translate(1110 228)">
  <rect x="-8" y="-50" width="16" height="50" rx="3" fill="#efe1c2"/>
  <path d="M0 -70C-6 -61 -5 -55 0 -53C5 -55 6 -61 0 -70Z" fill="{GOLD}"><animateTransform attributeName="transform" type="scale" values="1 1;1.06 .9;.96 1.08;1 1" dur="1.4s" repeatCount="indefinite" additive="sum"/></path>
  <rect x="22" y="-32" width="14" height="32" rx="3" fill="#efe1c2"/>
  <path d="M29 -50C24 -42 25 -37 29 -35C33 -37 34 -42 29 -50Z" fill="{GOLD}"><animate attributeName="opacity" values="1;.75;1" dur="1.1s" repeatCount="indefinite"/></path>
  <rect x="-30" y="0" width="90" height="8" rx="4" fill="#7a5c43"/>
</g>
<!-- fern -->
<g transform="translate(1188 300) scale(.75)" fill="{SAGE}"><path d="M0 0Q-4 -80 10 -150" stroke="{OLIVE}" stroke-width="4" fill="none"/>
<ellipse cx="-14" cy="-40" rx="16" ry="6" transform="rotate(-25 -14 -40)"/><ellipse cx="14" cy="-60" rx="16" ry="6" transform="rotate(25 14 -60)"/>
<ellipse cx="-10" cy="-85" rx="14" ry="5.5" transform="rotate(-30 -10 -85)"/><ellipse cx="16" cy="-105" rx="13" ry="5" transform="rotate(30 16 -105)"/>
<ellipse cx="0" cy="-130" rx="11" ry="4.5" transform="rotate(-30 0 -130)"/></g>
<!-- title -->
<text x="550" y="150" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="74" fill="#f3e6c8">Тихая глава</text>
<text x="550" y="198" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-style="italic" font-size="26" fill="{GOLD}">Cozy Reader’s Sanctuary</text>
<path d="M430 228H670" stroke="{GOLD}" stroke-width="1.2" opacity=".55"/>
<text x="550" y="262" text-anchor="middle" font-family="Georgia,serif" font-size="19" fill="#cdbf9f" letter-spacing="1.5">библиотека · дневник · комната у камина</text>
<path d="M0 300H1280V318A22 22 0 0 1 1258 340H22A22 22 0 0 1 0 318Z" fill="#1b1510" opacity=".55"/>
</svg>'''
with open(os.path.join(ROOT, "banner.svg"), "w", encoding="utf-8") as f:
    f.write(banner)
print("ok")
