// Spirit animals (the 3D zoo) and pin colours. Shared by the server
// (validation) and the browser (pickers, the map).

export const ANIMALS = [
  'fox', 'cat', 'bear', 'rabbit', 'frog', 'panda', 'owl', 'pig', 'lion', 'tiger', 'monkey',
  'penguin', 'dog', 'mouse', 'raccoon', 'koala', 'elephant', 'hedgehog', 'sheep', 'cow', 'chick', 'unicorn',
  'deer', 'moose', 'giraffe', 'zebra', 'horse', 'donkey', 'llama', 'camel', 'goat', 'hippo', 'rhino',
  'gorilla', 'sloth', 'otter', 'beaver', 'squirrel', 'badger', 'wolf', 'polarbear', 'redpanda', 'kangaroo', 'platypus',
  'seal', 'whale', 'shark', 'octopus', 'crab', 'turtle', 'crocodile', 'snake', 'chameleon', 'axolotl', 'flamingo',
  'parrot', 'peacock', 'duck', 'swan', 'toucan', 'eagle', 'bat', 'bee', 'snail', 'hamster', 'dragon',
];

export const PALETTE = {
  pink: ['#FF7AA8', '#FFE0EA'],
  yellow: ['#FFD84D', '#FFF3C9'],
  blue: ['#4F7BFF', '#DCE6FF'],
  mint: ['#3FD3A0', '#D7F7EA'],
  orange: ['#FF9A4D', '#FFE6D0'],
};
export const COLORS = Object.keys(PALETTE);

// Animals from the old 2D avatar set under another name.
const LEGACY = { bunny: 'rabbit', puppy: 'dog' };
const LEGACY_BG = { peach: 'orange', lemon: 'yellow', mint: 'mint', sky: 'blue', blue: 'blue', lavender: 'pink', pink: 'pink', coral: 'orange', teal: 'mint', grape: 'blue' };

const LABELS = { polarbear: 'Polar bear', redpanda: 'Red panda' };
export const animalLabel = (id) => LABELS[id] || id.charAt(0).toUpperCase() + id.slice(1);

function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Whitelist {animal, color}. Old avatars map to the nearest zoo animal. */
export function normalizeAvatar(input) {
  const src = input && typeof input === 'object' ? input : {};
  let animal = LEGACY[src.animal] || src.animal;
  if (!ANIMALS.includes(animal)) animal = ANIMALS[hash(JSON.stringify(src)) % ANIMALS.length];
  let color = COLORS.includes(src.color) ? src.color : LEGACY_BG[src.bg];
  if (!color) color = COLORS[hash(`${animal}:${JSON.stringify(src)}`) % COLORS.length];
  return { animal, color };
}

export function randomAvatar(rng = Math.random) {
  return { animal: ANIMALS[Math.floor(rng() * ANIMALS.length)], color: COLORS[Math.floor(rng() * COLORS.length)] };
}
