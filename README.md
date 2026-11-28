# whoswho: who's here?

A guest board for parties and meetups. Run it on your laptop for everyone on the local network, or host it on Cloudflare (Workers and a Durable Object) for everyone, anywhere. Live at **https://whoswho.hypermaps.world**.

- **`/home`** is the big-screen display. It rotates between three 3D/paper screens, with a QR code in the corner pointing to `/hi`:
  - **The Map:** a paper pop-up model of London (landmarks, parks, buses, cabs, boats) where every guest is a 3D spirit animal hopping on their postcode district. The camera tours from person to person, and a big card shows the fun things each of them said about themselves. The animals have a life of their own: they dance, nap, flip and do laps of their spot on a long loop, hop over to visit their neighbours (hearts, notes and stars), and every couple of minutes a stadium wave rolls across London. The weather changes every 50 seconds (sunshine, breeze, drizzle, snow, rainbows, fog, thunderstorms), led by the moods of what the room has said, the same way the Cloud picks its weather. In a thunderstorm the animals jump at every flash.
  - **The Cloud:** every fun thing guests say is an anonymous 3D cloud, and its words set its weather (see below). The sky colour and the "tonight's forecast" line follow the room's mood, One at a time, a cloud floats to the front and its words show big enough to read across the room.
  - **Wishes:** "what do you need in life right now?" Every wish rises as its own lantern over the night skyline, with the guest's name, so people who can help go and say hi. Guests can send as many as they like, and the lanterns keep rising on a loop.
- **`/hi`** is for phones. Join with a name, a postcode and a spirit animal (66 to pick from), then **say something fun about you** and send **wishes**, as many as you like.
- **`/hax0r`** is the admin page: edit or delete guests, delete individual lanterns, read and delete fun things (it shows who sent what), change display settings, reset the event.

Everything is stored in a single SQLite file, so a restart loses nothing. New guests, fun things and wishes reach the display instantly via Server-Sent Events, and the display jumps to show them: the Map flies to a new animal, or to the card of whoever just said something fun, and a new lantern rises from the rooftops. To stop it jumping around, it makes at most one jump every 25 seconds.

### The weather of fun things

Each fun thing is sorted when it arrives, by keywords in `public/js/weather.js` (first match wins):

| Weather | Vibe | Triggered by words like |
|---|---|---|
| Drizzle | Tender | can't, cried, lost, scared |
| Giggly | Hilarious | teapot, socks, tattoo, dressed as, karaoke |
| Sunny | Wanderlust | countries, hitchhiked, boat, travel, moved to |
| Thunder | Superpowers | languages, record, champion, marathon, juggle |
| Rainbows | Creative | piano, music, DJ, novel, film, sing |
| Warm front | Foodies | cook, supper, bake, coffee, wine |
| Breezy | Outdoorsy | farm, bees, garden, surf, swim, hike |
| Misty | Mysterious | anything else |

Add words there to tune it; the server and the display share the file.

## Quick start

```sh
npm install
npm start
```

The server prints the URLs to open on other devices, for example:

```
Display   http://192.168.1.23:3000/home
Register  http://192.168.1.23:3000/hi
Admin     http://192.168.1.23:3000/hax0r
```

Open the Display URL on the TV or projector and press **F** for fullscreen. Guests scan the QR code to register.

> **macOS:** the first time, you may be asked whether to let `node` accept incoming connections. Click **Allow**, or phones won't be able to connect.

The real board starts empty and fills up as guests join.

Want something to look at first? `npm run demo` starts a separate demo board on port 3001, with 22 sample guests and their fun things and wishes. It uses its own `demo.sqlite`, which is reset on every run, so the sample data never reaches the real board. (`npm run seed` writes the same samples into `demo.sqlite` without starting a server. Add `-- --db whoswho.sqlite` only if you really want them on the real board.)

## From outside your network

The quickest way is a Cloudflare quick tunnel. It needs no account, and you don't have to change anything on your router:

```sh
npm start                                        # in one terminal
cloudflared tunnel --url http://localhost:3000   # in another; prints https://<random>.trycloudflare.com
```

