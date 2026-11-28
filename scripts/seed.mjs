#!/usr/bin/env node
// Adds sample guests (with secrets and wishes) for demos/testing.
//   npm run seed [-- --clear] [-- --count N] [-- --db FILE]
// Writes to ./demo.sqlite by default, never the party database, so the real
// board starts empty. `npm run demo` seeds it and serves it on port 3001.
// Pass --db whoswho.sqlite only if you really want samples on the real board.

import { openDb } from '../src/node-db.js';
import { ANIMALS } from '../public/js/animals.js';

const args = process.argv.slice(2);
const clear = args.includes('--clear');
const countIdx = args.indexOf('--count');
const dbIdx = args.indexOf('--db');
const DEMO_DB = 'demo.sqlite';
const file = dbIdx >= 0 ? args[dbIdx + 1] : DEMO_DB;

// [name, postcode district, pin colour, fun things [text, 'self'|'friend'], wish]
// Everything is posted as said by the guest about themselves, like the phone does.
const SAMPLES = [
  ['Maya', 'E8', 'pink', [['lived on a canal boat for three winters', 'friend'], ["can't whistle, at all", 'self']], 'a flat with an actual bath'],
  ['Tom', 'N16', 'yellow', [['has been to 100 countries and is counting', 'friend']], 'someone to start a band with'],
  ['Priya', 'SE15', 'blue', [['plays piano by ear and never learned to read music', 'friend'], ['ran a supper club out of a launderette', 'self']], 'eight hours of sleep, just once'],
  ['Jonas', 'E2', 'mint', [['grew up on a goat farm in the Alps', 'self']], 'a reason to go back to Lisbon'],
  ['Leila', 'SW9', 'orange', [['speaks five languages and swears in seven', 'friend']], 'a dog (the landlord says no)'],
  ['Sam', 'NW5', 'pink', [['hitchhiked from Lisbon to Istanbul', 'friend'], ['built a sauna in a back garden', 'friend']], 'more sauna, less email'],
  ['Ines', 'W11', 'blue', [['was an extra in a spy film', 'self']], "a tennis partner who won't go easy"],
  ['Kofi', 'SE22', 'yellow', [['once cooked for 300 people at a festival', 'friend']], 'good sourdough within walking distance'],
  ['Hana', 'N1', 'mint', [['keeps bees on a rooftop', 'friend'], ['has a twin nobody here has met', 'self']], 'to finally learn Spanish'],
  ['Felix', 'E17', 'orange', [['learned to surf at forty', 'self']], 'fewer meetings'],
  ['Zara', 'SW11', 'pink', [['DJed a wedding in a cave', 'friend']], 'a co-founder who loves maps'],
  ['Oli', 'NW1', 'blue', [['worked on a cruise ship as a magician', 'friend']], 'a long walk with no phone'],
  ['Noor', 'E14', 'yellow', [['swam across a lake at dawn on her birthday', 'friend']], 'somebody to cook for'],
  ['Ben', 'SE10', 'mint', [['moved to London with one suitcase and a ukulele', 'self']], 'a garden, even a tiny one'],
  ['Ana', 'N7', 'orange', [["collects old maps of cities she's never been to", 'friend']], 'a sabbatical'],
  ['Marek', 'W6', 'pink', [["can solve a Rubik's cube in under a minute", 'friend']], 'one more summer like 2019'],
  ['Chloe', 'SE1', 'blue', [['knows how to milk a camel', 'friend'], ['was a ballroom champion at twelve', 'friend']], 'a trip somewhere with no wifi'],
  ['Dev', 'E5', 'yellow', [['wrote a whole novel, burned it, and is starting again', 'self']], 'an editor, or a deadline'],
  ['Rosa', 'SW4', 'mint', [['has a tattoo of a tram', 'friend']], "a bike that doesn't get stolen"],
  ['Luca', 'N4', 'orange', [['got stuck in a lift with a pop star', 'friend']], 'a proper Italian espresso in London'],
  ['Yuki', 'W2', 'pink', [['ran a marathon dressed as a teapot', 'friend']], 'a quiet Sunday'],
  ['Ade', 'SE5', 'blue', [['sleeps with socks on, even in August', 'friend']], 'people to play five-a-side with'],
];
const count = countIdx >= 0 ? Number(args[countIdx + 1]) : SAMPLES.length;

const db = openDb(file);
if (clear) console.log(`cleared ${db.deleteAllGuests()} guests`);
const made = [];
for (let i = 0; i < count; i++) {
  const [name, postcode, color, , need] = SAMPLES[i % SAMPLES.length];
  const suffix = i >= SAMPLES.length ? ` ${Math.floor(i / SAMPLES.length) + 1}` : '';
  made.push(db.createGuest({ name: name + suffix, avatar: { animal: ANIMALS[i % ANIMALS.length], color }, need, postcode }).guest);
}
// A few guests send more than one lantern.
const MORE_WISHES = { Maya: ['someone to share a canal walk with'], Tom: ['a drummer, specifically'], Hana: ['a Spanish conversation partner', 'more honey jars'], Sam: ['a reason to switch my phone off'] };
for (const g of made) {
  for (const text of MORE_WISHES[g.name] || []) db.addWish(db.raw.prepare('SELECT token FROM guests WHERE id = ?').get(g.id).token, text);
}
let secrets = 0;
made.forEach((g, i) => {
  for (const [text] of SAMPLES[i % SAMPLES.length][3]) {
    db.addSecret({ text, aboutId: g.id, by: 'self', authorId: g.id });
    secrets++;
  }
});
console.log(`added ${count} sample guests and ${secrets} fun things → ${db.listGuests().length} guests total in ${file}`);
db.close();