Open `https://<random>.trycloudflare.com/home` on the display. When a page is opened through a tunnel, the QR code and links use the tunnel's address, so phones outside the network can join. Set `PUBLIC_URL` if you want to force a particular address.

- **Set `ADMIN_PASSWORD` first.** Otherwise anyone with the link can open `/hax0r` and delete everyone.
- **Live updates use polling.** Quick tunnels don't pass Server-Sent Events, so the display and admin page fall back to polling every 2.5 s. You may see a short delay; nothing else changes.
- **The address changes every time `cloudflared` restarts.** Reload the display after a restart so the QR updates.
- **Quick tunnels have no uptime guarantee.** For the night itself, use the local network or a named Cloudflare tunnel on your own domain.

## On Cloudflare (whoswho.hypermaps.world)

The same app runs as a Cloudflare Worker, with no server of your own:

- **Static files** (`public/` plus three.js, built into `dist/public` by `scripts/build-worker.mjs`) are Workers Static Assets.
- **Everything else** (pages, API, live updates) goes to one Durable Object, the party (`worker/index.js`). It keeps the data in its own SQLite storage (`worker/sqlite-driver.js` runs `src/db.js` unchanged) and holds every screen's live connection, so Server-Sent Events work directly; no polling needed.
- **The domain** is a Workers custom domain in `wrangler.jsonc`: Cloudflare manages its DNS record and certificate.

```sh
npm run deploy                         # build the assets and deploy (wrangler login first)
npx wrangler secret put ADMIN_PASSWORD # once; until it's set, /hax0r stays locked
npm run dev:worker                     # the Worker locally on :8787 (admin password from .dev.vars)
```

**Moving a party between servers:** `/api/admin/backup` returns everything as JSON (`GET`), and `PUT` replaces everything with such a file. Phones keep working because their tokens move too, though a phone that changes address has to join again, since its token lives in that address's storage. For example, from a laptop to Cloudflare:

```sh
curl -u admin:PASSWORD http://localhost:3000/api/admin/backup -o party.json
curl -u admin:PASSWORD -X PUT -H 'content-type: application/json' --data-binary @party.json https://whoswho.hypermaps.world/api/admin/backup
```

## Configuration

Settings come from environment variables, or from a `.env` file in the project folder. Copy `.env.example` to `.env` and fill it in. `.env` is git-ignored, and anything already set in your shell wins over it.

| Env var          | Default            | Purpose                                                                                      |
|------------------|--------------------|----------------------------------------------------------------------------------------------|
| `PORT`           | `3000`             | Port to listen on (all interfaces)                                                           |
| `DB_PATH`        | `./whoswho.sqlite` | SQLite database file                                                                         |
| `ADMIN_PASSWORD` | *(unset)*          | Puts `/hax0r` and the admin API behind HTTP Basic auth (any username)                        |
| `PUBLIC_HOST`    | *(auto)*           | Overrides the auto-detected LAN IP used in the QR code (e.g. if a VPN interface gets picked) |
| `PUBLIC_URL`     | *(auto)*           | Full public address for the QR code (e.g. a tunnel); pages opened through a tunnel detect it |

Set the event title, the seconds each view stays on screen, and which views are in rotation from `/hax0r`. Changes apply to the display live.

**Display controls:** click a view's tab (The Map · The Cloud · Wishes) to jump to it; the timer restarts and auto-rotation carries on. Keys: `←` `→` switch view · `Space` pause (also stops the jumps to new arrivals) · `F` fullscreen. The cursor hides after 3 s. `/home?view=cloud` opens on a given view. `/home?weather=snow` holds the Map on one kind of weather (`sunny`, `breezy`, `rain`, `snow`, `rainbow`, `fog`, `thunder`).

The display draws on a fixed 1920×1080 stage scaled to the screen, so it looks the same on any TV or projector. Only the view on screen renders; the others sleep.

Every view can be explored by hand (mouse, trackpad or touch screen). Touching a view restarts its timer, and its own slideshow waits about 15 seconds before carrying on.

**The Map:** tap an animal to see its card. Drag to turn London (drag up or down to tilt), scroll, pinch or use the `+`/`−` buttons to zoom toward that spot, and move around with two fingers (or right-drag / shift-drag). Left alone for 12 seconds, the camera drifts back to the tour.

**The Cloud:** one fun thing at a time floats to the front for 9 seconds. Grab the card and throw it left for the next one (right for the previous); the cloud moves with it. Tapping the card, a two-finger swipe or the scroll wheel also flips. Tap any cloud in the sky to bring it forward; a new one jumps the queue.

**Wishes:** drag the sky up to send the lanterns higher, or down to bring them back. A flick (or the scroll wheel) keeps them racing for a few seconds before they settle back to their slow drift.

## Privacy

- **Location:** guests are placed at the **district** level only, e.g. `E8` (Hackney), with a small fixed offset so people don't stack. A full postcode is accepted but never shown. The public API (`/api/guests`) returns only the district; only the admin page sees what was typed.
- **Fun things are public, with your name on the Map.** Guests say them about themselves, and the Map shows them on their own card. The Cloud shows no names at all. (Older posts about other people still keep the author hidden from the display and the public API; only `/hax0r` sees who sent what, for moderation.)
- **Phones:** joining returns a random token that the phone keeps in `localStorage`; it's how the phone posts fun things and wishes. Resetting the event logs every phone out.
- **Rendering:** all guest text is rendered as text, never HTML.

## Offline / internet

Everything works without internet: pages, three.js, fonts (Unbounded, Figtree, Instrument Serif and Caveat, all OFL), the postcode lookup (a bundled table of ~360 districts inside the M25) and the 3D London geometry all ship with the app.

The display uses WebGL, so run it on a laptop with a reasonable GPU; any recent Mac is fine.

## Development

```sh
npm run dev     # restart on file changes
npm test        # unit + API tests (node:test)
```

No build step on Node: Node ≥ 22.13 (uses the built-in `node:sqlite`), Express 5 for static files, three.js r149, and vanilla ES modules in the browser.

```
server.js              Node: static files, then the shared handler; startup banner
src/app.js             every route (pages, REST API, admin, backup) and live updates (SSE + poll),
                       as one fetch-style handler shared by Node and the Worker
src/db.js              SQLite schema/migrations, validation, CRUD, settings, backup (any driver)
src/node-db.js         node:sqlite driver (one file)
worker/                Cloudflare: Worker entry + Durable Object, its SQLite driver
src/postcode.js        postcode → district centroid (+ jitter)
src/network.js         LAN IP detection
src/postcode.js        postcode → district centroid (+ jitter)
src/network.js         LAN IP detection
src/auth.js            Basic auth for admin (Web Crypto)
src/env.js             loads .env
pages/                 home / hi / hax0r HTML
public/js/animals.js   the 22 spirit animals + pin colours (shared by browser + server validation)
public/js/weather.js   fun thing → weather classifier, clusters, forecast (shared by browser + server)
public/js/3d/          three.js engines: ww-map (paper London), ww-zoo (city life + 2D stickers),
                       ww-zoo3d (3D animals), ww-life (visits, waves, weather), ww-cloud (3D clouds)
public/js/views/       map3d, cloud3d, wishes
public/data/           london-3d.json: simplified boroughs + Thames in km (npm run build:3d)
```

### Data sources

- **Postcode district centroids:** [postcodes.io](https://postcodes.io). Contains OS data © Crown copyright and database right, Royal Mail data © Royal Mail copyright and database right, and ONS data © Crown copyright (OGL v3).
- **Borough boundaries:** ONS Open Geography Portal, Local Authority Districts (May 2024) BGC (OGL v3).
- **3D London:** borough outlines simplified from the boundaries above; the Thames is a hand-traced centre line.
- **Fonts:** Unbounded, Figtree, Instrument Serif and Caveat (SIL Open Font License, via Fontsource). See `public/fonts/OFL.txt`.
- **3D:** [three.js](https://threejs.org) (MIT).
