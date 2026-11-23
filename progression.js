/* ============================================================
 * Hue & Seek — 99-Level Spirit Journey, Level-Gated Elemental Guns,
 * World Unlocks, High-Level Tactical Perks, Win Streaks, Daily
 * Spirit Contracts & Cozy Spirit Wardrobe (progression.js v2)
 * ============================================================ */

const STORAGE_KEY = 'hueseek_progression_v1';
const ADMIN_ACCESS_STORAGE_KEY = 'hs_admin_access_v1';
const ADMIN_BYPASS_STORAGE_KEY = 'hs_admin_world_bypass_v1';
const ADMIN_WALID_LV99_KEY = 'hs_admin_walid_lv99_v1';
const GAMERTAG_STORAGE_KEY = 'hs_gamertag';
const ADMIN_ACCOUNTS = new Set(['walid']);
const SCHEMA_VERSION = 2;
const STARTER_TOKENS = 60;
const MAX_ACTIVE_VFX_BURSTS = 12;

export const MAX_LEVEL = 99;

/**
 * Long-term 99-Level XP curve (cumulative XP computed from xpNeededForLevel below):
 * - Lv. 1 -> 2: 220 XP (reached by the FIRST finished match, win or lose — see FIRST_MATCH_BONUS_XP)
 * - Lv. 2 (2nd Map): 220 · Lv. 4 (3rd Map): 821 · Lv. 7 (4th Map): 2,184 · Lv. 10 (5th Map): 4,167
 * - Lv. 6 (Rock Gun): 1,664 cumulative XP
 * - Lv. 13 (All 6 Maps): 6,833 cumulative XP (~3 hours of play)
 * - Lv. 14 (Fire Gun): 7,882 cumulative XP
 * - Lv. 22 (Ice Gun): 19,442 cumulative XP
 * - Lv. 32 (Air Gun): 42,732 cumulative XP
 * - Lv. 40..99: High-tier Perks, Prestige Masks/Halos & Legend Mastery (545,407 XP total to Lv. 99)
 */
export function xpNeededForLevel(lv) {
  const safeLv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(lv) || 1)));
  const n = safeLv - 1;
  return Math.round(220 + 48 * n + 4.2 * Math.pow(n, 1.65));
}

export const MAP_UNLOCK_LEVELS = {
  meadow: 1,
  bathhouse: 2,
  seaplane: 4,
  skyruins: 7,
  clockwork: 10,
  tinyfolk: 13,
};

// Match-completion XP (recordSeriesOutcome). Every on-screen "win vs loss" string is built from these.
const MATCH_BASE_XP = { win: 165, draw: 95, loss: 55 };
// One-time bonus paid the first time a profile finishes a full match: a first LOSS with zero
// skill bonus pays 55 + 165 = 220 XP = exactly Level 2 (2nd map unlocked after match one).
const FIRST_MATCH_BONUS_XP = 165;

// Visible anti-farm caps for in-match action rewards (whistles, soaks, event bonuses…).
// Nominal amounts are always paid 1:1 until the cap; the player is told when a cap kicks in.
const MATCH_ACTION_TOKEN_CAP = 150;
const MATCH_ACTION_XP_CAP = 65;

// Repeatable token sinks (Journey tab → Spirit Shop)
const LUCKY_CHARM_COST = 50;
const LUCKY_CHARM_XP_PCT = 25;
const CONTRACT_REROLL_BASE_COST = 30;
const CONTRACT_REROLL_STEP_COST = 20;

export const MAP_DISPLAY_META = {
  meadow: { id: 'meadow', name: 'Meadowbrook Village', icon: '🏡', levelReq: 1 },
  bathhouse: { id: 'bathhouse', name: 'Yu-Machi Bathhouse', icon: '🏮', levelReq: 2 },
  seaplane: { id: 'seaplane', name: 'Porto Sereno Cove', icon: '✈️', levelReq: 4 },
  skyruins: { id: 'skyruins', name: 'Celestia Sky-Ruins', icon: '🏛️', levelReq: 7 },
  clockwork: { id: 'clockwork', name: 'Clockwork Market Square', icon: '⚙️', levelReq: 10 },
  tinyfolk: { id: 'tinyfolk', name: "Tinyfolk Hollow", icon: '🍃', levelReq: 13 },
};

export const RANK_LEAGUES = [
  { id: 'bronze', name: 'Bronze', icon: '🥉', min: 0, color: '#cd7f32' },
  { id: 'silver', name: 'Silver', icon: '🥈', min: 150, color: '#9aa8b8' },
  { id: 'gold', name: 'Gold', icon: '🥇', min: 350, color: '#f2b724' },
  { id: 'diamond', name: 'Diamond', icon: '💎', min: 650, color: '#39b8f2' },
  { id: 'master', name: 'Master', icon: '👑', min: 1050, color: '#a864f5' },
  { id: 'grand', name: 'Grand Spirit', icon: '🌟', min: 1600, color: '#ff6454' },
];

export function getRankLeagueForTrophies(trophies = 0) {
  const t = Math.max(0, Math.floor(Number(trophies) || 0));
  let cur = RANK_LEAGUES[0];
  let next = RANK_LEAGUES[1] || null;
  for (let i = 0; i < RANK_LEAGUES.length; i++) {
    if (t >= RANK_LEAGUES[i].min) {
      cur = RANK_LEAGUES[i];
      next = RANK_LEAGUES[i + 1] || null;
    }
  }
  const span = next ? Math.max(1, next.min - cur.min) : 1;
  const pct = next ? Math.min(100, Math.max(0, ((t - cur.min) / span) * 100)) : 100;
  return { ...cur, trophies: t, next, pct, toNext: next ? Math.max(0, next.min - t) : 0 };
}

export function computePlaystylePersona(ps = {}) {
  const boops = Number(ps.boops) || 0;
  const rescues = Number(ps.rescues) || 0;
  const maxStars = Number(ps.maxWantedStars) || 0;
  const bounties = Number(ps.bounties) || 0;
  const stealthWins = Number(ps.stealthWins) || 0;
  if (maxStars >= 4) return { id: 'most_wanted', icon: '🌟', name: 'Most Wanted Legend', color: '#f59f00' };
  if (rescues >= 2 && rescues >= boops) return { id: 'guardian', icon: '🦸', name: 'Squad Guardian', color: '#2fb344' };
  if (boops >= 2) return { id: 'trickster', icon: '💫', name: 'Chaos Trickster', color: '#ae3ec9' };
  if (bounties >= 2) return { id: 'bloodhound', icon: '🔎', name: 'Ace Bloodhound', color: '#1c7ed6' };
  if (stealthWins >= 2) return { id: 'ghost', icon: '👻', name: 'Shadow Ghost', color: '#5c7cfa' };
  return { id: 'rising', icon: '🌿', name: 'Rising Spirit', color: '#40a85c' };
}

export const ELEM_GUN_UNLOCK_LEVELS = {
  water: 1,
  earth: 3,
  fire: 5,
  snow: 8,
  air: 12,
};

export const SPIRIT_CHEST_TARGET = 3;

export const WELCOME_CALENDAR_REWARDS = [
  { day: 1, icon: '🪙', label: 'Day 1 Gift', tokens: 80, xp: 40 },
  { day: 2, icon: '🔥', label: 'Day 2 · Fire Trial', tokens: 60, xp: 50, trialGun: 'fire' },
  { day: 3, icon: '🍀', label: 'Day 3 · Lucky Charm', tokens: 120, xp: 60, luckyCharm: 1 },
  { day: 4, icon: '🪙', label: 'Day 4 Gift', tokens: 150, xp: 70 },
  { day: 5, icon: '❄️', label: 'Day 5 · Ice Trial', tokens: 160, xp: 80, trialGun: 'snow' },
  { day: 6, icon: '🪙', label: 'Day 6 Gift', tokens: 200, xp: 100 },
  { day: 7, icon: '👑', label: 'Day 7 · Grand Chest', tokens: 400, xp: 200, trialGun: 'air', luckyCharm: 1 },
];

export function getRankTitleForLevel(lv) {
  const l = Math.max(1, Math.floor(Number(lv) || 1));
  if (l >= 99) return 'Spirit Realm Legend';
  if (l >= 90) return 'Grove Sovereign';
  if (l >= 80) return 'River Dragon Sage';
  if (l >= 70) return 'Phantom Elder';
  if (l >= 60) return 'Grand Inquisitor';
  if (l >= 50) return 'Elemental Archon';
  if (l >= 40) return 'Clockwork Warden';
  if (l >= 30) return 'Sky-Ruins Corsair';
  if (l >= 20) return 'Bathhouse Mystic';
  if (l >= 10) return 'Adriatic Ranger';
  if (l >= 5) return 'Meadow Scout';
  return 'Woodland Sprout';
}

// ============================================================
// Long-Term Hider & Seeker Perks (Lv. 1 -> Lv. 90+)
// ============================================================
export const HIDER_PERKS = [
  {
    id: 'none',
    name: 'Pure Woodland Spirit',
    icon: '🌱',
    levelReq: 1,
    tier: 'Starter',
    desc: 'Classic nimble Spirit form with balanced movement and disguises.',
  },
  {
    id: 'feather_hop',
    name: 'Feather Hop',
    icon: '🥾',
    levelReq: 5,
    tier: 'Early Perk',
    desc: '+16% higher jump vault & light-footed landings to clear chairs, railings & crates effortlessly.',
  },
  {
    id: 'quick_morph',
    name: 'Chameleon Reflex',
    icon: '⚡',
    levelReq: 12,
    tier: 'Tactical Perk',
    desc: '-40% prop disguise cooldown (1.5s vs 2.5s) and -25% quieter morph sound radius.',
  },
  {
    id: 'soap_decoy',
    name: 'Soapy Trick-Clone',
    icon: '🫧',
    levelReq: 20,
    tier: 'Tactical Perk',
    desc: 'Shot Decoy Clones burst into a slippery water puddle and blind the Seeker for +0.6s longer!',
  },
  {
    id: 'second_wind',
    name: 'Forest Second Wind',
    icon: '🌿',
    levelReq: 30,
    tier: 'Mid Perk',
    desc: 'Out-of-combat Spirit HP regeneration begins 1.0s sooner and restores health +45% faster.',
  },
  {
    id: 'tiny_spirit',
    name: "Tinyfolk Brew",
    icon: '🧪',
    levelReq: 44,
    tier: 'Major Perk',
    desc: 'Shrinks your disguised prop silhouette by -22% and grants +8% disguised sneak speed!',
  },
  {
    id: 'twin_dash',
    name: 'Twin-Petal Dash',
    icon: '🌸',
    levelReq: 58,
    tier: 'Major Perk',
    desc: '-30% Sakura Smoke Dash cooldown (8.4s) AND activating Dash instantly cleanses Burn, Slow, Chill & Wind!',
  },
  {
    id: 'phantom_mirage',
    name: 'Phantom Mirage',
    icon: '👻',
    levelReq: 74,
    tier: 'Master Perk',
    desc: 'Deploy up to 3 active Decoys (-25% CD) + auto-pop an emergency smoke veil when hit below 35% HP (25s CD)!',
  },
  {
    id: 'grove_sovereign',
    name: 'Grove Sovereign',
    icon: '👑',
    levelReq: 90,
    tier: 'Apex Perk',
    desc: '+35 Max Spirit HP (215 Base HP), 100% immunity to Slippery Water Puddles, and +12% jump vault!',
  },
];

export const SEEKER_PERKS = [
  {
    id: 'none',
    name: 'Village Patrol Kit',
    icon: '💧',
    levelReq: 1,
    tier: 'Starter',
    desc: 'Standard balanced Seeker patrol boots, Echo Pulse, and Splash Bomb.',
  },
  {
    id: 'swift_boots',
    name: 'Patrol Sprinter',
    icon: '🏃',
    levelReq: 11,
    tier: 'Early Perk',
    desc: '+8% Seeker patrol movement speed and +12% jump height for chasing rooftop Spirits.',
  },
  {
    id: 'keen_echo',
    name: 'Keen Echo Dowsing',
    icon: '📡',
    levelReq: 16,
    tier: 'Tactical Perk',
    desc: '-22% Echo Pulse [Q] cooldown (14s) and +3.5m wider Spirit proximity detection wave.',
  },
  {
    id: 'cluster_bomb',
    name: 'Hydro-Cluster Bomb',
    icon: '💣',
    levelReq: 28,
    tier: 'Mid Perk',
    desc: '-20% Splash Bomb [E] cooldown (11.2s) and +25% wider elemental blast radius!',
  },
  {
    id: 'clear_goggles',
    name: 'Mist-Proof Goggles',
    icon: '🛡️',
    levelReq: 40,
    tier: 'Major Perk',
    desc: 'Reduces Decoy Bubble-Blind duration by -60% and cuts wrong-prop spray penalty in half (-1s)!',
  },
  {
    id: 'elem_overdrive',
    name: 'Elemental Overdrive',
    icon: '⚗️',
    levelReq: 52,
    tier: 'Major Perk',
    desc: '+30% longer Elemental Gun status effects (Slip, Rock Slow, Burn DoT, Chill & Wind) + 12% faster shots!',
  },
  {
    id: 'relentless_hunter',
    name: 'Relentless Hunter',
    icon: '⚡',
    levelReq: 68,
    tier: 'Master Perk',
    desc: 'Soaking a Spirit refunds 50% Echo & Bomb cooldowns and grants +22% chase speed for 4.5s!',
  },
  {
    id: 'grand_inquisitor',
    name: 'Grand Inquisitor',
    icon: '🌟',
    levelReq: 85,
    tier: 'Apex Perk',
    desc: '+12% faster blaster fire rate, -50% wrong-prop penalty, and hits mark fleeing Spirits with a 1.8s golden ring!',
  },
];

// ============================================================
// Mastery Bounties / Lifetime Achievements (Bonus XP + Tokens, no free gun skips!)
// ============================================================
export const ACHIEVEMENTS = [
  {
    id: 'ach_sharpshooter',
    name: 'Keen Marksman',
    icon: '🎯',
    desc: 'Land 60 Elemental Blaster Hits on disguised Spirits',
    stat: 'blasterHits',
    target: 60,
    unit: 'Hits',
    reward: 30,
    rewardTokens: 30,
    rewardXp: 120,
    unlocksElemGun: null,
  },
  {
    id: 'ach_veteran_survivor',
    name: 'Whisper in the Timber',
    icon: '🌿',
    desc: 'Survive 600 total seconds hidden as a Spirit across matches',
    stat: 'surviveSec',
    target: 600,
    unit: 's Survived',
    reward: 35,
    rewardTokens: 35,
    rewardXp: 150,
    unlocksElemGun: null,
  },
  {
    id: 'ach_master_trickster',
    name: 'Phantom Trickster',
    icon: '🎭',
    desc: 'Morph into 40 Props OR Pull Off 15 Tactical Decoy/Whistle Plays',
    anyOf: [
      { stat: 'propsMorphed', target: 40, unit: 'Morphs', shortUnit: '' },
      { stat: 'tacticalPlays', target: 15, unit: 'Plays', shortUnit: '' },
    ],
    reward: 45,
    rewardTokens: 45,
    rewardXp: 180,
    unlocksElemGun: null,
  },
  {
    id: 'ach_grand_hunter',
    name: 'Grand Spirit Seeker',
    icon: '💦',
    desc: 'Soak 25 Spirits OR Win 8 Full 5v5 Series Matches',
    anyOf: [
      { stat: 'spiritsSoaked', target: 25, unit: 'Soaks', shortUnit: '' },
      { stat: 'matchesWon', target: 8, unit: 'Wins', shortUnit: '' },
    ],
    reward: 60,
    rewardTokens: 60,
    rewardXp: 240,
    unlocksElemGun: null,
  },
  {
    id: 'ach_champion_dynasty',
    name: 'Realm Champion',
    icon: '🏆',
    desc: 'Win 25 Full 5v5 Series Matches',
    stat: 'matchesWon',
    target: 25,
    unit: 'Wins',
    reward: 110,
    rewardTokens: 110,
    rewardXp: 420,
    unlocksElemGun: null,
  },
  {
    id: 'ach_arsenal_master',
    name: 'Elemental Arsenal Master',
    icon: '🔥',
    desc: 'Reach Level 32 & Unlock all 5 Elemental Blasters',
    stat: 'elemGunsUnlocked',
    target: 5,
    unit: 'Guns',
    reward: 120,
    rewardTokens: 120,
    rewardXp: 350,
    unlocksElemGun: null,
  },
];

// ============================================================
// Rotating Daily Spirit Contracts (3 per day — XP + Token Boosts)
// ============================================================
const DAILY_CONTRACT_POOL = [
  { id: 'dc_win_1', icon: '🏆', title: 'Claim Victory', desc: 'Win 1 Full 5v5 Series Match', stat: 'matchesWon', target: 1, xp: 150, tokens: 22 },
  { id: 'dc_win_2', icon: '👑', title: 'Double Triumph', desc: 'Win 2 Full 5v5 Series Matches', stat: 'matchesWon', target: 2, xp: 260, tokens: 38 },
  { id: 'dc_soak_3', icon: '💦', title: 'Spirit Tracker', desc: 'Soak 3 Disguised Spirits', stat: 'spiritsSoaked', target: 3, xp: 125, tokens: 18 },
  { id: 'dc_hits_25', icon: '🎯', title: 'Suppression Spray', desc: 'Land 25 Blaster Hits on Spirits', stat: 'blasterHits', target: 25, xp: 115, tokens: 16 },
  { id: 'dc_survive_150', icon: '🌿', title: 'Still as Stone', desc: 'Survive 150s Hidden in Survive Phase', stat: 'surviveSec', target: 150, xp: 125, tokens: 18 },
  { id: 'dc_tricks_3', icon: '🫧', title: 'Mischief Maker', desc: 'Pull off 3 Decoy Tricks or Close Whistles', stat: 'tacticalPlays', target: 3, xp: 130, tokens: 20 },
  { id: 'dc_morph_8', icon: '🎭', title: 'Master of Disguise', desc: 'Transform into 8 Props in Matches', stat: 'propsMorphed', target: 8, xp: 105, tokens: 15 },
  { id: 'dc_air_3', icon: '🌸', title: 'Breeze Runner', desc: 'Use 3 Smoke Dashes or Updraft Glides', stat: 'airPlays', target: 3, xp: 110, tokens: 16 },
];

export const COSMETIC_CATALOG = {
  elemGun: [
    {
      id: 'water',
      name: 'Hydro Splasher',
      cost: 0,
      levelReq: 1,
      icon: '💦',
      starter: true,
      effectBadge: '💦 Slippery Puddles (4.5s)',
      accent: '#3fb8d8',
      desc: 'Starter hydro cannon — coats the floor in glossy puddles that make fleeing Spirits skid & slide around corners!',
    },
    {
      id: 'earth',
      name: 'Terra Boulderforge',
      cost: 0,
      levelReq: 3,
      icon: '🪨',
      effectBadge: '🪨 -35% Heavy Slow (2.4s)',
      accent: '#9c7a44',
      desc: 'Golem-stone mortar — direct hits weigh Spirits down, slowing move speed by -35% and dampening jump height!',
    },
    {
      id: 'fire',
      name: 'Emberwick Hearth Igniter',
      cost: 0,
      levelReq: 5,
      icon: '🔥',
      effectBadge: '🔥 Burn DoT (4 dmg / 0.5s)',
      accent: '#ff6b2b',
      desc: 'Ignites Spirits for 3s of ticking fire damage + rising smoke trail! (Countered by water or Smoke Dash).',
    },
    {
      id: 'snow',
      name: 'Boreal Frostweaver',
      cost: 0,
      levelReq: 8,
      icon: '❄️',
      effectBadge: '❄️ Chill Stacks → 1s Freeze',
      accent: '#56b4f5',
      desc: 'Cryo prism blaster — stacks -10% Chill per hit and encases Spirits in a 3D ice crystal shell at 4 stacks!',
    },
    {
      id: 'air',
      name: 'Gale Windcaller',
      cost: 0,
      levelReq: 12,
      icon: '🌪️',
      effectBadge: '🌪️ Lose Control Gust (1.5s)',
      accent: '#3cc4a7',
      desc: 'Sky-pirate turbine — buffets hit Spirits with chaotic crosswind drift & wobbly steering while blasting props!',
    },
  ],
  hiderPerk: HIDER_PERKS,
  seekerPerk: SEEKER_PERKS,
  hat: [
    {
      id: 'none',
      name: 'Natural Spirit',
      cost: 0,
      icon: '🌱',
      desc: 'Pure woodland spirit form with your natural sprout.',
    },
    {
      id: 'leaf_umbrella',
      name: 'Giant Leaf Umbrella',
      cost: 75,
      icon: '🍃',
      desc: 'Tilted lush green heart-leaf canopy on a curved woodland stem.',
    },
    {
      id: 'frog_hood',
      name: 'Rain Frog Cap',
      cost: 110,
      icon: '🐸',
      desc: 'Pastel green rain cap with two cute glossy frog eyes on top.',
    },
    {
      id: 'ribbon_bow',
      name: 'Courier Ribbon',
      cost: 130,
      icon: '🎀',
      desc: 'Big perky teal ribbon headband sprinkled with cream polka dots.',
    },
    {
      id: 'chef_hat',
      name: 'Bathhouse Ramen Toque',
      cost: 155,
      icon: '🍜',
      desc: 'Puffy pleated cream chef toque tied with a crisp red hachimaki.',
    },
    {
      id: 'tiny_crown',
      name: 'Starlight Prince Crown',
      cost: 195,
      icon: '👑',
      desc: 'Warm storybook gold 5-point crown set with ruby & seafoam gems.',
    },
    {
      id: 'acorn_cap',
      name: 'Acorn Beret',
      cost: 120,
      icon: '🌰',
      desc: 'Snug woody acorn cap with a crosshatch crown and a curly twig stalk.',
    },
    {
      id: 'mushroom_cap',
      name: 'Dewdrop Mushroom Cap',
      cost: 180,
      icon: '🍄',
      desc: 'Wide plum-violet toadstool cap dotted with cream spots and a frilly underskirt.',
    },
    {
      id: 'daisy_crown',
      name: 'Daisy Chain Crown',
      cost: 260,
      icon: '🌼',
      desc: 'Braided meadow-green vine ringed with six sunny white daisies.',
    },
    {
      id: 'paper_boat',
      name: 'Paper Boat Hat',
      cost: 340,
      icon: '⛵',
      desc: 'Crisply folded sky-blue paper boat with a tiny coral pennant on top.',
    },
    {
      id: 'teapot_cozy',
      name: 'Teapot Cozy',
      cost: 450,
      icon: '🫖',
      desc: 'Round knitted teapot in mint stripes — spout, handle and a little steam curl.',
    },
    {
      id: 'snail_shell',
      name: 'Garden Snail Shell',
      cost: 600,
      icon: '🐌',
      desc: 'Glossy caramel spiral shell with two wobbly eye-stalks peeking out front.',
    },
    {
      id: 'lighthouse_lamp',
      name: 'Harbor Lighthouse',
      cost: 900,
      icon: '🗼',
      desc: 'Collector grade — tall candy-striped lighthouse tower with a glowing golden lamp room.',
    },
    {
      id: 'kitsune_mask',
      name: 'Kitsune Shrine Mask',
      cost: 0,
      levelReq: 48,
      icon: '🦊',
      desc: 'Prestige Lv. 48 Unlock — Sculpted ivory & vermilion festival fox mask perched on your brow!',
    },
    {
      id: 'astral_halo',
      name: 'Astral Starlight Halo',
      cost: 0,
      levelReq: 95,
      icon: '🌌',
      desc: 'Mythic Lv. 95 Unlock — Floating golden constellation ring with orbiting sugar stars!',
    },
  ],
  taunt: [
    {
      id: 'chirp',
      name: 'Woodland Chirp',
      cost: 0,
      icon: '🐦',
      desc: 'Bright woodland trill that echoes softly through the meadow.',
    },
    {
      id: 'duck',
      name: 'Squeaky Bath Duck',
      cost: 85,
      icon: '🦆',
      desc: 'Playful bathhouse rubber-duck double squeak!',
    },
    {
      id: 'windchime',
      name: 'Glass Furin Chime',
      cost: 105,
      icon: '🎐',
      desc: 'Crystal summer porch windchime singing in the breeze.',
    },
    {
      id: 'emberwick',
      name: 'Emberwick Hearth Crackle',
      cost: 125,
      icon: '🔥',
      desc: 'Cheerful dancing hearth-ember pops and warm crackles.',
    },
    {
      id: 'ocarina',
      name: 'Moonlit Ocarina',
      cost: 165,
      icon: '🪈',
      desc: 'Dreamy 4-note clay ocarina melody under moonlit clouds.',
    },
  ],
  poof: [
    {
      id: 'classic',
      name: 'Warm Cream Puff',
      cost: 0,
      icon: '☁️',
      desc: 'Cozy sunlit cream puffs billowing as you disguise.',
    },
    {
      id: 'sakura',
      name: 'Sakura Blossom Swirl',
      cost: 95,
      icon: '🌸',
      desc: '18 pink 3D cherry-blossom petals fluttering outward in a swirl.',
    },
    {
      id: 'starlight',
      name: 'Sugar Star Sprinkle',
      cost: 135,
      icon: '🌟',
      desc: 'Pastel lemon, mint & rose sugar-candy octahedron stars twinkling up.',
    },
    {
      id: 'puffball',
      name: 'Puffball Scatter',
      cost: 150,
      icon: '🌼',
      desc: '12 pale cream dandelion puffs hopping playfully before drifting away.',
    },
    {
      id: 'leaf_whirl',
      name: 'Autumn Leaf Whirl',
      cost: 220,
      icon: '🍂',
      desc: 'Russet, amber & gold leaves spinning up in a tight little whirlwind.',
    },
    {
      id: 'bubble_pop',
      name: 'Soap Bubble Pop',
      cost: 320,
      icon: '🫧',
      desc: 'Shimmering aqua & lilac soap bubbles that swell, wobble upward and pop.',
    },
    {
      id: 'firefly_glow',
      name: 'Firefly Lantern Glow',
      cost: 480,
      icon: '✨',
      desc: 'A slow ring of warm golden fireflies that orbit, blink and float away.',
    },
    {
      id: 'confetti_burst',
      name: 'Festival Confetti Burst',
      cost: 700,
      icon: '🎊',
      desc: 'Collector grade — 26 tumbling paper squares in six festival colours raining down.',
    },
    {
      id: 'dragon_swirl',
      name: 'River-Dragon Spirit Swirl',
      cost: 0,
      levelReq: 80,
      icon: '🐉',
      desc: 'Prestige Lv. 80 Unlock — Emerald jade & radiant gold river-dragon orbs spiraling skyward!',
    },
  ],
  blaster: [
    {
      id: 'classic',
      name: 'Tangerine & Seafoam',
      cost: 0,
      icon: '💦',
      desc: 'Sunny village tangerine tank paired with seafoam brass.',
      colors: { tank: 0xffa94d, barrel: 0x3fb8a8, grip: 0x2f5f8a },
    },
    {
      id: 'sakura_brass',
      name: 'Sakura & Warm Brass',
      cost: 90,
      icon: '🌷',
      desc: 'Springtime blossom pink tank with polished brass nozzle.',
      colors: { tank: 0xf69bb8, barrel: 0xe8c15a, grip: 0x6d435a },
    },
    {
      id: 'ace_crimson',
      name: 'Adriatic Crimson',
      cost: 125,
      icon: '✈️',
      desc: 'Seaplane crimson enamel, vintage ivory barrel & walnut grip.',
      colors: { tank: 0xd9382e, barrel: 0xf2e3c6, grip: 0x3b2a22 },
    },
    {
      id: 'spirit_jade',
      name: 'Bathhouse Jade & Gold',
      cost: 165,
      icon: '🐉',
      desc: 'Imperial river-spirit jade lacquered with radiant bathhouse gold.',
      colors: { tank: 0x3da87b, barrel: 0xffcf5c, grip: 0x214e41 },
    },
    {
      id: 'mint_cocoa',
      name: 'Mint & Cocoa',
      cost: 140,
      icon: '🍃',
      desc: 'Cool garden-mint tank on a warm cocoa barrel and dark chocolate grip.',
      colors: { tank: 0x9be3c1, barrel: 0x8a5a3c, grip: 0x4a2f20 },
    },
    {
      id: 'blueberry_cream',
      name: 'Blueberry Cream',
      cost: 200,
      icon: '🫐',
      desc: 'Deep blueberry tank, whipped-cream barrel and a jam-purple grip.',
      colors: { tank: 0x4f6bd8, barrel: 0xfff1d6, grip: 0x5b3a8c },
    },
    {
      id: 'sunflower_field',
      name: 'Sunflower Field',
      cost: 280,
      icon: '🌻',
      desc: 'Bright sunflower-yellow tank, leafy green barrel and seed-brown grip.',
      colors: { tank: 0xffd23f, barrel: 0x5fa83a, grip: 0x5a3b1c },
    },
    {
      id: 'plum_lantern',
      name: 'Plum Lantern',
      cost: 380,
      icon: '🏮',
      desc: 'Dusky plum tank with a paper-lantern orange barrel and ink-violet grip.',
      colors: { tank: 0x7b3f8c, barrel: 0xff9d4d, grip: 0x2e1f3d },
    },
    {
      id: 'tidepool_coral',
      name: 'Tidepool Coral',
      cost: 520,
      icon: '🐚',
      desc: 'Living-coral tank, tidepool turquoise barrel and deep-sea navy grip.',
      colors: { tank: 0xff7f6b, barrel: 0x2ec4c9, grip: 0x1d3557 },
    },
    {
      id: 'aurora_glass',
      name: 'Aurora Glass',
      cost: 780,
      icon: '🌌',
      desc: 'Collector grade — northern-lights lilac tank, glacier-mint barrel and midnight grip.',
      colors: { tank: 0xb18cff, barrel: 0x7ef9d0, grip: 0x1b1f4b },
    },
    {
      id: 'emberwick_gold',
      name: 'Emberwick Furnace Gold',
      cost: 0,
      levelReq: 64,
      icon: '✨',
      desc: 'Prestige Lv. 64 Unlock — Forged obsidian hearth tank with radiant ember-gold barrel!',
      colors: { tank: 0x2b211e, barrel: 0xffb703, grip: 0x7c2d12 },
    },
    {
      id: 'celestial_99',
      name: 'Spirit Realm Legend (Lv. 99)',
      cost: 0,
      levelReq: 99,
      icon: '🏆',
      desc: 'Mythic Lv. 99 Mastery — Astral pearl-gold tank, starlight cyan barrel & royal indigo grip!',
      colors: { tank: 0xffe066, barrel: 0x64dfdf, grip: 0x312e81 },
    },
  ],
};

export const CATEGORY_TABS = [
  { id: 'journey', label: 'Journey 1–99', icon: '🗺️' },
  { id: 'elemGun', label: 'Elemental Guns', icon: '🔥' },
  { id: 'hiderPerk', label: 'Hider Perks', icon: '🎭' },
  { id: 'seekerPerk', label: 'Seeker Perks', icon: '🎯' },
  { id: 'hat', label: 'Hats', icon: '👒' },
  { id: 'taunt', label: 'Taunts', icon: '🔔' },
  { id: 'poof', label: 'Poofs', icon: '🌸' },
  { id: 'blaster', label: 'Skins', icon: '💦' },
];

export const DEFAULT_EQUIPPED = {
  elemGun: 'water',
  hiderPerk: 'none',
  seekerPerk: 'none',
  hat: 'none',
  taunt: 'chirp',
  poof: 'classic',
  blaster: 'classic',
};

// ============================================================
// Complete 99-Level Road Builder (Major Unlocks + Small Pouches + Empty Rank Steps)
// ============================================================
function buildLevelRoad99() {
  const majorByLevel = {
    1:  { kind: 'starter', major: true, icon: '🏡', title: 'Meadowbrook + Hydro Splasher', badge: 'Starter', desc: 'Starter Village World & 💦 Slippery Water Gun' },
    2:  { kind: 'map', major: true, mapId: 'bathhouse', icon: '🏮', title: 'Yu-Machi Bathhouse', badge: 'World Unlock', desc: '3-tier steaming Spirit Bathhouse world unlocked!' },
    4:  { kind: 'map', major: true, mapId: 'seaplane', icon: '✈️', title: 'Porto Sereno Cove', badge: 'World Unlock', desc: 'Sun-drenched Adriatic seaplane harbor unlocked!' },
    5:  { kind: 'hiderPerk', major: true, itemId: 'feather_hop', icon: '🥾', title: 'Feather Hop', badge: 'Hider Perk', desc: '+16% higher jump vault & softer Spirit landings' },
    6:  { kind: 'elemGun', major: true, itemId: 'earth', icon: '🪨', title: 'Terra Boulderforge', badge: 'Rock Gun', desc: 'Unlocks Rock Blaster (-35% Heavy Slow on hit!)' },
    7:  { kind: 'map', major: true, mapId: 'skyruins', icon: '🏛️', title: 'Celestia Sky-Ruins', badge: 'World Unlock', desc: 'Floating Celestia castle ruins & updrafts unlocked!' },
    10: { kind: 'map', major: true, mapId: 'clockwork', icon: '⚙️', title: 'Clockwork Market Square', badge: 'World Unlock', desc: 'Pendulum clocktower & moving market trams unlocked!' },
    11: { kind: 'seekerPerk', major: true, itemId: 'swift_boots', icon: '🏃', title: 'Patrol Sprinter', badge: 'Seeker Perk', desc: '+8% Seeker move speed & +12% jump vault' },
    12: { kind: 'hiderPerk', major: true, itemId: 'quick_morph', icon: '⚡', title: 'Chameleon Reflex', badge: 'Hider Perk', desc: '-40% prop disguise swap cooldown (1.5s)' },
    13: { kind: 'map', major: true, mapId: 'tinyfolk', icon: '🍃', title: "Tinyfolk Hollow", badge: 'World Unlock', desc: 'Giant garden parlor & secret wall tunnels unlocked!' },
    14: { kind: 'elemGun', major: true, itemId: 'fire', icon: '🔥', title: 'Emberwick Hearth Igniter', badge: 'Fire Gun', desc: 'Unlocks Fire Blaster (3s ticking Burn DoT + smoke trail!)' },
    16: { kind: 'seekerPerk', major: true, itemId: 'keen_echo', icon: '📡', title: 'Keen Echo Dowsing', badge: 'Seeker Perk', desc: '-22% Echo Pulse cooldown & +3.5m scan range' },
    20: { kind: 'hiderPerk', major: true, itemId: 'soap_decoy', icon: '🫧', title: 'Soapy Trick-Clone', badge: 'Hider Perk', desc: 'Shot Decoys burst into a slippery puddle + longer blind!' },
    22: { kind: 'elemGun', major: true, itemId: 'snow', icon: '❄️', title: 'Boreal Frostweaver', badge: 'Ice Gun', desc: 'Unlocks Ice Blaster (Chill stacks → 1s Crystal Freeze!)' },
    28: { kind: 'seekerPerk', major: true, itemId: 'cluster_bomb', icon: '💣', title: 'Hydro-Cluster Bomb', badge: 'Seeker Perk', desc: '-20% Splash Bomb cooldown & +25% blast radius!' },
    30: { kind: 'hiderPerk', major: true, itemId: 'second_wind', icon: '🌿', title: 'Forest Second Wind', badge: 'Hider Perk', desc: 'HP regen begins 1s sooner & heals +45% faster!' },
    32: { kind: 'elemGun', major: true, itemId: 'air', icon: '🌪️', title: 'Gale Windcaller', badge: 'Air Gun', desc: 'Unlocks Air Blaster (1.5s Lose Control gusts + prop blasts!)' },
    40: { kind: 'seekerPerk', major: true, itemId: 'clear_goggles', icon: '🛡️', title: 'Mist-Proof Goggles', badge: 'Major Perk', desc: '-60% Bubble Blind duration & -50% wrong-prop penalty!' },
    44: { kind: 'hiderPerk', major: true, itemId: 'tiny_spirit', icon: '🧪', title: "Tinyfolk Brew", badge: 'Major Perk', desc: '-22% smaller disguised prop silhouette & +8% sneak speed!' },
    48: { kind: 'cosmetic', major: true, category: 'hat', itemId: 'kitsune_mask', icon: '🦊', title: 'Kitsune Shrine Mask', badge: 'Prestige Hat', desc: 'Sculpted ivory & vermilion festival 3D fox mask!' },
    52: { kind: 'seekerPerk', major: true, itemId: 'elem_overdrive', icon: '⚗️', title: 'Elemental Overdrive', badge: 'Major Perk', desc: '+30% longer Elemental debuffs & +12% faster shots!' },
    58: { kind: 'hiderPerk', major: true, itemId: 'twin_dash', icon: '🌸', title: 'Twin-Petal Dash', badge: 'Major Perk', desc: '-30% Smoke Dash CD & Dash cleanses all debuffs!' },
    64: { kind: 'cosmetic', major: true, category: 'blaster', itemId: 'emberwick_gold', icon: '✨', title: 'Emberwick Furnace Gold', badge: 'Prestige Skin', desc: 'Forged obsidian & radiant hearth-gold blaster skin!' },
    68: { kind: 'seekerPerk', major: true, itemId: 'relentless_hunter', icon: '⚡', title: 'Relentless Hunter', badge: 'Master Perk', desc: 'Soaks refund 50% gadget CDs + grant +22% chase sprint!' },
    74: { kind: 'hiderPerk', major: true, itemId: 'phantom_mirage', icon: '👻', title: 'Phantom Mirage', badge: 'Master Perk', desc: '3 max Decoys (-25% CD) + auto smoke veil below 35% HP!' },
    80: { kind: 'cosmetic', major: true, category: 'poof', itemId: 'dragon_swirl', icon: '🐉', title: 'River-Dragon Swirl', badge: 'Prestige Poof', desc: 'Emerald & gold river-dragon 3D morph swirl!' },
    85: { kind: 'seekerPerk', major: true, itemId: 'grand_inquisitor', icon: '🌟', title: 'Grand Inquisitor', badge: 'Apex Perk', desc: '+12% fire rate, -50% wrong penalty & 1.8s hit-shimmer!' },
    90: { kind: 'hiderPerk', major: true, itemId: 'grove_sovereign', icon: '👑', title: 'Grove Sovereign', badge: 'Apex Perk', desc: '+35 Max HP (215 HP), Slippery Puddle Immunity & +12% vault!' },
    95: { kind: 'cosmetic', major: true, category: 'hat', itemId: 'astral_halo', icon: '🌌', title: 'Astral Starlight Halo', badge: 'Mythic Hat', desc: 'Floating golden constellation halo with orbiting stars!' },
    99: { kind: 'cosmetic', major: true, category: 'blaster', itemId: 'celestial_99', tokens: 500, icon: '🏆', title: 'Spirit Realm Legend', badge: 'Lv. 99 Cap', desc: 'Mythic Celestial Blaster + Legend Title + 500 🪙!' },
  };

  // Worlds now unlock at Lv. 2 / 4 / 7 / 10 / 13 — the levels they used to sit on keep a
  // guaranteed (larger) token pouch so none of those stops on the road became empty.
  const lanternPouchByLevel = { 3: 40, 9: 60, 18: 80, 26: 100, 36: 120 };

  const list = [];
  let breatherToggle = 0;
  for (let lv = 1; lv <= MAX_LEVEL; lv++) {
    if (majorByLevel[lv]) {
      list.push({ level: lv, tokens: 0, ...majorByLevel[lv] });
      continue;
    }
    if (lanternPouchByLevel[lv]) {
      const bigTok = lanternPouchByLevel[lv];
      list.push({
        level: lv,
        kind: 'small_tokens',
        major: false,
        tokens: bigTok,
        icon: '🏮',
        title: `+${bigTok} 🪙 Lantern Pouch`,
        badge: 'Token Pouch',
        desc: `Festival lantern pouch (+${bigTok} 🪙) to spend in the Spirit Shop`,
      });
      continue;
    }
    // Levels in-between alternate between pure rank steps (nothing) and small token pouches!
    breatherToggle += 1;
    if (breatherToggle % 2 === 1) {
      list.push({
        level: lv,
        kind: 'rank_step',
        major: false,
        tokens: 0,
        icon: '⭐',
        title: `Rank Step · Lv. ${lv}`,
        badge: 'Rank Step',
        desc: 'Closer to your next Spirit Journey milestone',
      });
    } else {
      const smallTok = Math.min(32, 10 + Math.floor(lv / 5) * 2);
      list.push({
        level: lv,
        kind: 'small_tokens',
        major: false,
        tokens: smallTok,
        icon: '🌰',
        title: `+${smallTok} 🪙 Acorn Pouch`,
        badge: 'Small Bonus',
        desc: `Small woodland token pouch (+${smallTok} 🪙)`,
      });
    }
  }
  return list;
}

export const LEVEL_ROAD = buildLevelRoad99();

const UNLOCKABLE_HAT_IDS = ['leaf_umbrella', 'frog_hood', 'ribbon_bow', 'chef_hat', 'tiny_crown'];
const UNLOCKABLE_ELEM_GUN_IDS = ['earth', 'fire', 'snow', 'air'];

// ============================================================
// Deterministic Bot Elemental Gun Picker (Scales gently with match variety)
// Identical output across Photon PvP peers for any seedIndex!
// ============================================================
export function pickDeterministicElemGunForBot(seedIndex = 0) {
  let n = 0;
  if (typeof seedIndex === 'number' && Number.isFinite(seedIndex)) {
    n = Math.abs(Math.trunc(seedIndex));
  } else if (typeof seedIndex === 'string') {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedIndex.length; i++) {
      h = Math.imul(h ^ seedIndex.charCodeAt(i), 16777619) >>> 0;
    }
    n = h;
  }
  let x = Math.imul((n + 10) >>> 0, 0x9e3779b1) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  const roll = x % 1000;
  if (roll < 480) return 'water';
  const elemIdx = Math.floor((roll - 480) / 130) % UNLOCKABLE_ELEM_GUN_IDS.length;
  return UNLOCKABLE_ELEM_GUN_IDS[elemIdx];
}

export function pickRandomCosmeticHatForPeer(seedIndex) {
  if (typeof seedIndex === 'number' && Number.isFinite(seedIndex)) {
    const n = Math.abs(Math.trunc(seedIndex));
    const roll = (Math.imul(n + 19, 2654435761) >>> 0) % 1000;
    if (roll >= 450) return 'none';
    const pickIdx = (Math.imul(n + 73, 1597334677) >>> 0) % UNLOCKABLE_HAT_IDS.length;
    return UNLOCKABLE_HAT_IDS[pickIdx];
  }
  if (Math.random() >= 0.45) return 'none';
  return UNLOCKABLE_HAT_IDS[(Math.random() * UNLOCKABLE_HAT_IDS.length) | 0];
}

// ============================================================
// Three.js Transform Helpers (100% Matte Storybook Materials: metalness: 0)
// ============================================================
function setPos(obj, x, y, z) {
  if (!obj || !obj.position) return obj;
  if (typeof obj.position.set === 'function') obj.position.set(x, y, z);
  else { obj.position.x = x; obj.position.y = y; obj.position.z = z; }
  return obj;
}

function setRot(obj, x, y, z) {
  if (!obj || !obj.rotation) return obj;
  if (typeof obj.rotation.set === 'function') obj.rotation.set(x, y, z);
  else { obj.rotation.x = x; obj.rotation.y = y; obj.rotation.z = z; }
  return obj;
}

function setScl(obj, x, y, z) {
  if (!obj || !obj.scale) return obj;
  if (typeof obj.scale.set === 'function') obj.scale.set(x, y, z);
  else { obj.scale.x = x; obj.scale.y = y; obj.scale.z = z; }
  return obj;
}

function makeStdMat(THREE, hex, opts = {}) {
  const params = Object.assign({ color: hex, roughness: 0.78, metalness: 0 }, opts);
  params.metalness = 0;
  if (THREE.DoubleSide !== undefined && opts.doubleSide) {
    params.side = THREE.DoubleSide;
    delete params.doubleSide;
  }
  if (THREE.MeshStandardMaterial) return new THREE.MeshStandardMaterial(params);
  if (THREE.MeshLambertMaterial) return new THREE.MeshLambertMaterial({ color: hex });
  return new THREE.MeshBasicMaterial({ color: hex });
}

function makeBasicMat(THREE, hex, opts = {}) {
  const params = Object.assign({ color: hex }, opts);
  if (THREE.MeshBasicMaterial) return new THREE.MeshBasicMaterial(params);
  return makeStdMat(THREE, hex, opts);
}

function addPart(THREE, parent, geo, mat, pos, rot, scl, name = '') {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  if (pos) setPos(m, pos[0], pos[1], pos[2]);
  if (rot) setRot(m, rot[0], rot[1], rot[2]);
  if (scl) setScl(m, scl[0], scl[1], scl[2]);
  parent.add(m);
  return m;
}

// ============================================================
// Procedural 3D Storybook Spirit Hats (Includes Lv. 48 Kitsune Mask & Lv. 95 Astral Halo!)
// ============================================================
export function buildHatMesh(THREE, hatId) {
  if (!THREE || !hatId || hatId === 'none') return null;

  const root = new THREE.Group();
  root.name = `cosmetic_hat_${hatId}`;

  if (hatId === 'leaf_umbrella') {
    const stemMat = makeStdMat(THREE, 0x4b7c32, { roughness: 0.82 });
    const leafMat = makeStdMat(THREE, 0x52a447, { roughness: 0.68, doubleSide: true });
    const veinMat = makeStdMat(THREE, 0x9add66, { roughness: 0.62 });
    const dewMat = makeStdMat(THREE, 0xdff6ff, { roughness: 0.25 });

    addPart(THREE, root, new THREE.CylinderGeometry(0.015, 0.02, 0.08, 8), stemMat, [0, 0.03, -0.015], [0.16, 0, -0.18], null, 'stem_base');
    addPart(THREE, root, new THREE.CylinderGeometry(0.013, 0.015, 0.085, 8), stemMat, [0.016, 0.10, -0.004], [0.08, 0, -0.26], null, 'stem_mid');
    addPart(THREE, root, new THREE.CylinderGeometry(0.011, 0.013, 0.065, 8), stemMat, [0.034, 0.16, 0.004], [-0.04, 0, -0.12], null, 'stem_top');

    const canopy = new THREE.Group();
    canopy.name = 'leaf_canopy';
    setPos(canopy, 0.028, 0.182, 0.012);
    setRot(canopy, 0.13, 0.08, -0.22);
    root.add(canopy);

    addPart(THREE, canopy, new THREE.SphereGeometry(0.165, 16, 12), leafMat, [-0.055, 0, 0.01], [0.05, 0.22, 0.08], [0.88, 0.13, 1.12], 'leaf_lobe_l');
    addPart(THREE, canopy, new THREE.SphereGeometry(0.165, 16, 12), leafMat, [0.055, 0, 0.01], [0.05, -0.22, -0.08], [0.88, 0.13, 1.12], 'leaf_lobe_r');
    addPart(THREE, canopy, new THREE.ConeGeometry(0.125, 0.14, 12), leafMat, [0, -0.004, 0.135], [Math.PI / 2 + 0.08, 0, 0], [1.05, 1, 0.18], 'leaf_tip');
    addPart(THREE, canopy, new THREE.CylinderGeometry(0.008, 0.013, 0.28, 8), veinMat, [0, 0.018, 0.03], [Math.PI / 2, 0, 0], [1, 1, 0.65], 'midrib');
    for (const sx of [-1, 1]) {
      addPart(THREE, canopy, new THREE.CylinderGeometry(0.005, 0.009, 0.14, 6), veinMat, [sx * 0.065, 0.016, 0.02], [Math.PI / 2, 0, sx * -0.95], [1, 1, 0.6], 'vein');
    }
    addPart(THREE, canopy, new THREE.SphereGeometry(0.022, 10, 8), dewMat, [-0.085, 0.022, 0.075], null, [1, 0.78, 1.12], 'dewdrop');
    return root;
  }

  if (hatId === 'frog_hood') {
    const frogMat = makeStdMat(THREE, 0x7fd16b, { roughness: 0.76 });
    const trimMat = makeStdMat(THREE, 0x58ab49, { roughness: 0.8 });
    const bellyMat = makeStdMat(THREE, 0xdff5be, { roughness: 0.82 });
    const whiteMat = makeBasicMat(THREE, 0xfffef8);
    const pupilMat = makeBasicMat(THREE, 0x1f1713);
    const blushMat = makeStdMat(THREE, 0xf5959b, { roughness: 0.85 });

    addPart(THREE, root, new THREE.SphereGeometry(0.195, 20, 14), frogMat, [0, 0.018, -0.008], [-0.08, 0, 0], [1.04, 0.68, 1.06], 'frog_dome');
    addPart(THREE, root, new THREE.TorusGeometry(0.182, 0.023, 10, 24), trimMat, [0, -0.012, -0.006], [Math.PI / 2 - 0.08, 0, 0], [1.02, 1.04, 0.85], 'frog_brim');
    addPart(THREE, root, new THREE.SphereGeometry(0.095, 14, 10), bellyMat, [0, 0.028, 0.112], null, [1.22, 0.42, 0.65], 'frog_brow_band');

    for (const sx of [-1, 1]) {
      const eyePod = new THREE.Group();
      setPos(eyePod, sx * 0.092, 0.122, 0.055);
      setRot(eyePod, 0.06, sx * 0.14, sx * -0.08);
      root.add(eyePod);
      addPart(THREE, eyePod, new THREE.SphereGeometry(0.056, 14, 12), frogMat, [0, 0, -0.006], null, [1, 1.04, 0.96], 'socket');
      addPart(THREE, eyePod, new THREE.SphereGeometry(0.045, 14, 12), whiteMat, [0, 0.002, 0.018], null, [0.96, 1, 0.78], 'sclera');
      addPart(THREE, eyePod, new THREE.SphereGeometry(0.027, 12, 10), pupilMat, [0, 0.003, 0.043], null, [0.95, 1.05, 0.55], 'pupil');
      addPart(THREE, eyePod, new THREE.SphereGeometry(0.011, 8, 6), whiteMat, [sx * 0.01, 0.015, 0.055], null, [1, 1, 0.5], 'sparkle');
      addPart(THREE, root, new THREE.SphereGeometry(0.028, 10, 8), blushMat, [sx * 0.122, 0.055, 0.135], [0, sx * 0.45, 0], [1.15, 0.65, 0.35], 'frog_blush');
    }
    return root;
  }

  if (hatId === 'ribbon_bow') {
    // Teal ribbon with cream polka dots
    const bowMat = makeStdMat(THREE, 0x2bb5a8, { roughness: 0.68 });
    const creaseMat = makeStdMat(THREE, 0x1c8c84, { roughness: 0.75 });
    const hiMat = makeStdMat(THREE, 0x58d3c6, { roughness: 0.62 });
    const dotMat = makeStdMat(THREE, 0xfff3d6, { roughness: 0.7 });

    addPart(THREE, root, new THREE.TorusGeometry(0.178, 0.02, 10, 26, Math.PI * 1.25), creaseMat, [0, -0.032, 0.005], [0.12, 0, -Math.PI * 0.125], [1.02, 0.92, 1], 'headband');
    addPart(THREE, root, new THREE.SphereGeometry(0.046, 14, 12), bowMat, [0, 0.088, 0.015], null, [0.92, 0.95, 0.82], 'bow_knot');

    for (const sx of [-1, 1]) {
      const wing = new THREE.Group();
      setPos(wing, sx * 0.024, 0.088, 0.015);
      setRot(wing, -0.08, sx * -0.14, sx * -0.42);
      root.add(wing);
      addPart(THREE, wing, new THREE.ConeGeometry(0.082, 0.185, 14), bowMat, [sx * 0.095, 0.035, 0], [0, 0, sx * (Math.PI / 2)], [0.68, 1, 0.46], 'bow_cone');
      addPart(THREE, wing, new THREE.SphereGeometry(0.072, 14, 12), hiMat, [sx * 0.168, 0.042, 0.004], null, [0.78, 1.08, 0.44], 'bow_puff');
      addPart(THREE, wing, new THREE.CylinderGeometry(0.012, 0.022, 0.09, 8), creaseMat, [sx * 0.085, 0.036, 0.024], [0, 0, sx * (Math.PI / 2)], [0.6, 1, 0.5], 'bow_dimple');
      // Polka dots on both faces so they read from the third-person camera too
      for (const sz of [-1, 1]) {
        addPart(THREE, wing, new THREE.SphereGeometry(0.012, 8, 6), dotMat, [sx * 0.15, 0.075, 0.004 + sz * 0.028], null, [1, 1, 0.4], 'bow_dot');
        addPart(THREE, wing, new THREE.SphereGeometry(0.013, 8, 6), dotMat, [sx * 0.19, 0.035, 0.004 + sz * 0.029], null, [1, 1, 0.4], 'bow_dot');
        addPart(THREE, wing, new THREE.SphereGeometry(0.011, 8, 6), dotMat, [sx * 0.155, 0.008, 0.004 + sz * 0.027], null, [1, 1, 0.4], 'bow_dot');
      }
      addPart(THREE, root, new THREE.BoxGeometry(0.052, 0.11, 0.018), bowMat, [sx * 0.068, 0.022, 0.005], [0.1, 0, sx * -0.48], null, 'bow_tail');
    }
    return root;
  }

  if (hatId === 'chef_hat') {
    const creamMat = makeStdMat(THREE, 0xfff9ec, { roughness: 0.78 });
    const pleatMat = makeStdMat(THREE, 0xf5ebd4, { roughness: 0.82 });
    const bandMat = makeStdMat(THREE, 0xd63b2f, { roughness: 0.7 });
    const goldPinMat = makeStdMat(THREE, 0xffc648, { roughness: 0.5 });

    addPart(THREE, root, new THREE.CylinderGeometry(0.168, 0.152, 0.115, 20), creamMat, [0, 0.048, 0], null, null, 'toque_collar');
    addPart(THREE, root, new THREE.TorusGeometry(0.156, 0.022, 10, 24), bandMat, [0, 0.008, 0], [Math.PI / 2, 0, 0], [1.01, 1.01, 0.95], 'hachimaki');
    addPart(THREE, root, new THREE.SphereGeometry(0.032, 10, 8), bandMat, [0, 0.008, -0.172], null, [1.1, 0.9, 0.85], 'hachimaki_knot');
    for (const sx of [-1, 1]) {
      addPart(THREE, root, new THREE.BoxGeometry(0.026, 0.085, 0.014), bandMat, [sx * 0.028, -0.028, -0.178], [0.22, 0, sx * -0.36], null, 'hachimaki_tail');
    }
    addPart(THREE, root, new THREE.SphereGeometry(0.022, 10, 8), goldPinMat, [0, 0.012, 0.174], null, [1.25, 0.85, 0.45], 'ramen_crest');
    addPart(THREE, root, new THREE.SphereGeometry(0.15, 18, 14), creamMat, [0, 0.148, 0], null, [1.15, 0.82, 1.15], 'toque_dome');
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      addPart(THREE, root, new THREE.SphereGeometry(0.082, 12, 10), i % 2 === 0 ? creamMat : pleatMat, [Math.sin(ang) * 0.118, 0.142, Math.cos(ang) * 0.118], null, [0.95, 0.92, 0.95], `toque_puff_${i}`);
    }
    return root;
  }

  if (hatId === 'tiny_crown') {
    const goldMat = makeStdMat(THREE, 0xffc43d, { roughness: 0.48 });
    const pearlGoldMat = makeStdMat(THREE, 0xffe484, { roughness: 0.42 });
    const velvetMat = makeStdMat(THREE, 0xa8283b, { roughness: 0.86 });
    const rubyMat = makeStdMat(THREE, 0xe83558, { roughness: 0.35 });
    const tealMat = makeStdMat(THREE, 0x34c6b5, { roughness: 0.35 });
    const GemGeo = THREE.OctahedronGeometry || THREE.SphereGeometry;

    addPart(THREE, root, new THREE.SphereGeometry(0.122, 16, 12), velvetMat, [0, 0.042, 0], null, [1, 0.68, 1], 'velvet_cushion');
    addPart(THREE, root, new THREE.CylinderGeometry(0.142, 0.126, 0.068, 20), goldMat, [0, 0.036, 0], null, null, 'crown_band');
    addPart(THREE, root, new THREE.TorusGeometry(0.128, 0.017, 8, 24), pearlGoldMat, [0, 0.004, 0], [Math.PI / 2, 0, 0], null, 'crown_rim');

    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const sx = Math.sin(ang);
      const sz = Math.cos(ang);
      addPart(THREE, root, new THREE.ConeGeometry(0.042, 0.095, 8), goldMat, [sx * 0.128, 0.105, sz * 0.128], [sz * 0.14, 0, -sx * 0.14], null, `crown_point_${i}`);
      addPart(THREE, root, new THREE.SphereGeometry(0.019, 10, 8), pearlGoldMat, [sx * 0.14, 0.156, sz * 0.14], null, null, `crown_tip_${i}`);
      addPart(THREE, root, new GemGeo(0.022, 0), i % 2 === 0 ? rubyMat : tealMat, [sx * 0.141, 0.036, sz * 0.141], [0, ang, Math.PI / 4], [0.95, 1.15, 0.65], `crown_gem_${i}`);
    }
    return root;
  }

  if (hatId === 'acorn_cap') {
    const capMat = makeStdMat(THREE, 0x8a5a2b, { roughness: 0.86 });
    const rimMat = makeStdMat(THREE, 0x6b4320, { roughness: 0.88 });
    const scaleMat = makeStdMat(THREE, 0xab7638, { roughness: 0.82 });
    const stalkMat = makeStdMat(THREE, 0x5b3a1c, { roughness: 0.85 });

    addPart(THREE, root, new THREE.SphereGeometry(0.19, 18, 12), capMat, [0, 0.02, 0], null, [1.05, 0.62, 1.05], 'acorn_dome');
    addPart(THREE, root, new THREE.TorusGeometry(0.188, 0.022, 8, 24), rimMat, [0, -0.004, 0], [Math.PI / 2, 0, 0], null, 'acorn_rim');
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      addPart(THREE, root, new THREE.SphereGeometry(0.03, 8, 6), scaleMat, [Math.sin(ang) * 0.158, 0.062, Math.cos(ang) * 0.158], null, [1, 0.7, 1], 'acorn_scale');
    }
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + 0.26;
      addPart(THREE, root, new THREE.SphereGeometry(0.028, 8, 6), scaleMat, [Math.sin(ang) * 0.098, 0.108, Math.cos(ang) * 0.098], null, [1, 0.7, 1], 'acorn_scale');
    }
    addPart(THREE, root, new THREE.CylinderGeometry(0.011, 0.018, 0.075, 8), stalkMat, [0.008, 0.165, 0], [0, 0, -0.22], null, 'acorn_stalk');
    addPart(THREE, root, new THREE.SphereGeometry(0.017, 8, 6), stalkMat, [0.022, 0.204, 0], null, null, 'acorn_curl');
    return root;
  }

  if (hatId === 'mushroom_cap') {
    const capMat = makeStdMat(THREE, 0x8e5bb5, { roughness: 0.7 });
    const spotMat = makeStdMat(THREE, 0xfff1d8, { roughness: 0.76 });
    const gillMat = makeStdMat(THREE, 0xf3e3c6, { roughness: 0.86 });
    const R = 0.235;
    const capY = 0.035;
    const squash = 0.64;

    addPart(THREE, root, new THREE.SphereGeometry(R, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), capMat, [0, capY, 0], null, [1, squash, 1], 'mushroom_dome');
    addPart(THREE, root, new THREE.CylinderGeometry(R * 0.985, R * 0.8, 0.03, 22), gillMat, [0, capY - 0.014, 0], null, null, 'mushroom_gills');
    addPart(THREE, root, new THREE.TorusGeometry(R * 0.93, 0.019, 8, 26), spotMat, [0, capY - 0.004, 0], [Math.PI / 2, 0, 0], null, 'mushroom_frill');
    const spots = [[0.0, 0.0, 0.034], [0.62, 0.3, 0.03], [0.62, 2.4, 0.026], [0.62, 4.5, 0.03], [1.12, 1.35, 0.027], [1.12, 3.45, 0.024], [1.12, 5.55, 0.027]];
    for (const [theta, phi, rad] of spots) {
      const sx = Math.sin(theta) * Math.cos(phi) * R;
      const sy = capY + Math.cos(theta) * R * squash;
      const sz = Math.sin(theta) * Math.sin(phi) * R;
      addPart(THREE, root, new THREE.SphereGeometry(rad, 10, 8), spotMat, [sx, sy, sz], null, [1, 0.5, 1], 'mushroom_spot');
    }
    return root;
  }

  if (hatId === 'daisy_crown') {
    const vineMat = makeStdMat(THREE, 0x5fa647, { roughness: 0.8 });
    const leafMat = makeStdMat(THREE, 0x7cc45a, { roughness: 0.76 });
    const petalMat = makeStdMat(THREE, 0xfffdf4, { roughness: 0.7 });
    const coreMat = makeStdMat(THREE, 0xffc928, { roughness: 0.62 });

    addPart(THREE, root, new THREE.TorusGeometry(0.182, 0.016, 8, 28), vineMat, [0, 0.004, 0], [Math.PI / 2 - 0.06, 0, 0], null, 'daisy_vine');
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const flower = new THREE.Group();
      flower.name = `daisy_${i}`;
      setPos(flower, Math.sin(ang) * 0.196, 0.016 + (i % 2) * 0.012, Math.cos(ang) * 0.196);
      setRot(flower, -0.32, ang, 0);
      root.add(flower);
      for (let k = 0; k < 5; k++) {
        const b = (k / 5) * Math.PI * 2 + i * 0.4;
        addPart(THREE, flower, new THREE.SphereGeometry(0.021, 8, 6), petalMat, [Math.cos(b) * 0.031, Math.sin(b) * 0.031, 0], [0, 0, b], [1.25, 0.72, 0.38], 'daisy_petal');
      }
      addPart(THREE, flower, new THREE.SphereGeometry(0.018, 10, 8), coreMat, [0, 0, 0.007], null, [1, 1, 0.7], 'daisy_core');
      const leafAng = ang + Math.PI / 6;
      addPart(THREE, root, new THREE.SphereGeometry(0.03, 8, 6), leafMat, [Math.sin(leafAng) * 0.19, 0.002, Math.cos(leafAng) * 0.19], [0, leafAng, 0.5], [0.55, 0.28, 1.1], 'daisy_leaf');
    }
    return root;
  }

  if (hatId === 'paper_boat') {
    const paperMat = makeStdMat(THREE, 0x9fd4f5, { roughness: 0.9, flatShading: true });
    const foldMat = makeStdMat(THREE, 0x78b8e6, { roughness: 0.9, flatShading: true });
    const sailMat = makeStdMat(THREE, 0xd6eeff, { roughness: 0.9, flatShading: true });
    const mastMat = makeStdMat(THREE, 0x8a6a48, { roughness: 0.8 });
    const flagMat = makeStdMat(THREE, 0xff7f66, { roughness: 0.7 });

    // 4-sided frustum = diamond hull (pointed bow & stern on the left/right, like a folded paper hat)
    addPart(THREE, root, new THREE.CylinderGeometry(0.27, 0.16, 0.095, 4), paperMat, [0, 0.045, 0], null, [1, 1, 0.5], 'boat_hull');
    addPart(THREE, root, new THREE.CylinderGeometry(0.275, 0.262, 0.018, 4), foldMat, [0, 0.094, 0], null, [1, 1, 0.5], 'boat_gunwale');
    addPart(THREE, root, new THREE.ConeGeometry(0.135, 0.19, 4), sailMat, [0, 0.185, 0], null, [1, 1, 0.34], 'boat_peak');
    addPart(THREE, root, new THREE.CylinderGeometry(0.005, 0.005, 0.075, 6), mastMat, [0, 0.31, 0], null, null, 'boat_mast');
    addPart(THREE, root, new THREE.BoxGeometry(0.052, 0.028, 0.006), flagMat, [0.029, 0.332, 0], null, null, 'boat_pennant');
    return root;
  }

  if (hatId === 'teapot_cozy') {
    const knitMat = makeStdMat(THREE, 0x9fe0c2, { roughness: 0.9 });
    const stripeMat = makeStdMat(THREE, 0x57b892, { roughness: 0.9 });
    const creamMat = makeStdMat(THREE, 0xfff4dc, { roughness: 0.6 });
    const knobMat = makeStdMat(THREE, 0xff8a73, { roughness: 0.55 });
    const steamMat = makeBasicMat(THREE, 0xffffff, { transparent: true, opacity: 0.85 });

    addPart(THREE, root, new THREE.TorusGeometry(0.135, 0.02, 8, 22), creamMat, [0, 0.014, 0], [Math.PI / 2, 0, 0], null, 'teapot_foot');
    addPart(THREE, root, new THREE.SphereGeometry(0.17, 20, 14), knitMat, [0, 0.105, 0], null, [1.08, 0.86, 1.08], 'teapot_body');
    for (const [y, r] of [[0.058, 0.166], [0.105, 0.186], [0.152, 0.166]]) {
      addPart(THREE, root, new THREE.TorusGeometry(r, 0.011, 8, 26), stripeMat, [0, y, 0], [Math.PI / 2, 0, 0], null, 'teapot_stripe');
    }
    addPart(THREE, root, new THREE.SphereGeometry(0.078, 14, 10), creamMat, [0, 0.238, 0], null, [1, 0.42, 1], 'teapot_lid');
    addPart(THREE, root, new THREE.SphereGeometry(0.026, 10, 8), knobMat, [0, 0.278, 0], null, null, 'teapot_knob');
    addPart(THREE, root, new THREE.CylinderGeometry(0.021, 0.036, 0.14, 10), creamMat, [0.205, 0.128, 0], [0, 0, -0.95], null, 'teapot_spout');
    addPart(THREE, root, new THREE.TorusGeometry(0.062, 0.016, 8, 18), creamMat, [-0.205, 0.108, 0], null, [1, 1.15, 1], 'teapot_handle');
    addPart(THREE, root, new THREE.SphereGeometry(0.017, 8, 6), steamMat, [0.285, 0.205, 0], null, null, 'teapot_steam_a');
    addPart(THREE, root, new THREE.SphereGeometry(0.012, 8, 6), steamMat, [0.298, 0.243, 0.01], null, null, 'teapot_steam_b');
    return root;
  }

  if (hatId === 'snail_shell') {
    const shellMat = makeStdMat(THREE, 0xd08a4a, { roughness: 0.42 });
    const coilMat = makeStdMat(THREE, 0x8a5226, { roughness: 0.5 });
    const bandMat = makeStdMat(THREE, 0xf2c98a, { roughness: 0.45 });
    const bodyMat = makeStdMat(THREE, 0xf3dfb8, { roughness: 0.7 });
    const whiteMat = makeBasicMat(THREE, 0xfffef8);
    const pupilMat = makeBasicMat(THREE, 0x2a1d16);

    // Shell disc stands upright, coil faces left & right
    addPart(THREE, root, new THREE.SphereGeometry(0.15, 18, 14), shellMat, [0, 0.15, -0.025], null, [0.72, 1, 1], 'shell_disc');
    addPart(THREE, root, new THREE.TorusGeometry(0.15, 0.018, 8, 26), bandMat, [0, 0.15, -0.025], [0, Math.PI / 2, 0], null, 'shell_keel');
    for (const sx of [-1, 1]) {
      addPart(THREE, root, new THREE.TorusGeometry(0.098, 0.013, 8, 22), coilMat, [sx * 0.082, 0.15, -0.025], [0, Math.PI / 2, 0], null, 'shell_coil_outer');
      addPart(THREE, root, new THREE.TorusGeometry(0.052, 0.012, 8, 18), coilMat, [sx * 0.1, 0.155, -0.02], [0, Math.PI / 2, 0], null, 'shell_coil_inner');
      addPart(THREE, root, new THREE.SphereGeometry(0.022, 8, 6), coilMat, [sx * 0.107, 0.158, -0.018], null, [0.6, 1, 1], 'shell_core');
      addPart(THREE, root, new THREE.CylinderGeometry(0.007, 0.01, 0.085, 6), bodyMat, [sx * 0.032, 0.105, 0.178], [0.42, 0, sx * -0.24], null, 'snail_stalk');
      addPart(THREE, root, new THREE.SphereGeometry(0.02, 10, 8), whiteMat, [sx * 0.043, 0.146, 0.197], null, null, 'snail_eye');
      addPart(THREE, root, new THREE.SphereGeometry(0.01, 8, 6), pupilMat, [sx * 0.045, 0.148, 0.214], null, null, 'snail_pupil');
    }
    addPart(THREE, root, new THREE.SphereGeometry(0.09, 14, 10), bodyMat, [0, 0.022, 0.035], null, [0.92, 0.46, 1.75], 'snail_foot');
    addPart(THREE, root, new THREE.SphereGeometry(0.052, 12, 10), bodyMat, [0, 0.055, 0.165], null, [1, 0.9, 1], 'snail_head');
    return root;
  }

  if (hatId === 'lighthouse_lamp') {
    const stoneMat = makeStdMat(THREE, 0xd9d2c3, { roughness: 0.9 });
    const redMat = makeStdMat(THREE, 0xe8604c, { roughness: 0.66 });
    const creamMat = makeStdMat(THREE, 0xfff6e6, { roughness: 0.7 });
    const navyMat = makeStdMat(THREE, 0x2f4858, { roughness: 0.6 });
    const lampMat = makeBasicMat(THREE, 0xffe27a);

    const tower = new THREE.Group();
    tower.name = 'lighthouse_tower';
    setScl(tower, 0.84, 0.84, 0.84);
    root.add(tower);

    addPart(THREE, tower, new THREE.CylinderGeometry(0.125, 0.145, 0.04, 16), stoneMat, [0, 0.02, 0], null, null, 'lh_base');
    for (let i = 0; i < 4; i++) {
      const rBot = 0.108 - i * 0.014;
      addPart(THREE, tower, new THREE.CylinderGeometry(rBot - 0.014, rBot, 0.07, 16), i % 2 === 0 ? redMat : creamMat, [0, 0.075 + i * 0.07, 0], null, null, `lh_band_${i}`);
    }
    addPart(THREE, tower, new THREE.BoxGeometry(0.034, 0.05, 0.012), navyMat, [0, 0.066, 0.103], null, null, 'lh_door');
    addPart(THREE, tower, new THREE.BoxGeometry(0.022, 0.026, 0.012), navyMat, [0, 0.215, 0.074], null, null, 'lh_window');
    addPart(THREE, tower, new THREE.CylinderGeometry(0.078, 0.07, 0.016, 16), navyMat, [0, 0.328, 0], null, null, 'lh_gallery');
    addPart(THREE, tower, new THREE.TorusGeometry(0.078, 0.006, 6, 20), navyMat, [0, 0.352, 0], [Math.PI / 2, 0, 0], null, 'lh_rail');
    addPart(THREE, tower, new THREE.CylinderGeometry(0.046, 0.046, 0.07, 12), lampMat, [0, 0.371, 0], null, null, 'lh_lamp');
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      addPart(THREE, tower, new THREE.BoxGeometry(0.009, 0.07, 0.009), navyMat, [Math.sin(ang) * 0.047, 0.371, Math.cos(ang) * 0.047], [0, ang, 0], null, 'lh_mullion');
    }
    addPart(THREE, tower, new THREE.ConeGeometry(0.07, 0.07, 12), redMat, [0, 0.441, 0], null, null, 'lh_roof');
    addPart(THREE, tower, new THREE.SphereGeometry(0.013, 8, 6), lampMat, [0, 0.482, 0], null, null, 'lh_finial');
    return root;
  }

  if (hatId === 'kitsune_mask') {
    // Lv. 48 Prestige — Tilted Japanese Festival Kitsune Mask perched stylishly on forehead/side!
    const ivoryMat = makeStdMat(THREE, 0xfff8eb, { roughness: 0.72 });
    const redMat = makeStdMat(THREE, 0xd63329, { roughness: 0.7 });
    const darkMat = makeBasicMat(THREE, 0x241917);
    const cordMat = makeStdMat(THREE, 0xc92a2a, { roughness: 0.8 });
    const goldMat = makeStdMat(THREE, 0xffca3a, { roughness: 0.5 });

    addPart(THREE, root, new THREE.TorusGeometry(0.172, 0.014, 8, 24), cordMat, [0, 0.008, 0], [Math.PI / 2 - 0.12, 0, 0.12], null, 'mask_cord');
    const mask = new THREE.Group();
    setPos(mask, 0.065, 0.075, 0.125);
    setRot(mask, -0.34, 0.36, -0.18);
    root.add(mask);

    addPart(THREE, mask, new THREE.SphereGeometry(0.115, 16, 12), ivoryMat, [0, 0, 0], null, [1.02, 0.96, 0.48], 'fox_face');
    addPart(THREE, mask, new THREE.ConeGeometry(0.052, 0.095, 10), ivoryMat, [0, -0.035, 0.055], [Math.PI / 2 + 0.18, 0, 0], [0.95, 1, 0.72], 'fox_snout');
    addPart(THREE, mask, new THREE.SphereGeometry(0.02, 8, 6), darkMat, [0, -0.042, 0.102], null, [1.1, 0.85, 0.8], 'fox_nose');
    for (const sx of [-1, 1]) {
      addPart(THREE, mask, new THREE.ConeGeometry(0.044, 0.105, 8), ivoryMat, [sx * 0.068, 0.105, -0.005], [-0.08, 0, sx * -0.22], [0.85, 1, 0.45], 'fox_ear');
      addPart(THREE, mask, new THREE.ConeGeometry(0.026, 0.068, 6), redMat, [sx * 0.068, 0.102, 0.008], [-0.08, 0, sx * -0.22], [0.85, 1, 0.35], 'fox_ear_inner');
      addPart(THREE, mask, new THREE.BoxGeometry(0.042, 0.013, 0.015), darkMat, [sx * 0.046, 0.015, 0.05], [0, sx * -0.18, sx * 0.28], null, 'fox_eye');
      addPart(THREE, mask, new THREE.BoxGeometry(0.036, 0.012, 0.012), redMat, [sx * 0.062, -0.022, 0.044], [0, sx * -0.22, sx * -0.25], null, 'fox_whisker');
    }
    addPart(THREE, mask, new THREE.SphereGeometry(0.022, 8, 8), goldMat, [-0.095, -0.045, 0.01], null, null, 'shrine_bell');
    return root;
  }

  if (hatId === 'astral_halo') {
    // Lv. 95 Mythic — Floating golden constellation ring + pastel star gems
    const haloMat = makeBasicMat(THREE, 0xffe066);
    const starCols = [0xfff3b0, 0x72efdd, 0xff9ebb, 0x90dbf4];
    const GemGeo = THREE.OctahedronGeometry || THREE.SphereGeometry;

    const ringGrp = new THREE.Group();
    setPos(ringGrp, 0, 0.185, 0);
    setRot(ringGrp, 0.18, 0, -0.12);
    root.add(ringGrp);

    addPart(THREE, ringGrp, new THREE.TorusGeometry(0.19, 0.015, 10, 32), haloMat, [0, 0, 0], [Math.PI / 2, 0, 0], null, 'astral_torus');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sm = makeBasicMat(THREE, starCols[i % starCols.length]);
      addPart(THREE, ringGrp, new GemGeo(i % 2 === 0 ? 0.032 : 0.024, 0), sm, [Math.cos(a) * 0.195, (i % 2 === 0 ? 0.016 : -0.012), Math.sin(a) * 0.195], [0.3, a, 0.4], null, `astral_star_${i}`);
    }
    return root;
  }

  return null;
}

// ============================================================
// Inline Storybook SVG Illustrations for Wardrobe & Perks
// ============================================================
function renderCosmeticCardSvg(category, item) {
  if (category === 'elemGun') {
    if (item.id === 'water') {
      return `<svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r="26" fill="#dff5fc" stroke="#90dbf4" stroke-width="1.5"/>
        <rect x="20" y="40" width="8.5" height="16" rx="3.5" transform="rotate(15 24 48)" fill="#2f5f8a" stroke="#223648" stroke-width="1.7"/>
        <rect x="22" y="30" width="29" height="10" rx="5" fill="#3fb8a8" stroke="#223648" stroke-width="1.8"/>
        <rect x="48" y="28" width="6.5" height="14" rx="2.5" fill="#2f5f8a" stroke="#223648" stroke-width="1.6"/>
        <circle cx="22" cy="26.5" r="11" fill="#ffa94d" stroke="#223648" stroke-width="1.8"/>
        <circle cx="25" cy="28" r="3.6" fill="#fff8ea" stroke="#223648" stroke-width="1.2"/>
        <path d="M57 31 C62 27 66 29 64 33 C62 35 59 34 57 31 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="1.2"/>
        <path d="M58 37 C64 38 66 42 62 44 C59 45 57 41 58 37 Z" fill="#7dd3fc" stroke="#0284c7" stroke-width="1.1"/>
      </svg>`;
    }
    if (item.id === 'fire') {
      return `<svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r="26" fill="#ffe8d4" stroke="#f7b277" stroke-width="1.5"/>
        <rect x="18" y="41" width="9" height="16" rx="3.2" transform="rotate(16 22 49)" fill="#6b3e26" stroke="#2a1d17" stroke-width="1.7"/>
        <rect x="19" y="31" width="32" height="11.5" rx="4.5" fill="#3d3532" stroke="#231c19" stroke-width="1.8"/>
        <rect x="33" y="30.5" width="4" height="12.5" rx="1.2" fill="#e8a838" stroke="#231c19" stroke-width="1.3"/>
        <path d="M49 29 L56 27 L56 46 L49 44 Z" fill="#524642" stroke="#231c19" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="M24 32 C15 30 14 19 21 15 C22 19 25 18 26 11 C31 15 33 19 34 14 C39 19 37 30 29 32 Z" fill="#ff4d24" stroke="#9e1f08" stroke-width="1.5"/>
        <path d="M25 31 C20 29 20 22 26 18 C28 21 32 22 31 29 Z" fill="#ffb703"/>
        <circle cx="24" cy="25.5" r="2.3" fill="#fffdf5"/><circle cx="29.5" cy="25.5" r="2.3" fill="#fffdf5"/>
        <circle cx="24.4" cy="25.6" r="1.1" fill="#1e1512"/><circle cx="29.9" cy="25.6" r="1.1" fill="#1e1512"/>
        <circle cx="60" cy="31" r="2.4" fill="#ff6b2b"/><circle cx="63" cy="38" r="1.8" fill="#ffb703"/>
      </svg>`;
    }
    if (item.id === 'snow') {
      return `<svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r="26" fill="#e2f3ff" stroke="#90cdf4" stroke-width="1.5"/>
        <rect x="19" y="40" width="8.5" height="16" rx="3.2" transform="rotate(15 23 48)" fill="#3b6998" stroke="#1e3a5f" stroke-width="1.7"/>
        <rect x="22" y="31" width="29" height="9.5" rx="4.2" fill="#7cc6ee" stroke="#1e3a5f" stroke-width="1.7"/>
        <path d="M30 30 L32 41.5 M36 30 L38 41.5 M42 30 L44 41.5" stroke="#d8fbff" stroke-width="2.4" stroke-linecap="round"/>
        <polygon points="14,26 22,16 31,21 29,32 18,33" fill="#bdf0ff" stroke="#1e3a5f" stroke-width="1.7"/>
        <polygon points="49,29 56,27 56,44 49,42" fill="#4ea8de" stroke="#1e3a5f" stroke-width="1.6"/>
        <g stroke="#2b8ad9" stroke-width="1.7" stroke-linecap="round">
          <line x1="61" y1="21" x2="61" y2="33"/><line x1="55.8" y1="24" x2="66.2" y2="30"/><line x1="66.2" y1="24" x2="55.8" y2="30"/>
        </g>
      </svg>`;
    }
    if (item.id === 'earth') {
      return `<svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r="26" fill="#eee8d5" stroke="#c8ba96" stroke-width="1.5"/>
        <rect x="19" y="41" width="9" height="15.5" rx="3" transform="rotate(15 23 48)" fill="#593e25" stroke="#2c2219" stroke-width="1.7"/>
        <polygon points="16,29 49,27 53,31 53,42 49,45 18,43" fill="#8b8274" stroke="#2c2219" stroke-width="1.8"/>
        <path d="M19 29 Q25 23 32 28 Q38 24 44 28 L30 30 Z" fill="#67a844" stroke="#355e22" stroke-width="1.4"/>
        <polygon points="23,33 29,30 35,34 33,40 25,40" fill="#ffb703" stroke="#8f5300" stroke-width="1.4"/>
        <polygon points="57,24 64,22 65,29 59,31" fill="#9c8f7e" stroke="#2c2219" stroke-width="1.5"/>
      </svg>`;
    }
    if (item.id === 'air') {
      return `<svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r="26" fill="#e3f8f2" stroke="#8ce0c9" stroke-width="1.5"/>
        <rect x="20" y="40" width="8.5" height="16" rx="3.2" transform="rotate(15 24 48)" fill="#73482d" stroke="#2a211b" stroke-width="1.7"/>
        <polygon points="14,31 23,23 26,31" fill="#2a9d8f" stroke="#1d3d3a" stroke-width="1.6"/>
        <rect x="19" y="29" width="30" height="12" rx="6" fill="#f6f1de" stroke="#2a211b" stroke-width="1.8"/>
        <ellipse cx="49" cy="35" rx="4.5" ry="8.2" fill="#e9c46a" stroke="#2a211b" stroke-width="1.7"/>
        <path d="M55 29 C61 25 66 28 63 32 C61 34 57 33 59 30" fill="none" stroke="#2a9d8f" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    }
  }

  if (category === 'hiderPerk' || category === 'seekerPerk') {
    const isHider = category === 'hiderPerk';
    const bg = isHider ? '#e6f5dc' : '#dff2fc';
    const stroke = isHider ? '#62ab48' : '#3a95c9';
    return `<svg viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="25" fill="${bg}" stroke="${stroke}" stroke-width="2.2"/>
      <circle cx="36" cy="36" r="29.5" fill="none" stroke="${stroke}" stroke-width="1.3" stroke-dasharray="4 4" opacity="0.55"/>
      <text x="36" y="45" text-anchor="middle" font-size="27">${item.icon || '✨'}</text>
    </svg>`;
  }

  if (category === 'hat' && item.id === 'ribbon_bow') {
    return `<svg viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="24" fill="#f3ebd8" stroke="#c8b894" stroke-width="2"/>
      <path d="M36 36 L17 24 Q12 36 17 48 Z" fill="#2bb5a8" stroke="#16665f" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M36 36 L55 24 Q60 36 55 48 Z" fill="#2bb5a8" stroke="#16665f" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M33 39 L28 53 L34 50 L36 42 Z M39 39 L44 53 L38 50 L36 42 Z" fill="#1c8c84" stroke="#16665f" stroke-width="1.4" stroke-linejoin="round"/>
      <rect x="31" y="30.5" width="10" height="11" rx="4" fill="#58d3c6" stroke="#16665f" stroke-width="1.8"/>
      <g fill="#fff3d6"><circle cx="21" cy="31" r="1.9"/><circle cx="25" cy="39" r="1.7"/><circle cx="19.5" cy="42" r="1.6"/><circle cx="51" cy="31" r="1.9"/><circle cx="47" cy="39" r="1.7"/><circle cx="52.5" cy="42" r="1.6"/></g>
    </svg>`;
  }

  if (category === 'blaster' && item.colors) {
    const hexCss = (n) => '#' + n.toString(16).padStart(6, '0');
    const tank = hexCss(item.colors.tank);
    const barrel = hexCss(item.colors.barrel);
    const grip = hexCss(item.colors.grip);
    return `<svg viewBox="0 0 72 72" aria-hidden="true">
      <rect x="23" y="40" width="9" height="17" rx="3.5" transform="rotate(14 27 48)" fill="${grip}" stroke="#2b2520" stroke-width="1.8"/>
      <rect x="24" y="30" width="32" height="10" rx="5" fill="${barrel}" stroke="#2b2520" stroke-width="1.8"/>
      <rect x="53" y="28.5" width="6" height="13" rx="2.5" fill="${grip}" stroke="#2b2520" stroke-width="1.6"/>
      <circle cx="24" cy="27" r="11.5" fill="${tank}" stroke="#2b2520" stroke-width="1.9"/>
      <ellipse cx="20.5" cy="23" rx="4" ry="2.4" transform="rotate(-25 20.5 23)" fill="#ffffff" opacity="0.55"/>
    </svg>`;
  }

  return `<svg viewBox="0 0 72 72" aria-hidden="true">
    <circle cx="36" cy="36" r="24" fill="#f3ebd8" stroke="#c8b894" stroke-width="2"/>
    <text x="36" y="45" text-anchor="middle" font-size="27">${item.icon || '✨'}</text>
  </svg>`;
}

function getTodayKey() {
  try {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch (_) {
    return '2026-11-15';
  }
}

const DAILY_CONTRACT_BY_ID = new Map(DAILY_CONTRACT_POOL.map((c) => [c.id, c]));
// Token-priced cosmetic categories (everything else on the road is level-gated)
const SHOP_CATEGORIES = ['hat', 'taunt', 'poof', 'blaster'];

function createFreshDailyContracts(dateKey) {
  // ids: null = the date-seeded default trio; rerolls write an explicit trio + per-contract baselines
  return { dateKey, progress: {}, claimed: [], ids: null, baseline: {}, rerolls: 0 };
}

function pickDailyContractsForDate(dateKey) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < dateKey.length; i++) {
    h = Math.imul(h ^ dateKey.charCodeAt(i), 16777619) >>> 0;
  }
  const pool = [...DAILY_CONTRACT_POOL];
  const chosen = [];
  while (chosen.length < 3 && pool.length > 0) {
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
    const idx = h % pool.length;
    chosen.push(pool.splice(idx, 1)[0]);
  }
  return chosen;
}

// ============================================================
// Progression & 99-Level Spirit Journey Manager Factory
// ============================================================
export function createProgressionManager(env = {}) {
  const DEFAULT_ACH_STATS = {
    blasterHits: 0,
    matchesCompleted: 0,
    matchesWon: 0,
    surviveSec: 0,
    propsMorphed: 0,
    tacticalPlays: 0,
    spiritsSoaked: 0,
    airPlays: 0,
    elemGunsUnlocked: 0,
  };

  function normalizeAccountName(raw) {
    return String(raw || '').trim().toLowerCase();
  }

  function readStoredGamertag() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        return localStorage.getItem(GAMERTAG_STORAGE_KEY) || '';
      }
    } catch (_) { /* ignore */ }
    return '';
  }

  function readBoolStorage(key, fallback) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const val = localStorage.getItem(key);
        if (val === '1') return true;
        if (val === '0') return false;
      }
    } catch (_) { /* ignore */ }
    return fallback;
  }

  function writeStorageSafe(key, val) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(key, val);
      }
    } catch (_) { /* ignore */ }
  }

  function hasUrlAdminFlag() {
    try {
      if (typeof window !== 'undefined' && window.location) {
        return new URLSearchParams(window.location.search).get('admin') === '1';
      }
    } catch (_) { /* ignore */ }
    return false;
  }

  function isAdminAccountName(name) {
    return ADMIN_ACCOUNTS.has(normalizeAccountName(name));
  }

  let state = loadState();
  let activeAccountName = readStoredGamertag();
  let adminByIdentity = isAdminAccountName(activeAccountName);
  let adminByFlag = readBoolStorage(ADMIN_ACCESS_STORAGE_KEY, false) || hasUrlAdminFlag();
  let adminWorldBypass = readBoolStorage(ADMIN_BYPASS_STORAGE_KEY, true);

  let activeTab = 'journey';
  let lastUnlockedItemId = null;
  let matchSessionTokens = 0;
  let matchSessionXp = 0;
  let matchActionXpUsed = 0;
  let matchActionTokUsed = 0;
  let matchTokCapNoticeShown = false;
  let matchXpCapNoticeShown = false;
  let lastMatchSummaryMeta = null;
  let lastFractionalSaveAt = 0;

  const dom = {
    strip: null,
    lvBadge: null,
    xpFill: null,
    xpText: null,
    nextUnlockPill: null,
    streakPill: null,
    tokenPill: null,
    tokenCount: null,
    equippedRow: null,
    openBtn: null,
    adminBtn: null,
    adminModalBtn: null,
    adminModal: null,
    adminMetaTxt: null,
    adminBypassBtn: null,
    adminWorldGrid: null,
    modal: null,
    walletCount: null,
    lvMini: null,
    tabsHost: null,
    gridHost: null,
    feedback: null,
    toastHost: null,
  };

  let uiAudioCtx = null;
  const activeBursts = [];
  let cachedGeos = null;

  function createDefaultState() {
    const today = getTodayKey();
    return {
      schemaVersion: SCHEMA_VERSION,
      tokens: STARTER_TOKENS,
      xp: 0,
      level: 1,
      winStreak: 0,
      bestWinStreak: 0,
      trophies: 0,
      bestTrophies: 0,
      personaStats: { boops: 0, rescues: 0, maxWantedStars: 0, bounties: 0, stealthWins: 0 },
      unlocked: {
        elemGun: ['water'],
        hiderPerk: ['none'],
        seekerPerk: ['none'],
        hat: ['none'],
        taunt: ['chirp'],
        poof: ['classic'],
        blaster: ['classic'],
      },
      equipped: { ...DEFAULT_EQUIPPED },
      trialElemGun: null,
      achStats: { ...DEFAULT_ACH_STATS },
      achievementsUnlocked: [],
      dailyContracts: createFreshDailyContracts(today),
      luckyCharm: 0,
      firstMatchBonusClaimed: false,
      loginStreak: { streak: 0, lastClaimDate: '' },
      spiritChest: { points: 0, opened: 0 },
      dailyTrialDate: '',
    };
  }

  function syncLevelGatedUnlocksIntoObj(level, unlocked) {
    const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
    // 1. Elemental Guns are strictly earned by reaching their Level!
    const validElemGuns = ['water'];
    for (const item of COSMETIC_CATALOG.elemGun) {
      if (lv >= (item.levelReq || 1) && !validElemGuns.includes(item.id)) {
        validElemGuns.push(item.id);
      }
    }
    unlocked.elemGun = validElemGuns;

    // 2. Hider & Seeker Perks by Level
    unlocked.hiderPerk = HIDER_PERKS.filter((p) => lv >= (p.levelReq || 1)).map((p) => p.id);
    unlocked.seekerPerk = SEEKER_PERKS.filter((p) => lv >= (p.levelReq || 1)).map((p) => p.id);

    // 3. Level-gated Prestige Hats / Poofs / Blaster Skins
    for (const cat of ['hat', 'poof', 'blaster']) {
      if (!Array.isArray(unlocked[cat])) unlocked[cat] = [DEFAULT_EQUIPPED[cat]];
      for (const item of COSMETIC_CATALOG[cat]) {
        if (item.levelReq && lv >= item.levelReq && !unlocked[cat].includes(item.id)) {
          unlocked[cat].push(item.id);
        }
      }
    }
  }

  function sanitizeState(raw) {
    const base = createDefaultState();
    if (!raw || typeof raw !== 'object') return base;

    let tokens = Number.isFinite(Number(raw.tokens)) ? Math.max(0, Math.floor(Number(raw.tokens))) : STARTER_TOKENS;
    let level = Number.isFinite(Number(raw.level)) ? Math.max(1, Math.floor(Number(raw.level))) : 1;
    let xp = Number.isFinite(Number(raw.xp)) ? Math.max(0, Math.floor(Number(raw.xp))) : 0;

    // Migrate v1 profiles cleanly onto the harder 99-Level XP curve!
    const rawVer = Number(raw.schemaVersion) || 1;
    if (rawVer < 2) {
      let oldLifetimeXp = xp;
      for (let i = 1; i < Math.min(level, 99); i++) {
        oldLifetimeXp += 100 + (i - 1) * 35;
      }
      // Scale inflated v1 XP (where 1 match gave ~700 XP) onto our long-term 99-level curve
      let remXp = Math.round(oldLifetimeXp * 0.58);
      let newLv = 1;
      while (newLv < MAX_LEVEL && remXp >= xpNeededForLevel(newLv)) {
        remXp -= xpNeededForLevel(newLv);
        newLv += 1;
      }
      level = newLv;
      xp = newLv >= MAX_LEVEL ? 0 : remXp;
    }

    level = Math.max(1, Math.min(MAX_LEVEL, level));
    if (level >= MAX_LEVEL) xp = 0;

    const unlocked = {};
    const equipped = {};

    for (const cat of Object.keys(COSMETIC_CATALOG)) {
      const validIds = new Set(COSMETIC_CATALOG[cat].map((x) => x.id));
      const freeId = DEFAULT_EQUIPPED[cat];
      const list = Array.isArray(raw.unlocked && raw.unlocked[cat]) ? raw.unlocked[cat] : [];
      const cleanSet = new Set([freeId]);
      if (cat !== 'elemGun' && cat !== 'hiderPerk' && cat !== 'seekerPerk') {
        for (const id of list) {
          const item = COSMETIC_CATALOG[cat].find((x) => x.id === id);
          if (validIds.has(id) && (!item?.levelReq || level >= item.levelReq)) {
            cleanSet.add(id);
          }
        }
      }
      unlocked[cat] = Array.from(cleanSet);
    }

    syncLevelGatedUnlocksIntoObj(level, unlocked);

    for (const cat of Object.keys(COSMETIC_CATALOG)) {
      const validIds = new Set(COSMETIC_CATALOG[cat].map((x) => x.id));
      const freeId = DEFAULT_EQUIPPED[cat];
      const reqEq = raw.equipped && raw.equipped[cat];
      equipped[cat] = validIds.has(reqEq) && unlocked[cat].includes(reqEq) ? reqEq : freeId;
    }

    const achStats = { ...DEFAULT_ACH_STATS };
    if (raw.achStats && typeof raw.achStats === 'object') {
      for (const [k, v] of Object.entries(raw.achStats)) {
        const num = Number(v);
        if (Number.isFinite(num) && num >= 0) achStats[k] = num;
      }
    }
    achStats.elemGunsUnlocked = COSMETIC_CATALOG.elemGun.filter((g) => unlocked.elemGun.includes(g.id)).length;

    const validAchIds = new Set(ACHIEVEMENTS.map((a) => a.id));
    const achUnlockedSet = new Set();
    if (Array.isArray(raw.achievementsUnlocked)) {
      for (const id of raw.achievementsUnlocked) {
        if (validAchIds.has(id)) achUnlockedSet.add(id);
      }
    }

    const today = getTodayKey();
    const dailyContracts = createFreshDailyContracts(today);
    const rawDc = raw.dailyContracts;
    if (rawDc && typeof rawDc === 'object' && rawDc.dateKey === today) {
      if (rawDc.progress && typeof rawDc.progress === 'object') {
        for (const [k, v] of Object.entries(rawDc.progress)) {
          const num = Number(v);
          if (Number.isFinite(num) && num >= 0) dailyContracts.progress[k] = num;
        }
      }
      // Unknown / renamed contract ids are dropped quietly
      if (Array.isArray(rawDc.claimed)) {
        dailyContracts.claimed = [...new Set(rawDc.claimed.filter((id) => DAILY_CONTRACT_BY_ID.has(id)))];
      }
      if (Array.isArray(rawDc.ids)) {
        const ids = [...new Set(rawDc.ids.filter((id) => DAILY_CONTRACT_BY_ID.has(id)))];
        if (ids.length === 3) dailyContracts.ids = ids;
      }
      if (dailyContracts.ids && rawDc.baseline && typeof rawDc.baseline === 'object') {
        for (const id of dailyContracts.ids) {
          const num = Number(rawDc.baseline[id]);
          if (Number.isFinite(num) && num > 0) dailyContracts.baseline[id] = num;
        }
      }
      dailyContracts.rerolls = Math.max(0, Math.min(999, Math.floor(Number(rawDc.rerolls) || 0)));
    }

    // One-time "First Match" bonus: only profiles that never finished a match are still eligible
    const firstMatchBonusClaimed = raw.firstMatchBonusClaimed === true
      || level > 1
      || achStats.matchesCompleted > 0
      || achStats.matchesWon > 0;

    const rawLogin = raw.loginStreak && typeof raw.loginStreak === 'object' ? raw.loginStreak : {};
    const loginStreak = {
      streak: Math.max(0, Math.min(999, Math.floor(Number(rawLogin.streak) || 0))),
      lastClaimDate: typeof rawLogin.lastClaimDate === 'string' ? rawLogin.lastClaimDate.slice(0, 10) : '',
    };
    const rawChest = raw.spiritChest && typeof raw.spiritChest === 'object' ? raw.spiritChest : {};
    const spiritChest = {
      points: Math.max(0, Math.min(SPIRIT_CHEST_TARGET, Number(rawChest.points) || 0)),
      opened: Math.max(0, Math.floor(Number(rawChest.opened) || 0)),
    };
    const dailyTrialDate = typeof raw.dailyTrialDate === 'string' ? raw.dailyTrialDate.slice(0, 10) : '';

    return {
      schemaVersion: SCHEMA_VERSION,
      tokens,
      xp,
      level,
      winStreak: Math.max(0, Math.floor(Number(raw.winStreak) || 0)),
      bestWinStreak: Math.max(0, Math.floor(Number(raw.bestWinStreak) || 0)),
      trophies: Math.max(0, Math.floor(Number(raw.trophies) || 0)),
      bestTrophies: Math.max(0, Math.floor(Number(raw.bestTrophies) || Number(raw.trophies) || 0)),
      personaStats: {
        boops: Math.max(0, Math.floor(Number(raw.personaStats?.boops) || 0)),
        rescues: Math.max(0, Math.floor(Number(raw.personaStats?.rescues) || 0)),
        maxWantedStars: Math.max(0, Math.min(5, Math.floor(Number(raw.personaStats?.maxWantedStars) || 0))),
        bounties: Math.max(0, Math.floor(Number(raw.personaStats?.bounties) || 0)),
        stealthWins: Math.max(0, Math.floor(Number(raw.personaStats?.stealthWins) || 0)),
      },
      unlocked,
      equipped,
      trialElemGun: (typeof raw.trialElemGun === 'string' && COSMETIC_CATALOG.elemGun.some((g) => g.id === raw.trialElemGun)) ? raw.trialElemGun : null,
      achStats,
      achievementsUnlocked: Array.from(achUnlockedSet),
      dailyContracts,
      luckyCharm: Number(raw.luckyCharm) >= 1 ? 1 : 0,
      firstMatchBonusClaimed,
      loginStreak,
      spiritChest,
      dailyTrialDate,
    };
  }

  function loadState() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = sanitizeState(JSON.parse(raw));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch (_) {
      // Fallback to starter profile
    }
    return createDefaultState();
  }

  function saveState() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch (_) { /* ignore */ }
    if (typeof env.onStateSaved === 'function') {
      try { env.onStateSaved(); } catch (_) { /* cloud sync must never break a local save */ }
    }
  }

  function ensureDailyContractsFresh() {
    const today = getTodayKey();
    if (!state.dailyContracts || state.dailyContracts.dateKey !== today) {
      state.dailyContracts = createFreshDailyContracts(today);
    }
  }

  function getActiveContractDefs() {
    ensureDailyContractsFresh();
    const dc = state.dailyContracts;
    if (Array.isArray(dc.ids) && dc.ids.length === 3) {
      const defs = dc.ids.map((id) => DAILY_CONTRACT_BY_ID.get(id)).filter(Boolean);
      if (defs.length === 3) return defs;
    }
    return pickDailyContractsForDate(dc.dateKey);
  }

  function getDailyContractsStatus() {
    const defs = getActiveContractDefs();
    const baseline = state.dailyContracts.baseline || {};
    return defs.map((d) => {
      // Rerolled-in contracts only count progress made AFTER the reroll (baseline)
      const sinceRoll = (Number(state.dailyContracts.progress[d.stat]) || 0) - (Number(baseline[d.id]) || 0);
      const cur = Math.min(d.target, Math.max(0, Math.floor(sinceRoll)));
      const done = state.dailyContracts.claimed.includes(d.id) || cur >= d.target;
      return {
        ...d,
        progress: done ? d.target : cur,
        done,
        ratio: d.target > 0 ? Math.min(1, cur / d.target) : 1,
      };
    });
  }

  // ============================================================
  // Repeatable Token Sinks: Contract Reroll + Lucky Charm
  // ============================================================
  function getContractRerollCost() {
    ensureDailyContractsFresh();
    return CONTRACT_REROLL_BASE_COST + CONTRACT_REROLL_STEP_COST * (state.dailyContracts.rerolls || 0);
  }

  function rerollDailyContracts() {
    const status = getDailyContractsStatus();
    const cost = getContractRerollCost();
    const openCount = status.filter((c) => !c.done).length;
    if (openCount === 0) return { ok: false, reason: 'all_done', cost };
    if (state.tokens < cost) return { ok: false, reason: 'tokens', cost, missing: cost - state.tokens };

    const dc = state.dailyContracts;
    const currentIds = status.map((c) => c.id);
    const blocked = new Set([...currentIds, ...dc.claimed]);
    const candidates = DAILY_CONTRACT_POOL.filter((c) => !blocked.has(c.id));
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const nextIds = currentIds.slice();
    const baseline = { ...(dc.baseline || {}) };
    let replaced = 0;
    status.forEach((c, slot) => {
      if (c.done) return;
      const pick = candidates.shift();
      if (!pick) return;
      delete baseline[c.id];
      nextIds[slot] = pick.id;
      baseline[pick.id] = Number(dc.progress[pick.stat]) || 0;
      replaced += 1;
    });
    if (replaced === 0) return { ok: false, reason: 'all_done', cost };

    state.tokens -= cost;
    dc.ids = nextIds;
    dc.baseline = baseline;
    dc.rerolls = (dc.rerolls || 0) + 1;
    saveState();
    syncStripUI(true);
    return { ok: true, cost, replaced, nextCost: getContractRerollCost(), totalTokens: state.tokens };
  }

  function hasLuckyCharm() {
    return (state.luckyCharm || 0) > 0;
  }

  function buyLuckyCharm() {
    if (hasLuckyCharm()) return { ok: false, reason: 'active', cost: LUCKY_CHARM_COST };
    if (state.tokens < LUCKY_CHARM_COST) {
      return { ok: false, reason: 'tokens', cost: LUCKY_CHARM_COST, missing: LUCKY_CHARM_COST - state.tokens };
    }
    state.tokens -= LUCKY_CHARM_COST;
    state.luckyCharm = 1;
    saveState();
    syncStripUI(true);
    return { ok: true, cost: LUCKY_CHARM_COST, totalTokens: state.tokens };
  }

  function getCollectionStats() {
    let total = 0;
    let owned = 0;
    let remainingCost = 0;
    let next = null;
    for (const cat of SHOP_CATEGORIES) {
      for (const it of COSMETIC_CATALOG[cat]) {
        if (!(it.cost > 0) || it.levelReq) continue;
        total += 1;
        if (isUnlocked(cat, it.id)) {
          owned += 1;
        } else {
          remainingCost += it.cost;
          if (!next || it.cost < next.item.cost) next = { category: cat, item: it };
        }
      }
    }
    return { total, owned, remaining: total - owned, remainingCost, next };
  }

  function getItem(category, id) {
    const list = COSMETIC_CATALOG[category] || [];
    return list.find((it) => it.id === id) || list[0] || null;
  }

  function isAdmin() {
    return Boolean(adminByIdentity || adminByFlag);
  }

  function isAdminBypassActive() {
    return Boolean(isAdmin() && adminWorldBypass);
  }

  function promoteProfileToLevel(targetLv, opts = {}) {
    const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(targetLv) || 1)));
    state.level = lv;
    state.xp = 0;
    if (typeof opts.minTokens === 'number') {
      state.tokens = Math.max(state.tokens, opts.minTokens);
    }
    syncLevelGatedUnlocksIntoObj(lv, state.unlocked);
    for (const cat of ['hat', 'poof', 'blaster']) {
      if (!Array.isArray(state.unlocked[cat])) state.unlocked[cat] = [DEFAULT_EQUIPPED[cat]];
    }
    writeStorageSafe(ADMIN_WALID_LV99_KEY, opts.manual ? 'manual' : (lv >= MAX_LEVEL ? '1' : 'manual'));
    saveState();
  }

  function syncIdentity(name, opts = {}) {
    const clean = String(name ?? readStoredGamertag() ?? '').trim();
    activeAccountName = clean;
    const wasAdmin = isAdmin();
    const isWalid = isAdminAccountName(clean);
    adminByIdentity = isWalid;

    let promotedNow = false;
    if (isWalid) {
      let seedFlag = '';
      try {
        if (typeof localStorage !== 'undefined' && localStorage) {
          seedFlag = localStorage.getItem(ADMIN_WALID_LV99_KEY) || '';
        }
      } catch (_) { /* ignore */ }
      if (seedFlag !== 'manual' && !opts.noPromote && (state.level < MAX_LEVEL || seedFlag !== '1')) {
        promoteProfileToLevel(MAX_LEVEL, { minTokens: 5000, manual: false });
        promotedNow = true;
      }
    }

    if (promotedNow || wasAdmin !== isAdmin()) {
      syncStripUI(false);
      syncWardrobeHeader();
      syncAdminModalUI();
      if (dom.modal && dom.modal.classList.contains('on')) renderWardrobeGrid();
      if (!opts.noCallbacks) {
        try { env.onLevelChanged?.(state.level); } catch (_) { /* ignore */ }
        try { env.onMapUnlocked?.(); } catch (_) { /* ignore */ }
        try { env.onElemGunChanged?.(getActiveElemGun()); } catch (_) { /* ignore */ }
      }
      if (promotedNow && !opts.silent && dom.toastHost) {
        spawnHudToast('👑', `Admin Access · ${clean} Lv. 99!`, 'All 6 Worlds, Elemental Guns & Perks unlocked!', 'level-up');
      }
    } else {
      syncAdminModalUI();
    }
    return isAdmin();
  }

  function setAdminAccess(enabled) {
    adminByFlag = Boolean(enabled);
    writeStorageSafe(ADMIN_ACCESS_STORAGE_KEY, adminByFlag ? '1' : '0');
    syncStripUI(false);
    syncAdminModalUI();
    if (dom.modal && dom.modal.classList.contains('on')) renderWardrobeGrid();
    try { env.onLevelChanged?.(state.level); } catch (_) { /* ignore */ }
    try { env.onMapUnlocked?.(); } catch (_) { /* ignore */ }
    try { env.onElemGunChanged?.(getActiveElemGun()); } catch (_) { /* ignore */ }
    return isAdmin();
  }

  function setAdminBypass(enabled) {
    adminWorldBypass = Boolean(enabled);
    writeStorageSafe(ADMIN_BYPASS_STORAGE_KEY, adminWorldBypass ? '1' : '0');
    syncStripUI(false);
    syncAdminModalUI();
    if (dom.modal && dom.modal.classList.contains('on')) renderWardrobeGrid();
    try { env.onLevelChanged?.(state.level); } catch (_) { /* ignore */ }
    try { env.onMapUnlocked?.(); } catch (_) { /* ignore */ }
    try { env.onElemGunChanged?.(getActiveElemGun()); } catch (_) { /* ignore */ }
    return adminWorldBypass;
  }

  function setLevelForAdmin(targetLv) {
    promoteProfileToLevel(targetLv, { manual: true });
    syncStripUI(false);
    syncWardrobeHeader();
    syncAdminModalUI();
    if (dom.modal && dom.modal.classList.contains('on')) renderWardrobeGrid();
    try { env.onLevelChanged?.(state.level); } catch (_) { /* ignore */ }
    try { env.onMapUnlocked?.(); } catch (_) { /* ignore */ }
    try { env.onElemGunChanged?.(getActiveElemGun()); } catch (_) { /* ignore */ }
    return state.level;
  }

  function isUnlocked(category, id) {
    if (isAdminBypassActive() && (category === 'elemGun' || category === 'hiderPerk' || category === 'seekerPerk')) {
      return true;
    }
    return Array.isArray(state.unlocked[category]) && state.unlocked[category].includes(id);
  }

  function isMapUnlocked(mapId) {
    if (!mapId || mapId === 'meadow' || mapId === 'tutorial') return true;
    if (isAdminBypassActive()) return true;
    const req = MAP_UNLOCK_LEVELS[mapId] || 1;
    return state.level >= req;
  }

  function getMapUnlockLevel(mapId) {
    return MAP_UNLOCK_LEVELS[mapId] || 1;
  }

  function getNextMajorUnlock(fromLevel = state.level) {
    for (const node of LEVEL_ROAD) {
      if (node.level > fromLevel && node.major) return node;
    }
    return null;
  }

  function hasAffordableLockedItem() {
    for (const cat of SHOP_CATEGORIES) {
      for (const it of COSMETIC_CATALOG[cat]) {
        if (it.cost > 0 && !it.levelReq && !isUnlocked(cat, it.id) && state.tokens >= it.cost) return true;
      }
    }
    return false;
  }

  // Counts all 5 Elemental Blasters (starter Hydro Splasher included) so the
  // "Unlock all 5" bounty shows the same number it asks for.
  function countUnlockedSpecialElemGuns() {
    const list = state.unlocked.elemGun || [];
    let count = 0;
    for (const gun of COSMETIC_CATALOG.elemGun) {
      if (list.includes(gun.id)) count += 1;
    }
    return count;
  }

  // ============================================================
  // Cozy Procedural WebAudio Chimes
  // ============================================================
  function isMuted() {
    try {
      if (env.audio && typeof env.audio.isMuted === 'function') return !!env.audio.isMuted();
    } catch (_) { /* ignore */ }
    return false;
  }

  function ensureUiAudio() {
    if (isMuted() || typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!uiAudioCtx) {
      try { uiAudioCtx = new AC(); } catch (_) { return null; }
    }
    if (uiAudioCtx.state === 'suspended') {
      uiAudioCtx.resume().catch(() => {});
    }
    return uiAudioCtx;
  }

  function playNotes(notes) {
    const ctx = ensureUiAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const [freq, delay, dur, gainVal, type = 'triangle'] of notes) {
      try {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + delay);
        g.gain.setValueAtTime(0.0001, now + delay);
        g.gain.linearRampToValueAtTime(gainVal, now + delay + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + dur + 0.02);
      } catch (_) { /* ignore */ }
    }
  }

  function playCoinUnlockChime() {
    playNotes([
      [987.77, 0.0, 0.14, 0.11, 'triangle'],
      [1318.51, 0.065, 0.24, 0.13, 'triangle'],
      [1567.98, 0.13, 0.28, 0.11, 'sine'],
      [1975.53, 0.195, 0.34, 0.09, 'sine'],
    ]);
  }

  function playAchievementUnlockChime() {
    playNotes([
      [587.33, 0.0, 0.16, 0.10, 'triangle'],
      [739.99, 0.075, 0.18, 0.11, 'triangle'],
      [880.00, 0.15, 0.20, 0.11, 'triangle'],
      [1174.66, 0.23, 0.36, 0.13, 'sine'],
      [1479.98, 0.31, 0.42, 0.10, 'sine'],
      [1760.00, 0.39, 0.48, 0.08, 'sine'],
    ]);
  }

  function playTokenToastChime(leveledUp) {
    if (leveledUp) {
      playNotes([
        [523.25, 0.0, 0.18, 0.09, 'triangle'],
        [659.25, 0.07, 0.2, 0.1, 'triangle'],
        [783.99, 0.14, 0.22, 0.1, 'triangle'],
        [1046.5, 0.21, 0.38, 0.12, 'sine'],
        [1318.51, 0.29, 0.42, 0.09, 'sine'],
      ]);
    } else {
      playNotes([
        [880, 0.0, 0.11, 0.075, 'sine'],
        [1174.66, 0.055, 0.18, 0.085, 'triangle'],
      ]);
    }
  }

  function playShortTokensKnock() {
    playNotes([
      [230, 0.0, 0.09, 0.09, 'triangle'],
      [182, 0.075, 0.12, 0.09, 'triangle'],
    ]);
  }

  function playFallbackTauntSynth(tauntId) {
    if (tauntId === 'duck') {
      playNotes([[640, 0, 0.09, 0.11, 'sawtooth'], [790, 0.03, 0.09, 0.09, 'triangle'], [660, 0.13, 0.11, 0.11, 'sawtooth']]);
    } else if (tauntId === 'windchime') {
      playNotes([[1568, 0, 0.36, 0.08, 'sine'], [2093, 0.08, 0.42, 0.07, 'sine'], [2349, 0.18, 0.46, 0.06, 'sine']]);
    } else if (tauntId === 'emberwick') {
      playNotes([[310, 0, 0.06, 0.09, 'square'], [520, 0.05, 0.05, 0.08, 'triangle'], [420, 0.11, 0.07, 0.09, 'square']]);
    } else if (tauntId === 'ocarina') {
      playNotes([[587.33, 0, 0.22, 0.1, 'sine'], [698.46, 0.19, 0.22, 0.1, 'sine'], [880, 0.38, 0.36, 0.11, 'sine']]);
    } else {
      playNotes([[1046.5, 0, 0.09, 0.09, 'sine'], [1396.9, 0.07, 0.14, 0.1, 'sine']]);
    }
  }

  function notifyLockedMap(mapId, mapTitle = 'World') {
    const req = getMapUnlockLevel(mapId);
    playShortTokensKnock();
    spawnHudToast(
      '🔒',
      `${mapTitle} unlocks at Level ${req}!`,
      `You are Lv. ${state.level} — win matches to accelerate XP!`,
      'warn'
    );
  }

  // ============================================================
  // Core XP, Level-Up Milestone Processor, Streaks & Contracts
  // ============================================================
  function resetMatchSessionCounter() {
    matchSessionTokens = 0;
    matchSessionXp = 0;
    matchActionXpUsed = 0;
    matchActionTokUsed = 0;
    matchTokCapNoticeShown = false;
    matchXpCapNoticeShown = false;
    lastMatchSummaryMeta = null;
  }

  function spawnHudToast(icon, titleText, subText = '', variantOrLevelUp = false) {
    if (typeof document === 'undefined') return;
    if (!dom.toastHost) {
      dom.toastHost = document.getElementById('progToastHost');
    }
    if (!dom.toastHost) return;

    while (dom.toastHost.children.length >= 4) {
      dom.toastHost.removeChild(dom.toastHost.firstElementChild);
    }

    const variant =
      variantOrLevelUp === true
        ? 'level-up'
        : typeof variantOrLevelUp === 'string' && variantOrLevelUp
          ? variantOrLevelUp
          : '';

    const el = document.createElement('div');
    el.className = `prog-toast${variant ? ' ' + variant : ''}`;

    const ic = document.createElement('span');
    ic.className = 'prog-toast-ic';
    ic.textContent = icon;

    const body = document.createElement('div');
    body.className = 'prog-toast-body';

    const txt = document.createElement('span');
    txt.className = 'prog-toast-txt';
    txt.textContent = titleText;
    body.appendChild(txt);

    if (subText) {
      const sub = document.createElement('span');
      sub.className = 'prog-toast-sub';
      sub.textContent = subText;
      body.appendChild(sub);
    }

    el.appendChild(ic);
    el.appendChild(body);
    dom.toastHost.appendChild(el);

    const holdMs = variant === 'achievement' ? 4100 : variant === 'level-up' ? 3700 : 2700;
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 310);
    }, holdMs);
  }

  function getActiveElemGun() {
    if (state.trialElemGun && COSMETIC_CATALOG.elemGun.some((g) => g.id === state.trialElemGun)) {
      return state.trialElemGun;
    }
    const eq = state.equipped.elemGun || 'water';
    return isUnlocked('elemGun', eq) ? eq : 'water';
  }

  function getUnlockedElemGuns() {
    if (isAdminBypassActive()) {
      return COSMETIC_CATALOG.elemGun.map((g) => g.id);
    }
    const base = Array.isArray(state.unlocked.elemGun) ? state.unlocked.elemGun : ['water'];
    return [...base];
  }

  function getActiveHiderPerk() {
    const eq = state.equipped.hiderPerk || 'none';
    return isUnlocked('hiderPerk', eq) ? eq : 'none';
  }

  function getActiveSeekerPerk() {
    const eq = state.equipped.seekerPerk || 'none';
    return isUnlocked('seekerPerk', eq) ? eq : 'none';
  }

  function applyDirectTokenAndXpGrant(addTok, addXp) {
    state.tokens += addTok;
    matchSessionTokens += addTok;
    matchSessionXp += addXp;

    if (state.level >= MAX_LEVEL) {
      state.xp = 0;
      return { levelsGained: 0, levelBonusTokens: 0, milestones: [] };
    }

    state.xp += addXp;
    let levelsGained = 0;
    let levelBonusTokens = 0;
    const milestones = [];

    while (state.level < MAX_LEVEL && state.xp >= xpNeededForLevel(state.level)) {
      state.xp -= xpNeededForLevel(state.level);
      state.level += 1;
      levelsGained += 1;

      const roadNode = LEVEL_ROAD[state.level - 1];
      syncLevelGatedUnlocksIntoObj(state.level, state.unlocked);

      if (roadNode) {
        if (roadNode.tokens > 0) {
          state.tokens += roadNode.tokens;
          matchSessionTokens += roadNode.tokens;
          levelBonusTokens += roadNode.tokens;
        }
        if (roadNode.major) {
          milestones.push(roadNode);
          if (roadNode.kind === 'elemGun' && roadNode.itemId) {
            lastUnlockedItemId = `elemGun:${roadNode.itemId}`;
            if ((state.equipped.elemGun || 'water') === 'water') {
              state.equipped.elemGun = roadNode.itemId;
            }
          } else if (roadNode.kind === 'hiderPerk' && roadNode.itemId) {
            lastUnlockedItemId = `hiderPerk:${roadNode.itemId}`;
            if ((state.equipped.hiderPerk || 'none') === 'none') {
              state.equipped.hiderPerk = roadNode.itemId;
            }
          } else if (roadNode.kind === 'seekerPerk' && roadNode.itemId) {
            lastUnlockedItemId = `seekerPerk:${roadNode.itemId}`;
            if ((state.equipped.seekerPerk || 'none') === 'none') {
              state.equipped.seekerPerk = roadNode.itemId;
            }
          } else if (roadNode.kind === 'cosmetic' && roadNode.category && roadNode.itemId) {
            lastUnlockedItemId = `${roadNode.category}:${roadNode.itemId}`;
          }
        }
      }
    }

    if (state.level >= MAX_LEVEL) state.xp = 0;
    state.achStats.elemGunsUnlocked = countUnlockedSpecialElemGuns();

    // Fire callbacks & celebratory HUD toasts for newly reached levels!
    if (levelsGained > 0) {
      if (milestones.length > 0) {
        playAchievementUnlockChime();
        for (const m of milestones) {
          spawnHudToast(
            m.icon || '🌟',
            `🎉 Lv. ${m.level} Unlocked: ${m.title}!`,
            `${m.badge} · ${m.desc}`,
            'achievement'
          );
          if (m.kind === 'elemGun' && m.itemId) {
            try { env.onElemGunUnlocked?.(m.itemId, m); } catch (_) { /* ignore */ }
            try { env.onElemGunChanged?.(getActiveElemGun()); } catch (_) { /* ignore */ }
          } else if (m.kind === 'map' && m.mapId) {
            try { env.onMapUnlocked?.(m.mapId, m); } catch (_) { /* ignore */ }
          }
        }
      } else {
        const nextMaj = getNextMajorUnlock(state.level);
        const subMsg = levelBonusTokens > 0
          ? `+${levelBonusTokens} 🪙 Pouch · ${nextMaj ? `Next: ${nextMaj.icon} ${nextMaj.title} (Lv. ${nextMaj.level})` : 'Keep climbing!'}`
          : (nextMaj ? `${nextMaj.level - state.level} Lv until ${nextMaj.icon} ${nextMaj.title} (Lv. ${nextMaj.level})!` : getRankTitleForLevel(state.level));
        spawnHudToast('⭐', `Level Up! Reached Lv. ${state.level}!`, subMsg, 'level-up');
      }
      try { env.onLevelChanged?.(state.level, milestones); } catch (_) { /* ignore */ }
    }

    return { levelsGained, levelBonusTokens, milestones };
  }

  function evaluateAchievement(ach) {
    if (!ach) return null;
    state.achStats.elemGunsUnlocked = countUnlockedSpecialElemGuns();
    const alreadyDone = Array.isArray(state.achievementsUnlocked) && state.achievementsUnlocked.includes(ach.id);

    if (Array.isArray(ach.anyOf) && ach.anyOf.length > 0) {
      let best = ach.anyOf[0];
      let bestRaw = Number(state.achStats[best.stat]) || 0;
      let bestRatio = best.target > 0 ? Math.min(1, Math.max(0, bestRaw / best.target)) : 1;
      let anyMet = bestRaw >= best.target;

      for (let i = 1; i < ach.anyOf.length; i++) {
        const c = ach.anyOf[i];
        const rawVal = Number(state.achStats[c.stat]) || 0;
        const cRatio = c.target > 0 ? Math.min(1, Math.max(0, rawVal / c.target)) : 1;
        const cMet = rawVal >= c.target;
        if ((cMet && !anyMet) || (!anyMet && cRatio > bestRatio)) {
          best = c;
          bestRaw = rawVal;
          bestRatio = cRatio;
        }
        if (cMet) anyMet = true;
      }

      const unlocked = alreadyDone || anyMet;
      const target = best.target;
      const progress = unlocked ? target : Math.min(target, Math.max(0, Math.floor(bestRaw)));
      const ratio = unlocked ? 1 : bestRatio;
      const sUnit = best.shortUnit || '';
      const unitSuffix = best.unit ? (best.unit.startsWith('s ') ? best.unit : ` ${best.unit}`) : '';
      return {
        ...ach,
        progress,
        target,
        unlocked,
        ratio,
        shortProgress: unlocked ? '✓' : `${progress}/${target}${sUnit}`,
        progressText: unlocked ? '✓ Completed!' : `${progress} / ${target}${unitSuffix}`,
      };
    }

    const rawVal = Number(state.achStats[ach.stat]) || 0;
    const target = Math.max(1, Number(ach.target) || 1);
    const unlocked = alreadyDone || rawVal >= target;
    const progress = unlocked ? target : Math.min(target, Math.max(0, Math.floor(rawVal)));
    const ratio = unlocked ? 1 : Math.min(1, Math.max(0, rawVal / target));
    const unitSuffix = ach.unit ? ` ${ach.unit}` : '';
    return {
      ...ach,
      progress,
      target,
      unlocked,
      ratio,
      shortProgress: unlocked ? '✓' : `${progress}/${target}`,
      progressText: unlocked ? '✓ Completed!' : `${progress} / ${target}${unitSuffix}`,
    };
  }

  function getAchievements() {
    return ACHIEVEMENTS.map((ach) => evaluateAchievement(ach));
  }

  function checkAndProcessAchievementUnlocks() {
    const newlyUnlocked = [];
    for (const ach of ACHIEVEMENTS) {
      if (state.achievementsUnlocked.includes(ach.id)) continue;
      const evalRes = evaluateAchievement(ach);
      if (!evalRes || !evalRes.unlocked) continue;
      state.achievementsUnlocked.push(ach.id);
      const bonusTokens = Math.max(0, Number(ach.reward || ach.rewardTokens) || 0);
      const bonusXp = Math.max(0, Number(ach.rewardXp) || 100);
      applyDirectTokenAndXpGrant(bonusTokens, bonusXp);
      spawnHudToast(ach.icon || '🏆', `🏆 Mastery: ${ach.name}!`, `+${bonusTokens} 🪙 · +${bonusXp} XP`, 'achievement');
      newlyUnlocked.push(evalRes);
    }

    // Check Daily Spirit Contracts too!
    ensureDailyContractsFresh();
    const dailyList = getDailyContractsStatus();
    for (const dc of dailyList) {
      if (state.dailyContracts.claimed.includes(dc.id)) continue;
      if (dc.progress >= dc.target) {
        state.dailyContracts.claimed.push(dc.id);
        applyDirectTokenAndXpGrant(dc.tokens, dc.xp);
        spawnHudToast(dc.icon, `📜 Daily Contract: ${dc.title}!`, `+${dc.tokens} 🪙 · +${dc.xp} XP`, 'achievement');
        newlyUnlocked.push({ id: dc.id, name: dc.title });
      }
    }

    if (newlyUnlocked.length > 0) {
      saveState();
      playAchievementUnlockChime();
      syncStripUI(true);
      if (dom.modal && dom.modal.classList.contains('on')) {
        syncWardrobeHeader();
        renderWardrobeTabs();
        renderWardrobeGrid();
      }
    }
    return newlyUnlocked;
  }

  function recordAchievementStat(statKey, amount = 1) {
    if (typeof statKey !== 'string' || !statKey) return [];
    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta <= 0) return [];

    const prevVal = Number(state.achStats[statKey]) || 0;
    const nextVal = prevVal + delta;
    state.achStats[statKey] = nextVal;

    ensureDailyContractsFresh();
    state.dailyContracts.progress[statKey] = (Number(state.dailyContracts.progress[statKey]) || 0) + delta;

    const newlyUnlocked = checkAndProcessAchievementUnlocks();
    if (newlyUnlocked.length === 0) {
      const crossedInt = Math.floor(prevVal) !== Math.floor(nextVal);
      const nowMs = Date.now();
      if (crossedInt || nowMs - lastFractionalSaveAt > 1800) {
        lastFractionalSaveAt = nowMs;
        saveState();
      }
    }
    return newlyUnlocked;
  }

  /**
   * Primary Match Completion XP Engine:
   * Winning is the #1 accelerator of progression (165 base XP vs 55 for a loss + Win Streak multiplier up to +48%).
   * One-time "First Match" bonus guarantees Level 2 after the very first finished match (win or lose).
   * A Lucky Charm charge (Spirit Shop) adds +25% to this match's XP and is consumed here.
   */
  function recordSeriesOutcome({ won = false, draw = false, eliminations = 0, survivedSec = 0, heroRescues = 0 } = {}) {
    if (won) {
      state.winStreak = (state.winStreak || 0) + 1;
      state.bestWinStreak = Math.max(state.bestWinStreak || 0, state.winStreak);
    } else if (!draw) {
      state.winStreak = 0;
    }

    const baseXp = won ? MATCH_BASE_XP.win : (draw ? MATCH_BASE_XP.draw : MATCH_BASE_XP.loss);
    const baseTokens = won ? 42 : (draw ? 24 : 14);
    const streakBonusPct = won ? Math.min(0.48, Math.max(0, state.winStreak - 1) * 0.12) : 0;
    const skillBonusXp = Math.min(45, Math.round(eliminations * 8 + survivedSec * 0.12));
    const matchXp = Math.round((baseXp + skillBonusXp) * (1 + streakBonusPct));

    const charmUsed = hasLuckyCharm();
    const charmBonusXp = charmUsed ? Math.round(matchXp * (LUCKY_CHARM_XP_PCT / 100)) : 0;
    if (charmUsed) state.luckyCharm = 0;

    const firstMatchBonusXp = state.firstMatchBonusClaimed ? 0 : FIRST_MATCH_BONUS_XP;
    state.firstMatchBonusClaimed = true;

    const totalXp = matchXp + charmBonusXp + firstMatchBonusXp;
    const streakTokens = won && state.winStreak >= 2 ? Math.min(18, (state.winStreak - 1) * 4) : 0;
    const totalTok = baseTokens + streakTokens;

    lastMatchSummaryMeta = {
      won,
      draw,
      winStreak: state.winStreak,
      streakBonusPct: Math.round(streakBonusPct * 100),
      xpEarned: totalXp,
      matchXp,
      charmBonusXp,
      firstMatchBonusXp,
      tokensEarned: totalTok,
    };

    const streakTag = won && state.winStreak >= 2 ? ` · 🔥 ${state.winStreak} Win Streak (+${Math.round(streakBonusPct * 100)}% XP!)` : '';
    const title = won
      ? `🏆 Series Victory! +${totalTok} 🪙`
      : (draw ? `⚔️ Clutch Draw! +${totalTok} 🪙` : `👏 Match Complete · +${totalTok} 🪙`);

    const xpParts = [];
    if (firstMatchBonusXp > 0) xpParts.push(`🎉 First Match +${firstMatchBonusXp}`);
    if (charmBonusXp > 0) xpParts.push(`🍀 Lucky Charm +${charmBonusXp}`);
    const subText = `+${totalXp} Spirit XP${xpParts.length ? ` (incl. ${xpParts.join(' · ')})` : ''}`;

    const res = awardTokens('series_finish', totalTok, title + streakTag, totalXp, { subText });
    // Ranked Trophy League delta (+18..+34 on win, +5 on draw, gentle -4..-10 on loss)
    const prevLeague = getRankLeagueForTrophies(state.trophies || 0);
    const perfBonus = Math.min(10, Math.floor((Number(eliminations) || 0) * 2 + (Number(heroRescues) || 0) * 4));
    const lossPen = prevLeague.id === 'bronze' ? -3 : (prevLeague.id === 'silver' ? -6 : -9);
    const trophyDelta = won ? (20 + perfBonus) : (draw ? 5 : Math.min(0, lossPen + Math.floor(perfBonus / 2)));
    state.trophies = Math.max(0, (Number(state.trophies) || 0) + trophyDelta);
    state.bestTrophies = Math.max(Number(state.bestTrophies) || 0, state.trophies);
    const nextLeague = getRankLeagueForTrophies(state.trophies);
    const leaguePromoted = nextLeague.min > prevLeague.min;
    if (lastMatchSummaryMeta) {
      lastMatchSummaryMeta.trophyDelta = trophyDelta;
      lastMatchSummaryMeta.trophies = state.trophies;
      lastMatchSummaryMeta.league = nextLeague;
      lastMatchSummaryMeta.leaguePromoted = leaguePromoted;
    }
    // Advance 3-Win Spirit Chest (+1.0 on win, +0.5 on draw/loss so every match progresses the chest!)
    if (!state.spiritChest || typeof state.spiritChest !== 'object') state.spiritChest = { points: 0, opened: 0 };
    state.spiritChest.points = Math.min(SPIRIT_CHEST_TARGET, +(state.spiritChest.points + (won ? 1 : 0.5)).toFixed(2));
    saveState();
    recordAchievementStat('matchesCompleted', 1);
    if (won) recordAchievementStat('matchesWon', 1);
    return {
      ...res,
      totalXp,
      matchXp,
      charmBonusXp,
      firstMatchBonusXp,
      totalTok,
      winStreak: state.winStreak,
      streakBonusPct: Math.round(streakBonusPct * 100),
      chestPoints: state.spiritChest.points,
      chestReady: state.spiritChest.points >= SPIRIT_CHEST_TARGET,
      trophyDelta,
      trophies: state.trophies,
      league: nextLeague,
      leaguePromoted,
    };
  }

  function getTodayDateKey() {
    try {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch (_) {
      return '2026-01-01';
    }
  }

  function prevDateKey(dateStr) {
    try {
      const d = new Date(`${dateStr}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    } catch (_) {
      return '';
    }
  }

  function getDailyLoginStatus(todayKey = getTodayDateKey()) {
    if (!state.loginStreak || typeof state.loginStreak !== 'object') {
      state.loginStreak = { streak: 0, lastClaimDate: '' };
    }
    const last = state.loginStreak.lastClaimDate || '';
    const claimedToday = last === todayKey;
    const isConsecutive = last === prevDateKey(todayKey);
    const nextStreak = claimedToday
      ? Math.max(1, state.loginStreak.streak)
      : (isConsecutive ? state.loginStreak.streak + 1 : 1);
    const dayIndex = ((nextStreak - 1) % WELCOME_CALENDAR_REWARDS.length);
    const reward = WELCOME_CALENDAR_REWARDS[dayIndex];
    return {
      claimedToday,
      canClaim: !claimedToday,
      streak: claimedToday ? state.loginStreak.streak : nextStreak,
      dayNumber: reward.day,
      reward,
      calendar: WELCOME_CALENDAR_REWARDS,
    };
  }

  function claimDailyLoginReward(todayKey = getTodayDateKey()) {
    const st = getDailyLoginStatus(todayKey);
    if (!st.canClaim) return { ok: false, reason: 'already_claimed', status: st };
    const r = st.reward;
    state.loginStreak = { streak: st.streak, lastClaimDate: todayKey };
    if (r.luckyCharm) state.luckyCharm = 1;
    if (r.trialGun && !isUnlocked('elemGun', r.trialGun)) {
      state.trialElemGun = r.trialGun;
    }
    const res = awardTokens('daily_login', r.tokens, `🎁 ${r.label}! +${r.tokens} 🪙`, r.xp, {
      subText: r.trialGun ? `Includes 1 Free ${r.trialGun.toUpperCase()} Blaster Match Trial!` : `+${r.xp} Spirit XP`,
    });
    saveState();
    return { ok: true, reward: r, streak: st.streak, ...res };
  }

  function getSpiritChestStatus() {
    if (!state.spiritChest || typeof state.spiritChest !== 'object') {
      state.spiritChest = { points: 0, opened: 0 };
    }
    const pts = Math.max(0, Math.min(SPIRIT_CHEST_TARGET, Number(state.spiritChest.points) || 0));
    return {
      points: pts,
      target: SPIRIT_CHEST_TARGET,
      ready: pts >= SPIRIT_CHEST_TARGET,
      opened: state.spiritChest.opened || 0,
    };
  }

  function claimSpiritChest() {
    const st = getSpiritChestStatus();
    if (!st.ready) return { ok: false, reason: 'not_ready', status: st };
    state.spiritChest.points = 0;
    state.spiritChest.opened = (state.spiritChest.opened || 0) + 1;
    const roll = Math.random();
    const rarity = roll > 0.85 ? 'Legendary' : (roll > 0.48 ? 'Rare' : 'Cozy');
    const tokens = rarity === 'Legendary' ? 210 : (rarity === 'Rare' ? 140 : 95);
    const xp = rarity === 'Legendary' ? 150 : (rarity === 'Rare' ? 110 : 80);
    let bonusNote = '';
    if (rarity !== 'Cozy') {
      const lockedGuns = ['earth', 'fire', 'snow', 'air'].filter((g) => !isUnlocked('elemGun', g));
      if (lockedGuns.length && !state.trialElemGun) {
        const picked = lockedGuns[state.spiritChest.opened % lockedGuns.length];
        state.trialElemGun = picked;
        bonusNote = ` + Free ${picked.toUpperCase()} Trial!`;
      } else {
        state.luckyCharm = 1;
        bonusNote = ' + 🍀 Lucky Charm!';
      }
    }
    const res = awardTokens('spirit_chest', tokens, `🎁 ${rarity} Spirit Chest! +${tokens} 🪙`, xp, {
      subText: `+${xp} XP${bonusNote}`,
    });
    saveState();
    return { ok: true, rarity, tokens, xp, bonusNote, ...res };
  }

  function getDailyBlasterTrialStatus(todayKey = getTodayDateKey()) {
    const locked = ['earth', 'fire', 'snow', 'air'].filter((g) => !isUnlocked('elemGun', g));
    if (!locked.length) return { available: false, gunId: null, reason: 'all_unlocked' };
    const daySeed = Number(todayKey.replace(/-/g, '')) || 1;
    const gunId = locked[daySeed % locked.length];
    const usedToday = state.dailyTrialDate === todayKey;
    return {
      available: !usedToday && !state.trialElemGun,
      activeTrial: state.trialElemGun || null,
      gunId,
      usedToday,
    };
  }

  function claimDailyBlasterTrial(todayKey = getTodayDateKey()) {
    const st = getDailyBlasterTrialStatus(todayKey);
    if (!st.available || !st.gunId) return { ok: false, status: st };
    state.dailyTrialDate = todayKey;
    state.trialElemGun = st.gunId;
    saveState();
    spawnHudToast('⚡', `Free ${st.gunId.toUpperCase()} Blaster Trial!`, 'Equipped for your next match', false);
    return { ok: true, gunId: st.gunId };
  }

  function getNextMilestoneNudge() {
    const chest = getSpiritChestStatus();
    if (chest.ready) return { kind: 'chest_ready', text: '🎁 Spirit Chest Ready! Tap below to crack it open!' };
    const remainingChest = +(chest.target - chest.points).toFixed(1);
    if (remainingChest <= 1) return { kind: 'chest_near', text: '🎁 Just 1 more win to crack open your Spirit Chest!' };
    if (state.level < MAX_LEVEL) {
      const xpLeft = Math.max(1, xpNeededForLevel(state.level) - state.xp);
      const nextMaj = getNextMajorUnlock(state.level);
      if (nextMaj && nextMaj.level === state.level + 1) {
        return { kind: 'unlock_near', text: `🔥 Only ${xpLeft} XP until ${nextMaj.icon} ${nextMaj.title}!` };
      }
      if (xpLeft <= 120) {
        return { kind: 'level_near', text: `⭐ Only ${xpLeft} XP to reach Level ${state.level + 1}!` };
      }
    }
    const contracts = getDailyContractsStatus();
    const almostContract = contracts.find((c) => !c.done && c.target - c.progress === 1);
    if (almostContract) {
      const cName = almostContract.title || almostContract.desc || almostContract.label || 'Daily Contract';
      return { kind: 'contract_near', text: `📜 Almost done: 1 more for "${cName}" (+${almostContract.xp} XP)!` };
    }
    return { kind: 'chest_prog', text: `🎁 Spirit Chest: ${chest.points}/${chest.target} wins` };
  }

  // Match-end / one-off grants are never capped; every other reason is an in-match action bonus.
  function isUncappedRewardReason(key) {
    return key === 'series_finish'
      || key === 'daily_login'
      || key === 'spirit_chest'
      || key.startsWith('tutorial')
      || key === 'round1_win'
      || key === 'round1_done'
      || key === 'admin_gift';
  }

  function notifyMatchCapReached(kind) {
    if (kind === 'tokens') {
      if (matchTokCapNoticeShown) return;
      matchTokCapNoticeShown = true;
      spawnHudToast(
        '🪙',
        `Match action bonus cap reached (${MATCH_ACTION_TOKEN_CAP}/${MATCH_ACTION_TOKEN_CAP} 🪙)`,
        'More action bonuses pay 0 🪙 this match — the match-end payout is still paid in full!',
        'warn'
      );
    } else {
      if (matchXpCapNoticeShown) return;
      matchXpCapNoticeShown = true;
      spawnHudToast(
        '⭐',
        `Match action XP cap reached (${MATCH_ACTION_XP_CAP}/${MATCH_ACTION_XP_CAP} XP)`,
        'Finish the match for the big XP payout!',
        'warn'
      );
    }
  }

  /**
   * Pays exactly the nominal `tokens` amount for every reason key — what the caller prints is what is credited.
   * The only limiter is the visible per-match cap on in-match action bonuses (MATCH_ACTION_TOKEN_CAP /
   * MATCH_ACTION_XP_CAP): the player gets a toast the moment a cap kicks in, the reward toast shows the
   * amount really credited, and the return value reports `capped` so callers can word their own hints.
   */
  function awardTokens(reasonKey, tokens, toastText, xpOverride = null, opts = null) {
    const key = String(reasonKey || '');
    const isMatchEnd = key === 'series_finish' || key.startsWith('tutorial');
    const uncapped = isUncappedRewardReason(key);
    const rawTok = Math.max(0, Math.round(Number(tokens) || 0));

    let addTok = rawTok;
    let tokenCapHit = false;
    if (!uncapped && rawTok > 0) {
      const tokRoom = Math.max(0, MATCH_ACTION_TOKEN_CAP - matchActionTokUsed);
      addTok = Math.min(tokRoom, rawTok);
      matchActionTokUsed += addTok;
      tokenCapHit = addTok < rawTok;
    }

    let addXp = 0;
    let xpCapHit = false;
    if (xpOverride !== null && xpOverride !== undefined) {
      addXp = Math.max(0, Math.round(Number(xpOverride) || 0));
    } else if (isMatchEnd) {
      addXp = rawTok * 2;
    } else {
      // In-match micro-action XP is capped per match so whistle-spam can't power-level; WINNING matches drives real XP!
      const rawMicroXp = key === 'soak_spirit' ? 16 : (key === 'taunt' ? 3 : 9);
      const roomLeft = Math.max(0, MATCH_ACTION_XP_CAP - matchActionXpUsed);
      addXp = Math.min(roomLeft, rawMicroXp);
      matchActionXpUsed += addXp;
      xpCapHit = addXp < rawMicroXp;
    }

    if (tokenCapHit) notifyMatchCapReached('tokens');
    if (xpCapHit) notifyMatchCapReached('xp');

    if (addTok <= 0 && addXp <= 0) {
      return {
        tokensAdded: 0,
        tokensRequested: rawTok,
        capped: tokenCapHit,
        xpAdded: 0,
        leveledUp: false,
        levelsGained: 0,
        levelBonusTokens: 0,
        newLevel: state.level,
        totalTokens: state.tokens,
      };
    }

    const { levelsGained, levelBonusTokens } = applyDirectTokenAndXpGrant(addTok, addXp);
    saveState();
    syncStripUI(true);
    if (dom.modal && dom.modal.classList.contains('on')) {
      syncWardrobeHeader();
      renderWardrobeTabs();
      renderWardrobeGrid();
    }

    // The toast always states the amount that was really credited
    let formattedToast = typeof toastText === 'string' ? toastText.trim() : '';
    if (!formattedToast) {
      const prettyReason = key.replace(/[_-]+/g, ' ') || 'Spirit Bonus';
      formattedToast = addTok > 0 ? `+${addTok} 🪙 ${prettyReason}!` : `+${addXp} XP ${prettyReason}!`;
    } else if (tokenCapHit) {
      formattedToast = formattedToast.replace(/\+\d+\s*🪙/, addTok > 0 ? `+${addTok} 🪙 (match cap)` : '(🪙 match cap reached)');
    } else if (addTok > 0) {
      formattedToast = formattedToast.replace(/\+\d+\s*🪙/, `+${addTok} 🪙`);
    }

    let subText = opts && typeof opts.subText === 'string' ? opts.subText : (addXp > 0 ? `+${addXp} Spirit XP` : '');
    if (addTok > 0 && !formattedToast.includes('🪙')) {
      subText = subText ? `${subText} · +${addTok} 🪙` : `+${addTok} 🪙`;
    }

    spawnHudToast(isMatchEnd ? '🏆' : '🪙', formattedToast, subText, false);
    playTokenToastChime(levelsGained > 0);

    return {
      tokensAdded: addTok + levelBonusTokens,
      tokensRequested: rawTok,
      capped: tokenCapHit,
      xpAdded: addXp,
      leveledUp: levelsGained > 0,
      levelsGained,
      levelBonusTokens,
      newLevel: state.level,
      totalTokens: state.tokens,
    };
  }

  function setEquippedElemGun(elemId) {
    const valid = COSMETIC_CATALOG.elemGun.some((g) => g.id === elemId);
    if (!valid || !isUnlocked('elemGun', elemId)) return false;
    state.equipped.elemGun = elemId;
    saveState();
    syncStripUI(false);
    if (dom.modal && dom.modal.classList.contains('on')) {
      renderWardrobeTabs();
      renderWardrobeGrid();
    }
    try { env.onElemGunChanged?.(getActiveElemGun()); } catch (_) { /* ignore */ }
    return true;
  }

  function setTrialElemGun() {
    // Elemental guns are strictly earned by reaching their unlock level!
    return false;
  }

  function consumeTrialElemGun() {
    state.trialElemGun = null;
    return getActiveElemGun();
  }

  function unlockElemGun(elemId) {
    const item = COSMETIC_CATALOG.elemGun.find((g) => g.id === elemId);
    if (!item) return false;
    if (!state.unlocked.elemGun.includes(elemId)) {
      state.unlocked.elemGun.push(elemId);
    }
    saveState();
    syncStripUI(false);
    try { env.onElemGunUnlocked?.(elemId); } catch (_) { /* ignore */ }
    return true;
  }

  // ============================================================
  // Post-Match Animated XP Summary + Next Major Unlock Hook
  // ============================================================
  function renderResultSummary(containerEl) {
    const host = containerEl || (typeof document !== 'undefined' ? document.getElementById('resultRewardsSlot') : null);
    if (!host) return;

    const isMax = state.level >= MAX_LEVEL;
    const needed = xpNeededForLevel(state.level);
    const pct = isMax ? 100 : Math.max(0, Math.min(100, (state.xp / needed) * 100));
    const nextMaj = getNextMajorUnlock(state.level);

    const meta = lastMatchSummaryMeta;
    const streakHtml = state.winStreak >= 2
      ? `<span class="prog-res-streak">🔥 ${state.winStreak} Win Streak (+${Math.min(48, (state.winStreak - 1) * 12)}% XP)</span>`
      : (meta?.won ? `<span class="prog-res-streak win">🏆 Victory Bonus +${MATCH_BASE_XP.win - MATCH_BASE_XP.loss} XP</span>` : '');

    // Itemised extras already included in the "+XP · +🪙" total above
    const bonusChips = [];
    if (meta?.firstMatchBonusXp > 0) {
      bonusChips.push(`<span class="prog-res-chip first">🎉 First Match Bonus +${meta.firstMatchBonusXp} XP</span>`);
    }
    if (meta?.charmBonusXp > 0) {
      bonusChips.push(`<span class="prog-res-chip charm">🍀 Lucky Charm +${meta.charmBonusXp} XP (+${LUCKY_CHARM_XP_PCT}%)</span>`);
    }
    if (matchTokCapNoticeShown) {
      bonusChips.push(`<span class="prog-res-chip cap">🪙 Action bonus cap reached (${MATCH_ACTION_TOKEN_CAP}/${MATCH_ACTION_TOKEN_CAP})</span>`);
    }
    const bonusRowHtml = bonusChips.length ? `<div class="prog-res-bonus">${bonusChips.join('')}</div>` : '';

    const chestSt = getSpiritChestStatus();
    const nudge = getNextMilestoneNudge();
    const leagueInfo = getRankLeagueForTrophies(state.trophies || 0);
    const tDelta = typeof meta?.trophyDelta === 'number' ? meta.trophyDelta : 0;
    const tDeltaStr = tDelta >= 0 ? `+${tDelta} 🏆` : `${tDelta} 🏆`;
    const leagueBarHtml = `
      <div class="prog-res-league" style="margin:6px 0 4px;padding:7px 10px;border-radius:12px;background:rgba(255,252,240,.92);border:1.5px solid ${leagueInfo.color};display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;align-items:center;justify-content:space-between;font-weight:900;font-size:12.5px;color:#332612;">
          <span>${leagueInfo.icon} ${leagueInfo.name} League · <b>${leagueInfo.trophies} 🏆</b></span>
          <span style="color:${tDelta >= 0 ? '#2b8f4c' : '#c94c38'};">${meta?.leaguePromoted ? '🎉 PROMOTED! ' : ''}${tDeltaStr}</span>
        </div>
        <div style="height:6px;border-radius:6px;background:rgba(60,50,30,.14);overflow:hidden;">
          <i style="display:block;height:100%;width:${leagueInfo.pct.toFixed(1)}%;background:${leagueInfo.color};border-radius:6px;transition:width .6s ease;"></i>
        </div>
        <span style="font-size:11px;font-weight:800;color:#6c5c42;">${leagueInfo.next ? `${leagueInfo.toNext} 🏆 to ${leagueInfo.next.icon} ${leagueInfo.next.name}` : '🌟 Top League Reached!'}</span>
      </div>`;
    const chestActionHtml = chestSt.ready
      ? `<button type="button" class="prog-res-chest-btn" id="btnResultOpenChest" style="margin:8px 0 4px;width:100%;padding:10px 14px;border:0;border-radius:14px;background:linear-gradient(180deg,#ffd866,#f29524);color:#3c2208;font-family:var(--fd);font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 4px 0 rgba(130,68,12,.4);">🎁 OPEN SPIRIT CHEST! (${chestSt.points}/${chestSt.target})</button>`
      : `<div class="prog-res-nudge" style="margin:6px 0 2px;padding:6px 10px;border-radius:10px;background:rgba(255,216,102,.22);font-size:12.5px;font-weight:800;color:#4a3316;">${nudge.text}</div>`;

    const nextUnlockHtml = nextMaj
      ? `<div class="prog-res-next"><span>Next Milestone: <b>${nextMaj.icon} ${nextMaj.title}</b></span><em>Lv. ${nextMaj.level} (${nextMaj.level - state.level} Lv away)</em></div>`
      : `<div class="prog-res-next"><span>🏆 <b>Lv. 99 Spirit Realm Legend</b> Achieved!</span></div>`;

    host.innerHTML = `
      <div class="prog-result-bar">
        <div class="prog-res-top">
          <span class="prog-res-earned">+${matchSessionXp} XP · +${matchSessionTokens} 🪙</span>
          ${streakHtml}
          <span class="prog-res-lv">⭐ Lv. ${state.level}/${MAX_LEVEL}<small>${isMax ? 'MAX' : `${state.xp} / ${needed} XP`}</small></span>
        </div>
        ${bonusRowHtml}
        <div class="prog-res-track">
          <i class="prog-res-fill" id="progResultXpFill" style="width: 0%"></i>
        </div>
        ${leagueBarHtml}
        ${chestActionHtml}
        ${nextUnlockHtml}
        <div class="prog-res-foot">
          <span>Wallet: 🪙 ${state.tokens} · ${getRankTitleForLevel(state.level)}</span>
          <button type="button" class="prog-res-shop-link" id="btnResultWardrobe">🗺️ Spirit Journey &amp; Perks</button>
        </div>
      </div>
    `;

    const fillEl = host.querySelector('#progResultXpFill');
    if (fillEl) {
      const triggerFill = () => { fillEl.style.width = `${pct.toFixed(1)}%`; };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(triggerFill));
      } else {
        triggerFill();
      }
    }

    const chestBtn = host.querySelector('#btnResultOpenChest');
    if (chestBtn) {
      chestBtn.addEventListener('click', () => {
        const res = claimSpiritChest();
        if (res.ok) {
          if (env.audio && typeof env.audio.win === 'function') env.audio.win();
          renderResultSummary(host);
        }
      });
    }

    const shopBtn = host.querySelector('#btnResultWardrobe');
    if (shopBtn) {
      shopBtn.addEventListener('click', () => {
        if (env.audio && typeof env.audio.tap === 'function') env.audio.tap();
        openWardrobe('journey');
      });
    }
  }

  // ============================================================
  // 3D Character Hat Attachment & Custom Poof VFX
  // ============================================================
  function collectMeshes(node, out = []) {
    if (!node) return out;
    if (node.isMesh || node.geometry !== undefined) out.push(node);
    if (Array.isArray(node.children)) {
      for (const child of node.children) collectMeshes(child, out);
    }
    return out;
  }

  function isSeekerCharacter(ch) {
    if (!ch) return false;
    const u = ch.userData || {};
    return Boolean(
      u.isSeeker ||
      (u.member && u.member.team === 'seekers') ||
      u.nozzle ||
      (u.rig && u.rig.weapon) ||
      (typeof ch.name === 'string' && ch.name.startsWith('seeker'))
    );
  }

  function buildHatMeshBound(threeOrHatId, maybeHatId) {
    if (typeof threeOrHatId === 'string') return buildHatMesh(env.THREE, threeOrHatId);
    return buildHatMesh(threeOrHatId || env.THREE, maybeHatId);
  }

  function attachHatToChar(ch, hatId) {
    if (!ch) return;
    if (!ch.userData) ch.userData = {};
    const u = ch.userData;

    if (u.cosmeticHat) {
      const prevHat = u.cosmeticHat;
      const prevTracked = new Set([prevHat, ...(u.cosmeticHatParts || collectMeshes(prevHat))]);
      if (prevHat.parent && typeof prevHat.parent.remove === 'function') prevHat.parent.remove(prevHat);
      else if (typeof ch.remove === 'function') ch.remove(prevHat);
      if (Array.isArray(u.parts)) {
        for (let i = u.parts.length - 1; i >= 0; i--) {
          if (prevTracked.has(u.parts[i])) u.parts.splice(i, 1);
        }
      }
      u.cosmeticHat = null;
      u.cosmeticHatParts = null;
      u.cosmeticHatId = 'none';
    }

    const resolvedHatId = hatId === undefined ? state.equipped.hat : hatId;
    if (!resolvedHatId || resolvedHatId === 'none' || !env.THREE) return;

    const hatGroup = buildHatMesh(env.THREE, resolvedHatId);
    if (!hatGroup) return;

    const crownY = isSeekerCharacter(ch) ? 1.62 : 0.90;
    setPos(hatGroup, 0, crownY, 0);

    const meshes = collectMeshes(hatGroup);
    const currentlyDisguised = Boolean(u.propId || u.specialMode);
    hatGroup.visible = !currentlyDisguised;
    for (const m of meshes) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.visible = !currentlyDisguised;
    }

    if (typeof ch.add === 'function') ch.add(hatGroup);
    u.cosmeticHat = hatGroup;
    u.cosmeticHatParts = meshes;
    u.cosmeticHatId = resolvedHatId;
    if (Array.isArray(u.parts)) u.parts.push(hatGroup, ...meshes);
  }

  function ensureVfxGeos(THREE) {
    if (cachedGeos && cachedGeos.THREE === THREE) return cachedGeos;
    let petalGeo = null;
    if (THREE.BufferGeometry && THREE.Float32BufferAttribute) {
      petalGeo = new THREE.BufferGeometry();
      const verts = new Float32Array([
        0.0, -0.075, 0.0,
        -0.062, -0.01, 0.012,
        0.062, -0.01, 0.012,
        -0.044, 0.072, -0.008,
        0.0, 0.046, 0.004,
        0.044, 0.072, -0.008,
      ]);
      petalGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      petalGeo.setIndex([0, 2, 1, 1, 2, 4, 1, 4, 3, 4, 2, 5]);
      if (typeof petalGeo.computeVertexNormals === 'function') petalGeo.computeVertexNormals();
    } else {
      petalGeo = new THREE.SphereGeometry(0.06, 6, 5);
    }

    const StarGeo = THREE.OctahedronGeometry || THREE.SphereGeometry;
    const PuffballGeo = THREE.DodecahedronGeometry || THREE.SphereGeometry;
    cachedGeos = {
      THREE,
      petal: petalGeo,
      star: new StarGeo(0.076, 0),
      puffball: new PuffballGeo(0.072, 1),
      crumb: new StarGeo(0.036, 0),
      puff: new THREE.SphereGeometry(0.09, 8, 6),
      bubble: new THREE.SphereGeometry(0.085, 12, 9),
      confetti: THREE.BoxGeometry ? new THREE.BoxGeometry(0.08, 0.08, 0.006) : new StarGeo(0.045, 0),
    };
    return cachedGeos;
  }

  function disposeBurst(burst) {
    if (!burst) return;
    if (burst.group?.parent) burst.group.parent.remove(burst.group);
    else if (env.scene && burst.group) env.scene.remove(burst.group);
    if (Array.isArray(burst.materials)) {
      for (const m of burst.materials) {
        if (m && typeof m.dispose === 'function') m.dispose();
      }
    }
  }

  function spawnPoofVfx(pos, vfxIdOverride) {
    const THREE = env.THREE;
    const scene = env.scene;
    if (!THREE || !scene || !pos) return;
    const vfxId = vfxIdOverride || state.equipped.poof || 'classic';
    const geos = ensureVfxGeos(THREE);

    while (activeBursts.length >= MAX_ACTIVE_VFX_BURSTS) {
      disposeBurst(activeBursts.shift());
    }

    const group = new THREE.Group();
    setPos(group, Number(pos.x) || 0, (Number(pos.y) || 0) + 0.22, Number(pos.z) || 0);
    const particles = [];
    const materials = [];
    const makeParticleMat = (hex) => {
      const extra = { transparent: true, opacity: 0.96, depthWrite: false };
      if (THREE.DoubleSide !== undefined) extra.side = THREE.DoubleSide;
      const mat = makeBasicMat(THREE, hex, extra);
      materials.push(mat);
      return mat;
    };

    if (vfxId === 'dragon_swirl') {
      const mats = [makeParticleMat(0x2ec4b6), makeParticleMat(0x52b788), makeParticleMat(0xffd166)];
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const m = new THREE.Mesh(i % 3 === 2 ? geos.star : geos.puff, mats[i % mats.length]);
        const s0 = 0.72 + (i % 3) * 0.22;
        setPos(m, Math.cos(ang) * 0.24, (i / 16) * 0.35, Math.sin(ang) * 0.24);
        setScl(m, s0, s0, s0);
        group.add(m);
        particles.push({
          mesh: m,
          vx: Math.cos(ang) * 1.4,
          vy: 1.45 + (i % 4) * 0.28,
          vz: Math.sin(ang) * 1.4,
          rx: 3.5,
          ry: 6.2,
          rz: 2.0,
          phase: ang,
          baseScale: s0,
        });
      }
      scene.add(group);
      activeBursts.push({ kind: 'sakura', group, particles, materials, age: 0, life: 1.05 });
      return;
    }

    if (vfxId === 'sakura') {
      const mats = [makeParticleMat(0xffaec6), makeParticleMat(0xffcddb), makeParticleMat(0xf58cae)];
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
        const spd = 1.45 + Math.random() * 1.65;
        const m = new THREE.Mesh(geos.petal, mats[i % mats.length]);
        const s0 = 0.82 + Math.random() * 0.48;
        setPos(m, Math.cos(ang) * 0.14, 0.08 + Math.random() * 0.42, Math.sin(ang) * 0.14);
        setRot(m, Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        setScl(m, s0, s0, s0);
        group.add(m);
        particles.push({ mesh: m, vx: Math.cos(ang) * spd, vy: 0.95 + Math.random() * 1.35, vz: Math.sin(ang) * spd, rx: (Math.random() - 0.5) * 7.5, ry: (Math.random() - 0.5) * 7.5, rz: (Math.random() - 0.5) * 6.5, phase: Math.random() * Math.PI * 2, baseScale: s0 });
      }
      scene.add(group);
      activeBursts.push({ kind: 'sakura', group, particles, materials, age: 0, life: 1.05 });
      return;
    }

    if (vfxId === 'starlight') {
      const mats = [makeParticleMat(0xfff078), makeParticleMat(0x9bf0c9), makeParticleMat(0xffa8cb), makeParticleMat(0xb6dcff)];
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const spd = 1.15 + Math.random() * 1.45;
        const m = new THREE.Mesh(geos.star, mats[i % mats.length]);
        const s0 = 0.78 + Math.random() * 0.48;
        setPos(m, Math.cos(ang) * 0.12, 0.05 + Math.random() * 0.35, Math.sin(ang) * 0.12);
        setScl(m, s0, s0, s0);
        group.add(m);
        particles.push({ mesh: m, vx: Math.cos(ang) * spd, vy: 1.35 + Math.random() * 1.55, vz: Math.sin(ang) * spd, rx: 3.5, ry: 5.5, rz: 2.5, phase: i * 0.9, baseScale: s0 });
      }
      scene.add(group);
      activeBursts.push({ kind: 'starlight', group, particles, materials, age: 0, life: 0.96 });
      return;
    }

    if (vfxId === 'puffball') {
      // Pale cream / dandelion puffs that hop, then drift away with a few floating seeds
      const puffballMats = [makeParticleMat(0xfffbe8), makeParticleMat(0xf7ecc0), makeParticleMat(0xffe9a8)];
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const spd = 1.55 + Math.random() * 1.35;
        const m = new THREE.Mesh(geos.puffball, puffballMats[i % puffballMats.length]);
        const s0 = 0.85 + Math.random() * 0.36;
        setPos(m, Math.cos(ang) * 0.14, 0.04, Math.sin(ang) * 0.14);
        setScl(m, s0, s0, s0);
        group.add(m);
        particles.push({ mesh: m, vx: Math.cos(ang) * spd, vy: 0, vz: Math.sin(ang) * spd, hopFreq: 11, hopAmp: 0.3, phase: Math.random() * 0.6, baseScale: s0, isPuffball: true });
      }
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + 0.5;
        const m = new THREE.Mesh(geos.crumb, puffballMats[i % 2]);
        const s0 = 0.7 + Math.random() * 0.3;
        setPos(m, Math.cos(ang) * 0.1, 0.2 + Math.random() * 0.2, Math.sin(ang) * 0.1);
        setScl(m, s0, s0, s0);
        group.add(m);
        particles.push({ mesh: m, vx: Math.cos(ang) * 0.55, vy: 0.9 + Math.random() * 0.5, vz: Math.sin(ang) * 0.55, baseScale: s0 });
      }
      scene.add(group);
      activeBursts.push({ kind: 'puffball', group, particles, materials, age: 0, life: 0.92 });
      return;
    }

    if (vfxId === 'leaf_whirl') {
      const mats = [makeParticleMat(0xc8553d), makeParticleMat(0xe89b2e), makeParticleMat(0xf2c14e), makeParticleMat(0x9c5a2c)];
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const m = new THREE.Mesh(geos.petal, mats[i % mats.length]);
        const s0 = 1.0 + Math.random() * 0.55;
        const r0 = 0.16 + Math.random() * 0.1;
        setPos(m, Math.cos(ang) * r0, 0.02 + (i / 18) * 0.3, Math.sin(ang) * r0);
        setRot(m, Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        setScl(m, s0, s0, s0);
        group.add(m);
        particles.push({ mesh: m, ang, radius: r0, radiusVel: 0.42 + Math.random() * 0.3, angVel: 7.5 + Math.random() * 2.5, vy: 0.9 + Math.random() * 0.9, rx: (Math.random() - 0.5) * 9, ry: (Math.random() - 0.5) * 9, phase: Math.random() * Math.PI * 2, baseScale: s0 });
      }
      scene.add(group);
      activeBursts.push({ kind: 'whirl', group, particles, materials, age: 0, life: 1.1 });
      return;
    }

    if (vfxId === 'firefly_glow') {
      const mats = [makeParticleMat(0xfff27a), makeParticleMat(0xffd84d), makeParticleMat(0xeaff8a)];
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        const m = new THREE.Mesh(geos.crumb, mats[i % mats.length]);
        const s0 = 1.5 + Math.random() * 0.9;
        const r0 = 0.3 + (i % 3) * 0.12;
        setPos(m, Math.cos(ang) * r0, 0.1 + Math.random() * 0.5, Math.sin(ang) * r0);
        setScl(m, s0, s0, s0);
        group.add(m);
        particles.push({ mesh: m, ang, radius: r0, radiusVel: 0.16, angVel: (i % 2 === 0 ? 1 : -1) * (1.5 + Math.random() * 0.9), vy: 0.28 + Math.random() * 0.4, rx: 2, ry: 3, phase: Math.random() * Math.PI * 2, blinkFreq: 9 + Math.random() * 5, baseScale: s0 });
      }
      scene.add(group);
      activeBursts.push({ kind: 'whirl', group, particles, materials, age: 0, life: 1.35 });
      return;
    }

    if (vfxId === 'bubble_pop') {
      const mats = [makeParticleMat(0x9be7ff), makeParticleMat(0xd3b8ff), makeParticleMat(0xb8ffe6)];
      for (let i = 0; i < 13; i++) {
        const ang = (i / 13) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const spd = 0.35 + Math.random() * 0.75;
        const m = new THREE.Mesh(geos.bubble, mats[i % mats.length]);
        const s0 = 0.55 + Math.random() * 0.85;
        setPos(m, Math.cos(ang) * 0.16, 0.05 + Math.random() * 0.3, Math.sin(ang) * 0.16);
        setScl(m, s0, s0, s0);
        group.add(m);
        particles.push({ mesh: m, vx: Math.cos(ang) * spd, vy: 0.75 + Math.random() * 0.95, vz: Math.sin(ang) * spd, phase: Math.random() * Math.PI * 2, popAt: 0.5 + Math.random() * 0.42, baseScale: s0 });
      }
      scene.add(group);
      activeBursts.push({ kind: 'bubble', group, particles, materials, age: 0, life: 1.15, maxOpacity: 0.6 });
      return;
    }

    if (vfxId === 'confetti_burst') {
      const mats = [0xff6b6b, 0xffd23f, 0x4ecdc4, 0x7b8cff, 0xff9ecb, 0x8be068].map((hex) => makeParticleMat(hex));
      for (let i = 0; i < 26; i++) {
        const ang = (i / 26) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const spd = 0.7 + Math.random() * 1.7;
        const m = new THREE.Mesh(geos.confetti, mats[i % mats.length]);
        const s0 = 0.75 + Math.random() * 0.6;
        setPos(m, Math.cos(ang) * 0.08, 0.15 + Math.random() * 0.2, Math.sin(ang) * 0.08);
        setRot(m, Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        setScl(m, s0, s0, s0);
        group.add(m);
        particles.push({ mesh: m, vx: Math.cos(ang) * spd, vy: 2.1 + Math.random() * 1.4, vz: Math.sin(ang) * spd, rx: (Math.random() - 0.5) * 16, ry: (Math.random() - 0.5) * 12, rz: (Math.random() - 0.5) * 16, baseScale: s0 });
      }
      scene.add(group);
      activeBursts.push({ kind: 'confetti', group, particles, materials, age: 0, life: 1.3 });
      return;
    }

    const creamA = makeParticleMat(0xfff6e0);
    const creamB = makeParticleMat(0xffe5ad);
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2;
      const spd = 1.1 + Math.random() * 0.85;
      const m = new THREE.Mesh(geos.puff, i % 2 === 0 ? creamA : creamB);
      const s0 = 0.75 + Math.random() * 0.45;
      setPos(m, Math.cos(ang) * 0.1, 0.08 + Math.random() * 0.2, Math.sin(ang) * 0.1);
      setScl(m, s0, s0, s0);
      group.add(m);
      particles.push({ mesh: m, vx: Math.cos(ang) * spd, vy: 0.7 + Math.random() * 0.8, vz: Math.sin(ang) * spd, baseScale: s0 });
    }
    scene.add(group);
    activeBursts.push({ kind: 'classic', group, particles, materials, age: 0, life: 0.54 });
  }

  function update(dt) {
    if (!activeBursts.length) return;
    const step = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
    if (step <= 0) return;

    for (let i = activeBursts.length - 1; i >= 0; i--) {
      const b = activeBursts[i];
      b.age += step;
      const u = b.age / b.life;
      if (u >= 1) {
        disposeBurst(b);
        activeBursts.splice(i, 1);
        continue;
      }
      const maxOpacity = b.maxOpacity || 0.96;
      const fade = u < 0.58 ? maxOpacity : Math.max(0, (1 - u) / 0.42) * maxOpacity;
      for (const mat of b.materials) mat.opacity = fade;
      for (const p of b.particles) {
        const m = p.mesh;
        if (b.kind === 'sakura') {
          m.position.x += (p.vx - p.vz * 0.55) * step;
          m.position.y += p.vy * step;
          m.position.z += (p.vz + p.vx * 0.55) * step;
          p.vx *= 1 - step * 2.1;
          p.vz *= 1 - step * 2.1;
          p.vy -= 2.1 * step;
          m.rotation.x += (p.rx || 0) * step;
          m.rotation.y += (p.ry || 0) * step;
          const sc = p.baseScale * (1 - u * 0.35);
          setScl(m, sc, sc, sc);
        } else if (b.kind === 'starlight') {
          m.position.x += p.vx * step;
          m.position.y += p.vy * step;
          m.position.z += p.vz * step;
          m.rotation.y += (p.ry || 4) * step;
          const sc = p.baseScale * (1 - u * 0.3);
          setScl(m, sc, sc, sc);
        } else if (b.kind === 'puffball' && p.isPuffball) {
          m.position.x += p.vx * step;
          m.position.z += p.vz * step;
          // Hop along the ground, then lift off and drift away like dandelion fluff
          m.position.y = 0.03 + Math.abs(Math.sin(b.age * p.hopFreq + p.phase)) * p.hopAmp * (1 - u * 0.45) + Math.max(0, u - 0.6) * 1.1;
        } else if (b.kind === 'whirl') {
          p.ang += p.angVel * step;
          p.radius += p.radiusVel * step;
          m.position.x = Math.cos(p.ang) * p.radius;
          m.position.z = Math.sin(p.ang) * p.radius;
          m.position.y += p.vy * step;
          m.rotation.x += (p.rx || 0) * step;
          m.rotation.y += (p.ry || 0) * step;
          const blink = p.blinkFreq ? 0.45 + 0.55 * Math.abs(Math.sin(b.age * p.blinkFreq + p.phase)) : 1;
          const sc = p.baseScale * blink * (1 - u * 0.25);
          setScl(m, sc, sc, sc);
        } else if (b.kind === 'bubble') {
          if (u >= p.popAt + 0.06) {
            m.visible = false;
            continue;
          }
          m.position.x += (p.vx + Math.sin(b.age * 5 + p.phase) * 0.35) * step;
          m.position.y += p.vy * step;
          m.position.z += (p.vz + Math.cos(b.age * 5 + p.phase) * 0.35) * step;
          // Swell gently, then a quick "pop" bulge right before vanishing
          const popBulge = u >= p.popAt ? 1 + ((u - p.popAt) / 0.06) * 0.5 : 1;
          const sc = p.baseScale * (0.7 + u * 0.6) * popBulge;
          setScl(m, sc, sc, sc);
        } else if (b.kind === 'confetti') {
          const floorY = -0.2;
          if (m.position.y <= floorY && p.vy < 0) continue;
          m.position.x += p.vx * step;
          m.position.y = Math.max(floorY, m.position.y + p.vy * step);
          m.position.z += p.vz * step;
          p.vx *= 1 - step * 1.4;
          p.vz *= 1 - step * 1.4;
          p.vy -= 6.8 * step;
          m.rotation.x += (p.rx || 0) * step;
          m.rotation.y += (p.ry || 0) * step;
          m.rotation.z += (p.rz || 0) * step;
        } else {
          m.position.x += p.vx * step;
          m.position.y += p.vy * step;
          m.position.z += p.vz * step;
          const grow = p.baseScale * (1 + u * 0.65);
          setScl(m, grow, grow, grow);
        }
      }
    }
  }

  function clearRoundVfx() {
    while (activeBursts.length > 0) disposeBurst(activeBursts.pop());
  }

  function applyBlasterSkin(gunMatsOverride, skinIdOverride) {
    const mats = gunMatsOverride || env.gunMats;
    if (!mats) return;
    const skinId = skinIdOverride || state.equipped.blaster || 'classic';
    const skin = getItem('blaster', skinId) || COSMETIC_CATALOG.blaster[0];
    if (!skin || !skin.colors) return;
    const applyHex = (mat, hex) => {
      if (!mat || !mat.color) return;
      if (typeof mat.color.setHex === 'function') mat.color.setHex(hex);
      else if (typeof mat.color.set === 'function') mat.color.set(hex);
    };
    applyHex(mats.tank, skin.colors.tank);
    applyHex(mats.barrel, skin.colors.barrel);
    applyHex(mats.grip, skin.colors.grip);
  }

  // ============================================================
  // Interactive Lobby Strip & 99-Level Spirit Journey Modal UI
  // ============================================================
  function ensureStylesheetLinked() {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.querySelector('link[href*="progression.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'progression.css?v=2';
    document.head.appendChild(link);
  }

  function syncStripUI(bumpTokens = false) {
    if (!dom.strip) return;
    const isMax = state.level >= MAX_LEVEL;
    const needed = xpNeededForLevel(state.level);
    const pct = isMax ? 100 : Math.max(0, Math.min(100, (state.xp / needed) * 100));
    const nextMaj = getNextMajorUnlock(state.level);

    if (dom.lvBadge) {
      dom.lvBadge.textContent = `⭐ Lv. ${state.level}`;
      dom.lvBadge.title = `${getRankTitleForLevel(state.level)} (Level ${state.level} / ${MAX_LEVEL})`;
    }
    if (dom.xpFill) dom.xpFill.style.width = `${pct.toFixed(1)}%`;
    if (dom.xpText) dom.xpText.textContent = isMax ? 'Lv. 99 MAX' : `${state.xp} / ${needed} XP`;
    if (dom.tokenCount) dom.tokenCount.textContent = String(state.tokens);
    if (dom.leaguePill) {
      const lg = getRankLeagueForTrophies(state.trophies || 0);
      dom.leaguePill.textContent = `${lg.icon} ${lg.trophies} 🏆`;
      dom.leaguePill.style.borderColor = lg.color;
      dom.leaguePill.title = `${lg.name} League (${lg.trophies} Trophies)`;
    }
    if (dom.personaPill) {
      const ps = computePlaystylePersona(state.personaStats);
      dom.personaPill.textContent = `${ps.icon} ${ps.name}`;
      dom.personaPill.style.borderColor = ps.color;
      dom.personaPill.title = `Playstyle Persona: ${ps.name}`;
    }

    if (dom.nextUnlockPill) {
      if (nextMaj) {
        dom.nextUnlockPill.textContent = `Next: ${nextMaj.icon} Lv.${nextMaj.level}`;
        dom.nextUnlockPill.title = `Level ${nextMaj.level}: ${nextMaj.title} — ${nextMaj.desc}`;
        dom.nextUnlockPill.classList.remove('hidden');
      } else {
        dom.nextUnlockPill.textContent = '🏆 Legend 99';
      }
    }

    if (dom.streakPill) {
      if (state.winStreak >= 1) {
        dom.streakPill.textContent = `🔥 ${state.winStreak}`;
        dom.streakPill.title = `${state.winStreak} Win Streak! Winning matches accelerates XP!`;
        dom.streakPill.classList.remove('hidden');
      } else {
        dom.streakPill.classList.add('hidden');
      }
    }

    if (bumpTokens && dom.tokenPill) {
      dom.tokenPill.classList.remove('bump');
      void dom.tokenPill.offsetWidth;
      dom.tokenPill.classList.add('bump');
      setTimeout(() => dom.tokenPill && dom.tokenPill.classList.remove('bump'), 240);
    }

    if (dom.equippedRow) {
      const previewTabs = ['elemGun', 'hiderPerk', 'seekerPerk', 'hat'];
      dom.equippedRow.innerHTML = previewTabs.map((catId) => {
        const activeId = catId === 'elemGun' ? getActiveElemGun() : state.equipped[catId];
        const eqItem = getItem(catId, activeId);
        const ic = eqItem ? eqItem.icon : '✨';
        const nm = eqItem ? eqItem.name : catId;
        return `<button type="button" class="prog-eq-chip" data-open-tab="${catId}" title="${nm}" aria-label="${nm}">${ic}</button>`;
      }).join('');
    }

    if (dom.openBtn) {
      const showDot = hasAffordableLockedItem();
      dom.openBtn.innerHTML = `<span>🗺️ Journey</span>${showDot ? '<i class="prog-shop-dot" title="Cosmetic affordable!"></i>' : ''}`;
    }

    const adminOn = isAdmin();
    if (dom.adminBtn) dom.adminBtn.classList.toggle('hidden', !adminOn);
    if (dom.adminModalBtn) dom.adminModalBtn.classList.toggle('hidden', !adminOn);
    syncAdminModalUI();
  }

  function syncWardrobeHeader() {
    const isMax = state.level >= MAX_LEVEL;
    const needed = xpNeededForLevel(state.level);
    if (dom.walletCount) dom.walletCount.textContent = `🪙 ${state.tokens}`;
    if (dom.lvMini) {
      dom.lvMini.textContent = isMax
        ? `⭐ Lv. 99 MAX · ${getRankTitleForLevel(99)}`
        : `⭐ Lv. ${state.level}/99 · ${state.xp}/${needed} XP`;
    }
  }

  function setFeedback(text, tone = '') {
    if (!dom.feedback) return;
    dom.feedback.textContent = text;
    dom.feedback.className = `w-feedback${tone ? ' ' + tone : ''}`;
  }

  function defaultFeedbackForTab(tabId) {
    if (tabId === 'journey') {
      const nextMaj = getNextMajorUnlock(state.level);
      return {
        text: nextMaj
          ? `🏆 A Series win pays ${MATCH_BASE_XP.win} base XP (a loss ${MATCH_BASE_XP.loss}) + Streak Bonuses! Next Major Unlock at Lv. ${nextMaj.level}: ${nextMaj.icon} ${nextMaj.title}!`
          : '🏆 You have reached Level 99: Spirit Realm Legend!',
        tone: 'good',
      };
    }
    if (tabId === 'elemGun') {
      return {
        text: '🔥 Elemental Guns unlock permanently at Levels 1, 6, 14, 22 & 32 — each with its own combat status effect!',
        tone: '',
      };
    }
    if (tabId === 'hiderPerk' || tabId === 'seekerPerk') {
      return {
        text: '⚡ Equip 1 Hider Perk & 1 Seeker Perk! Climb up to Level 90 for game-changing Master & Apex Perks.',
        tone: '',
      };
    }
    const col = getCollectionStats();
    return {
      text: col.remaining > 0
        ? `🛍️ ${col.remaining} items still to collect (${col.owned}/${col.total} owned) — win matches & finish Daily Contracts for Spirit Tokens 🪙!`
        : '🏆 Collection complete! Spend spare 🪙 on Lucky Charms & Contract Rerolls in the Journey tab.',
      tone: '',
    };
  }

  function renderWardrobeTabs() {
    if (!dom.tabsHost) return;
    dom.tabsHost.innerHTML = CATEGORY_TABS.map((tab) => {
      const isAct = tab.id === activeTab;
      if (tab.id === 'journey') {
        return `
          <button type="button" role="tab" aria-selected="${isAct}" class="w-tab is-elem-tab${isAct ? ' active' : ''}" data-tab="journey">
            <span>🗺️ Journey</span>
            <small>Lv.${state.level}/99</small>
          </button>
        `;
      }
      const total = COSMETIC_CATALOG[tab.id].length;
      const owned = (state.unlocked[tab.id] || []).length;
      return `
        <button type="button" role="tab" aria-selected="${isAct}" class="w-tab${isAct ? ' active' : ''}" data-tab="${tab.id}">
          <span>${tab.icon} ${tab.label}</span>
          <small>${owned}/${total}</small>
        </button>
      `;
    }).join('');
  }

  function renderJourneyTab() {
    const isMax = state.level >= MAX_LEVEL;
    const needed = xpNeededForLevel(state.level);
    const pct = isMax ? 100 : Math.max(0, Math.min(100, (state.xp / needed) * 100));
    const nextMaj = getNextMajorUnlock(state.level);
    const contracts = getDailyContractsStatus();

    const bannerHtml = `
      <div class="jr-hero">
        <div class="jr-hero-left">
          <div class="jr-rank-kicker">🌟 ${getRankTitleForLevel(state.level)}${state.winStreak >= 1 ? ` · 🔥 ${state.winStreak} Win Streak` : ''}</div>
          <h3>Level ${state.level} <small>/ ${MAX_LEVEL}</small></h3>
          <div class="jr-xp-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
          <div class="jr-xp-sub">${isMax ? 'Maximum Legend Rank Reached!' : `${state.xp} / ${needed} XP (${needed - state.xp} XP to Lv. ${state.level + 1}) · Win = ${MATCH_BASE_XP.win} base XP, loss = ${MATCH_BASE_XP.loss}`}</div>
        </div>
        <div class="jr-hero-next">
          <span class="jr-next-lbl">NEXT MAJOR MILESTONE</span>
          ${nextMaj
            ? `<div class="jr-next-card"><span class="jr-next-ic">${nextMaj.icon}</span><div><b>Lv. ${nextMaj.level} · ${nextMaj.title}</b><p>${nextMaj.desc}</p></div></div>`
            : `<div class="jr-next-card"><span class="jr-next-ic">🏆</span><div><b>Spirit Realm Legend</b><p>All 99 Levels Conquered!</p></div></div>`}
        </div>
      </div>
    `;

    const rerollCost = getContractRerollCost();
    const openContracts = contracts.filter((c) => !c.done).length;
    const rerollBtnHtml = openContracts > 0
      ? `<button type="button" class="jr-mini-btn${state.tokens >= rerollCost ? '' : ' short'}" data-shop-action="reroll" title="Swap your ${openContracts} unfinished contract${openContracts > 1 ? 's' : ''} for new ones. The price rises ${CONTRACT_REROLL_STEP_COST} 🪙 with every reroll today.">🔄 Reroll · ${rerollCost} 🪙</button>`
      : `<button type="button" class="jr-mini-btn short" disabled>✓ All done today</button>`;

    const col = getCollectionStats();
    const charmOn = hasLuckyCharm();
    const charmActionHtml = charmOn
      ? `<span class="jr-shop-on">✓ Active</span>`
      : `<button type="button" class="jr-mini-btn${state.tokens >= LUCKY_CHARM_COST ? '' : ' short'}" data-shop-action="charm">Buy · ${LUCKY_CHARM_COST} 🪙</button>`;
    const collectLine = col.remaining > 0 && col.next
      ? `Next: ${col.next.item.icon} ${col.next.item.name} (${col.next.item.cost} 🪙)`
      : 'Every hat, taunt, poof &amp; skin is yours!';
    const shopHtml = `
      <div class="jr-shop">
        <div class="jr-sec-hdr">🛍️ Spirit Shop <span>Spend Spirit Tokens 🪙</span></div>
        <div class="jr-shop-row">
          <div class="jr-shop-card${charmOn ? ' is-on' : ''}">
            <span class="jr-shop-ic">🍀</span>
            <div class="jr-shop-txt">
              <b>Lucky Charm</b>
              <p>${charmOn ? `Your next finished match pays +${LUCKY_CHARM_XP_PCT}% XP.` : `+${LUCKY_CHARM_XP_PCT}% XP on your next finished match (1 charge).`}</p>
            </div>
            ${charmActionHtml}
          </div>
          <div class="jr-shop-card">
            <span class="jr-shop-ic">👒</span>
            <div class="jr-shop-txt">
              <b>${col.remaining > 0 ? `${col.remaining} wardrobe items to collect` : 'Wardrobe collection complete'} <small>${col.owned}/${col.total} owned</small></b>
              <p>${collectLine}</p>
            </div>
            <button type="button" class="jr-mini-btn alt" data-open-shop-tab="${col.next ? col.next.category : 'hat'}">Browse</button>
          </div>
        </div>
      </div>
    `;

    const contractsHtml = `
      <div class="jr-contracts">
        <div class="jr-sec-hdr">📜 Daily Spirit Contracts <div class="jr-hdr-actions"><span>Bonus XP + Tokens</span>${rerollBtnHtml}</div></div>
        <div class="jr-contract-row">
          ${contracts.map((c) => `
            <div class="jr-contract${c.done ? ' is-done' : ''}">
              <div class="jr-c-top">
                <span>${c.icon} <b>${c.title}</b></span>
                <em>${c.done ? '✓ Claimed' : `+${c.xp} XP · +${c.tokens} 🪙`}</em>
              </div>
              <p>${c.desc} (${c.progress}/${c.target})</p>
              <div class="w-ach-track"><i class="w-ach-fill" style="width:${(c.ratio * 100).toFixed(0)}%"></i></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const roadNodesHtml = LEVEL_ROAD.map((node) => {
      const reached = state.level >= node.level;
      const isCurrent = state.level === node.level;
      const isNextMajor = nextMaj && nextMaj.level === node.level;
      const cls = [
        'jr-node',
        node.major ? 'is-major' : (node.kind === 'small_tokens' ? 'is-pouch' : 'is-step'),
        reached ? 'is-reached' : 'is-locked',
        isCurrent ? 'is-current' : '',
        isNextMajor ? 'is-next-major' : '',
      ].filter(Boolean).join(' ');

      return `
        <div class="${cls}" data-road-lv="${node.level}">
          <div class="jr-lv-pill">Lv. ${node.level}</div>
          <div class="jr-node-ic">${node.icon}</div>
          <div class="jr-node-badge">${node.badge}</div>
          <div class="jr-node-title">${node.title}</div>
          <div class="jr-node-desc">${node.desc}</div>
          <div class="jr-node-status">${reached ? '✓ Unlocked' : `🔒 Lv. ${node.level}`}</div>
        </div>
      `;
    }).join('');

    dom.gridHost.innerHTML = `
      <div class="jr-wrap">
        ${bannerHtml}
        ${contractsHtml}
        ${shopHtml}
        <div class="jr-sec-hdr">🗺️ 99-Level Spirit Road <span>Swipe / Scroll Levels 1 → 99</span></div>
        <div class="jr-road-track" id="jrRoadTrack">${roadNodesHtml}</div>
      </div>
    `;

    requestAnimationFrame(() => {
      const curEl = dom.gridHost.querySelector(`.jr-node[data-road-lv="${state.level}"]`);
      const trackEl = dom.gridHost.querySelector('#jrRoadTrack');
      if (curEl && trackEl) {
        trackEl.scrollLeft = Math.max(0, curEl.offsetLeft - 80);
      }
    });
  }

  function renderWardrobeGrid() {
    if (!dom.gridHost) return;
    if (activeTab === 'journey') {
      dom.gridHost.classList.add('is-journey-layout');
      renderJourneyTab();
      return;
    }
    dom.gridHost.classList.remove('is-journey-layout');

    const items = COSMETIC_CATALOG[activeTab] || [];

    if (activeTab === 'elemGun' || activeTab === 'hiderPerk' || activeTab === 'seekerPerk') {
      const equippedId = activeTab === 'elemGun'
        ? getActiveElemGun()
        : (activeTab === 'hiderPerk' ? getActiveHiderPerk() : getActiveSeekerPerk());

      const cardsHtml = items.map((item) => {
        const reqLv = item.levelReq || 1;
        const unlocked = isAdminBypassActive() || (state.level >= reqLv && isUnlocked(activeTab, item.id));
        const equipped = unlocked && equippedId === item.id;
        const celebrate = lastUnlockedItemId === `${activeTab}:${item.id}`;
        const lvProgressPct = Math.min(100, (state.level / reqLv) * 100).toFixed(0);

        const statusPill = equipped
          ? '<span class="w-status-pill eq">Equipped</span>'
          : unlocked
            ? '<span class="w-status-pill owned">Unlocked</span>'
            : `<span class="w-status-pill locked ach-locked">🔒 Lv. ${reqLv}</span>`;

        const badgeLine = item.effectBadge
          ? `<div class="w-effect-pill">${item.effectBadge}</div>`
          : (item.tier ? `<div class="w-effect-pill perk">${item.tier} · Unlock Lv. ${reqLv}</div>` : '');

        const lockProgressHtml = unlocked
          ? ''
          : `<div class="w-ach-box">
              <div class="w-ach-top">
                <span class="w-ach-title">🔒 Unlocks at Level ${reqLv}</span>
                <span class="w-ach-reward">Lv. ${state.level}/${reqLv}</span>
              </div>
              <div class="w-ach-track"><i class="w-ach-fill" style="width:${lvProgressPct}%"></i></div>
            </div>`;

        const actionBtn = equipped
          ? `<button type="button" class="w-btn equipped" disabled>✓ Equipped</button>`
          : unlocked
            ? `<button type="button" class="w-btn equip" data-equip-id="${item.id}">Equip</button>`
            : `<button type="button" class="w-btn buy short" disabled>🔒 Reach Level ${reqLv}</button>`;

        return `
          <div class="w-card is-elem-card${equipped ? ' is-equipped' : ''}${celebrate ? ' just-unlocked' : ''}">
            <div class="w-art-well">
              ${statusPill}
              ${renderCosmeticCardSvg(activeTab, item)}
            </div>
            <div class="w-info">
              <h3>${item.icon} ${item.name}</h3>
              ${badgeLine}
              <p>${item.desc}</p>
              ${lockProgressHtml}
            </div>
            <div class="w-actions">${actionBtn}</div>
          </div>
        `;
      }).join('');

      if (activeTab === 'elemGun') {
        const masteryList = ACHIEVEMENTS.map((a) => evaluateAchievement(a));
        const masteryHtml = `
          <div class="w-mastery-strip" aria-label="Mastery Bounties">
            <div class="w-mastery-hdr">🏆 Lifetime Mastery Bounties (Bonus XP + Spirit Tokens)</div>
            <div class="w-mastery-row">
              ${masteryList.map((m) => `
                <div class="w-mastery-pill${m.unlocked ? ' is-done' : ''}">
                  <div class="w-mastery-top">
                    <span>${m.icon} <b>${m.name}</b></span>
                    <em>${m.unlocked ? '✓ Completed' : `+${m.rewardXp} XP · +${m.reward} 🪙`}</em>
                  </div>
                  <div class="w-mastery-desc">${m.desc} · <span>${m.progressText}</span></div>
                  <div class="w-ach-track"><i class="w-ach-fill" style="width:${(m.ratio * 100).toFixed(1)}%"></i></div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        dom.gridHost.innerHTML = cardsHtml + masteryHtml;
      } else {
        dom.gridHost.innerHTML = cardsHtml;
      }
      lastUnlockedItemId = null;
      return;
    }

    const equippedId = state.equipped[activeTab];
    dom.gridHost.innerHTML = items.map((item) => {
      const unlocked = isUnlocked(activeTab, item.id);
      const equipped = equippedId === item.id;
      const isLvGated = Boolean(item.levelReq);
      const canAfford = !isLvGated && state.tokens >= item.cost;
      const celebrate = lastUnlockedItemId === `${activeTab}:${item.id}`;

      const statusPill = equipped
        ? '<span class="w-status-pill eq">Equipped</span>'
        : unlocked
          ? '<span class="w-status-pill owned">Unlocked</span>'
          : isLvGated
            ? `<span class="w-status-pill locked ach-locked">🔒 Lv. ${item.levelReq}</span>`
            : `<span class="w-status-pill locked">${item.cost} 🪙</span>`;

      let swatchesHtml = '';
      if (activeTab === 'blaster' && item.colors) {
        const c1 = '#' + item.colors.tank.toString(16).padStart(6, '0');
        const c2 = '#' + item.colors.barrel.toString(16).padStart(6, '0');
        const c3 = '#' + item.colors.grip.toString(16).padStart(6, '0');
        swatchesHtml = `<div class="w-swatches" aria-hidden="true">
          <span class="w-swatch" style="background:${c1}"></span>
          <span class="w-swatch" style="background:${c2}"></span>
          <span class="w-swatch" style="background:${c3}"></span>
        </div>`;
      }

      const previewBtnHtml = activeTab === 'taunt'
        ? `<button type="button" class="w-btn preview" data-preview-taunt="${item.id}" title="Preview ${item.name}">🔊 Preview</button>`
        : '';

      let mainActionHtml = '';
      if (equipped) {
        mainActionHtml = `<button type="button" class="w-btn equipped" disabled>✓ Equipped</button>`;
      } else if (unlocked) {
        mainActionHtml = `<button type="button" class="w-btn equip" data-equip-id="${item.id}">Equip</button>`;
      } else if (isLvGated) {
        mainActionHtml = `<button type="button" class="w-btn buy short" disabled>🔒 Lv. ${item.levelReq} Prestige</button>`;
      } else {
        mainActionHtml = `<button type="button" class="w-btn buy${canAfford ? '' : ' short'}" data-buy-id="${item.id}">Buy (${item.cost} 🪙)</button>`;
      }

      return `
        <div class="w-card${equipped ? ' is-equipped' : ''}${celebrate ? ' just-unlocked' : ''}">
          <div class="w-art-well">
            ${statusPill}
            ${renderCosmeticCardSvg(activeTab, item)}
          </div>
          <div class="w-info">
            <h3>${item.icon} ${item.name}</h3>
            <p>${item.desc}</p>
            ${swatchesHtml}
          </div>
          <div class="w-actions">
            ${previewBtnHtml}
            ${mainActionHtml}
          </div>
        </div>
      `;
    }).join('');
    lastUnlockedItemId = null;
  }

  function handleBuyOrEquip(category, itemId, btnEl) {
    const item = getItem(category, itemId);
    if (!item) return;

    if (category === 'elemGun') {
      if (isUnlocked('elemGun', itemId)) {
        state.equipped.elemGun = itemId;
        saveState();
        if (env.audio?.tap) env.audio.tap();
        try { env.onElemGunChanged?.(getActiveElemGun()); } catch (_) { /* ignore */ }
        syncStripUI(false);
        renderWardrobeTabs();
        renderWardrobeGrid();
        setFeedback(`Equipped ${item.icon} ${item.name}!`, 'good');
      } else {
        playShortTokensKnock();
        setFeedback(`🔒 Reach Level ${item.levelReq || 6} to unlock ${item.name}!`, 'warn');
      }
      return;
    }

    if (category === 'hiderPerk' || category === 'seekerPerk') {
      if (isUnlocked(category, itemId)) {
        state.equipped[category] = itemId;
        saveState();
        if (env.audio?.tap) env.audio.tap();
        syncStripUI(false);
        renderWardrobeTabs();
        renderWardrobeGrid();
        setFeedback(`Equipped ${item.icon} ${item.name}!`, 'good');
      } else {
        playShortTokensKnock();
        setFeedback(`🔒 Reach Level ${item.levelReq || 5} to unlock ${item.name}!`, 'warn');
      }
      return;
    }

    if (isUnlocked(category, itemId)) {
      state.equipped[category] = itemId;
      saveState();
      if (category === 'blaster') applyBlasterSkin();
      if (env.audio?.tap) env.audio.tap();
      syncStripUI(false);
      renderWardrobeGrid();
      setFeedback(`Equipped ${item.icon} ${item.name}!`, 'good');
      return;
    }

    if (item.levelReq && !isAdminBypassActive() && state.level < item.levelReq) {
      playShortTokensKnock();
      setFeedback(`🔒 Prestige reward — reach Level ${item.levelReq} to unlock ${item.name}!`, 'warn');
      return;
    }

    if (state.tokens < item.cost) {
      const missing = item.cost - state.tokens;
      playShortTokensKnock();
      if (btnEl) {
        btnEl.classList.remove('is-shake');
        void btnEl.offsetWidth;
        btnEl.classList.add('is-shake');
      }
      setFeedback(`Need ${missing} more 🪙 — win matches or complete Daily Contracts!`, 'warn');
      return;
    }

    state.tokens -= item.cost;
    if (!Array.isArray(state.unlocked[category])) state.unlocked[category] = [DEFAULT_EQUIPPED[category]];
    if (!state.unlocked[category].includes(itemId)) state.unlocked[category].push(itemId);
    state.equipped[category] = itemId;
    lastUnlockedItemId = `${category}:${itemId}`;
    saveState();

    if (category === 'blaster') applyBlasterSkin();
    playCoinUnlockChime();
    syncStripUI(true);
    syncWardrobeHeader();
    renderWardrobeTabs();
    renderWardrobeGrid();
    setFeedback(`✨ Unlocked & equipped ${item.icon} ${item.name}!`, 'good');
  }

  function handleShopAction(action, btnEl) {
    const shakeBtn = () => {
      playShortTokensKnock();
      if (btnEl) {
        btnEl.classList.remove('is-shake');
        void btnEl.offsetWidth;
        btnEl.classList.add('is-shake');
      }
    };
    const refresh = () => {
      syncWardrobeHeader();
      renderWardrobeTabs();
      renderWardrobeGrid();
    };

    if (action === 'reroll') {
      const res = rerollDailyContracts();
      if (res.ok) {
        playCoinUnlockChime();
        refresh();
        setFeedback(`🔄 ${res.replaced} new contract${res.replaced > 1 ? 's' : ''} for ${res.cost} 🪙 — the next reroll today costs ${res.nextCost} 🪙.`, 'good');
      } else if (res.reason === 'tokens') {
        shakeBtn();
        setFeedback(`Need ${res.missing} more 🪙 to reroll today's contracts (${res.cost} 🪙).`, 'warn');
      } else {
        shakeBtn();
        setFeedback('All of today\'s contracts are already complete — fresh ones arrive tomorrow!', 'warn');
      }
      return;
    }

    if (action === 'charm') {
      const res = buyLuckyCharm();
      if (res.ok) {
        playCoinUnlockChime();
        refresh();
        setFeedback(`🍀 Lucky Charm ready — your next finished match pays +${LUCKY_CHARM_XP_PCT}% XP!`, 'good');
      } else if (res.reason === 'tokens') {
        shakeBtn();
        setFeedback(`Need ${res.missing} more 🪙 for a Lucky Charm (${res.cost} 🪙).`, 'warn');
      } else {
        setFeedback('🍀 A Lucky Charm is already active — play a match to use it first.', 'warn');
      }
    }
  }

  function openWardrobe(initialTab) {
    if (!dom.modal) mountUI();
    if (!dom.modal) return;
    if (initialTab && (initialTab === 'journey' || COSMETIC_CATALOG[initialTab])) {
      activeTab = initialTab;
    }
    syncWardrobeHeader();
    renderWardrobeTabs();
    renderWardrobeGrid();
    const fb = defaultFeedbackForTab(activeTab);
    setFeedback(fb.text, fb.tone);
    dom.modal.classList.add('on');
  }

  function closeWardrobe() {
    if (!dom.modal) return;
    dom.modal.classList.remove('on');
  }

  function syncAdminModalUI() {
    if (!dom.adminModal) return;
    const tag = activeAccountName || readStoredGamertag() || (typeof env.getPlayerName === 'function' ? env.getPlayerName() : '') || 'Player';
    if (dom.adminMetaTxt) {
      dom.adminMetaTxt.textContent = `Account: ${tag} · Lv. ${state.level}/${MAX_LEVEL} · Bypass: ${adminWorldBypass ? 'ON' : 'OFF'}`;
    }
    if (dom.adminBypassBtn) {
      dom.adminBypassBtn.textContent = adminWorldBypass
        ? '🔓 Bypass World & Gun Locks: ON'
        : '🔒 Bypass World & Gun Locks: OFF';
      dom.adminBypassBtn.classList.toggle('is-on', adminWorldBypass);
    }
    if (dom.adminWorldGrid) {
      const curMap = typeof env.getActiveMapId === 'function' ? env.getActiveMapId() : '';
      dom.adminWorldGrid.querySelectorAll('[data-admin-map]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-admin-map') === curMap);
      });
    }
  }

  function openAdminPanel() {
    if (!dom.adminModal) return;
    if (env.audio?.tap) env.audio.tap();
    closeWardrobe();
    syncAdminModalUI();
    dom.adminModal.classList.add('on');
    dom.adminModal.setAttribute('aria-hidden', 'false');
  }

  function closeAdminPanel() {
    if (!dom.adminModal) return;
    dom.adminModal.classList.remove('on');
    dom.adminModal.setAttribute('aria-hidden', 'true');
  }

  function mountUI() {
    if (typeof document === 'undefined') return;
    ensureStylesheetLinked();

    const appEl = document.getElementById('app') || document.body;
    const titleEl = document.getElementById('title');

    if (titleEl && !document.getElementById('progStrip')) {
      const strip = document.createElement('div');
      strip.id = 'progStrip';
      strip.className = 'prog-strip';
      strip.innerHTML = `
        <div class="prog-lv-cluster" data-open-journey="1" title="Open 99-Level Spirit Journey">
          <span class="prog-lv-badge" id="progLevelBadge">⭐ Lv. 1</span>
          <div class="prog-xp-wrap">
            <div class="prog-xp-track"><i class="prog-xp-fill" id="progXpFill"></i></div>
            <span class="prog-xp-lbl" id="progXpText">0 / 220 XP</span>
          </div>
          <span class="prog-next-pill" id="progNextUnlockPill">Next: 🏮 Lv.2</span>
          <span class="prog-league-pill" id="progLeaguePill" style="padding:3px 9px;border-radius:999px;background:rgba(255,244,214,.95);border:1.5px solid #cd7f32;font-weight:900;font-size:11.5px;color:#4a2e0b;white-space:nowrap;">🥉 0 🏆</span>
          <span class="prog-persona-pill" id="progPersonaPill">🌿 Rising Spirit</span>
          <span class="prog-streak-pill hidden" id="progStreakPill">🔥 1</span>
        </div>
        <div class="prog-token-pill" id="progTokenPill" title="Spirit Tokens">
          <span>🪙</span><b id="progTokenCount">60</b><small>Tokens</small>
        </div>
        <div class="prog-equipped-row" id="progEquippedPreview" aria-label="Equipped loadout"></div>
        <button type="button" class="prog-wardrobe-btn" id="btnOpenWardrobe"><span>🗺️ Journey</span></button>
        <button type="button" class="prog-admin-btn${isAdmin() ? '' : ' hidden'}" id="btnAdminPanel" title="Admin &amp; World Verifier"><span>👑 Admin</span></button>
      `;

      const modesEl = titleEl.querySelector('.modes');
      if (modesEl) titleEl.insertBefore(strip, modesEl);
      else titleEl.appendChild(strip);

      strip.addEventListener('click', (e) => {
        if (e.target.closest('#btnAdminPanel')) {
          openAdminPanel();
          return;
        }
        const eqChip = e.target.closest('[data-open-tab]');
        if (eqChip) {
          if (env.audio?.tap) env.audio.tap();
          openWardrobe(eqChip.getAttribute('data-open-tab'));
          return;
        }
        if (e.target.closest('#btnOpenWardrobe') || e.target.closest('[data-open-journey]')) {
          if (env.audio?.tap) env.audio.tap();
          openWardrobe('journey');
        }
      });
    }

    dom.strip = document.getElementById('progStrip');
    dom.lvBadge = document.getElementById('progLevelBadge');
    dom.xpFill = document.getElementById('progXpFill');
    dom.xpText = document.getElementById('progXpText');
    dom.nextUnlockPill = document.getElementById('progNextUnlockPill');
    dom.leaguePill = document.getElementById('progLeaguePill');
    dom.personaPill = document.getElementById('progPersonaPill');
    dom.streakPill = document.getElementById('progStreakPill');
    dom.tokenPill = document.getElementById('progTokenPill');
    dom.tokenCount = document.getElementById('progTokenCount');
    dom.equippedRow = document.getElementById('progEquippedPreview');
    dom.openBtn = document.getElementById('btnOpenWardrobe');
    dom.adminBtn = document.getElementById('btnAdminPanel');

    const resultCard = document.querySelector('#result .card');
    if (resultCard && !document.getElementById('resultRewardsSlot')) {
      const slot = document.createElement('div');
      slot.id = 'resultRewardsSlot';
      const rRow = resultCard.querySelector('.r-row');
      if (rRow) resultCard.insertBefore(slot, rRow);
      else resultCard.appendChild(slot);
    }

    if (appEl && !document.getElementById('wardrobeModal')) {
      const modal = document.createElement('div');
      modal.id = 'wardrobeModal';
      modal.className = 'wardrobe-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'wardrobeModalTitle');
      modal.innerHTML = `
        <div class="w-dialog">
          <div class="w-header">
            <div class="w-title-wrap">
              <h2 id="wardrobeModalTitle">🗺️ Spirit Journey &amp; Loadout</h2>
              <p>Climb Levels 1 → 99 to unlock Worlds, Elemental Guns, High-Tier Perks &amp; Prestige Gear</p>
            </div>
            <div class="w-header-right">
              <button type="button" class="w-admin-btn${isAdmin() ? '' : ' hidden'}" id="btnAdminInModal" title="Admin &amp; World Verifier">👑 Admin</button>
              <span class="w-lv-mini" id="wardrobeLvMini">⭐ Lv. 1/99</span>
              <span class="w-wallet" id="wardrobeWalletCount">🪙 60</span>
              <button type="button" class="w-close" id="btnCloseWardrobe" aria-label="Close">✕</button>
            </div>
          </div>
          <div class="w-tabs" id="wardrobeTabs" role="tablist"></div>
          <div class="w-body">
            <div class="w-grid" id="wardrobeGrid"></div>
          </div>
          <div class="w-footer">
            <span class="w-feedback" id="wardrobeFeedback">🏆 A Series win pays ${MATCH_BASE_XP.win} base XP (a loss ${MATCH_BASE_XP.loss}) + Streak Bonuses!</span>
          </div>
        </div>
      `;
      appEl.appendChild(modal);

      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('#btnCloseWardrobe')) {
          if (env.audio?.tap) env.audio.tap();
          closeWardrobe();
          return;
        }
        const tabBtn = e.target.closest('[data-tab]');
        if (tabBtn) {
          const nextTab = tabBtn.getAttribute('data-tab');
          if ((nextTab === 'journey' || COSMETIC_CATALOG[nextTab]) && nextTab !== activeTab) {
            activeTab = nextTab;
            if (env.audio?.tap) env.audio.tap();
            renderWardrobeTabs();
            renderWardrobeGrid();
            const fb = defaultFeedbackForTab(activeTab);
            setFeedback(fb.text, fb.tone);
          }
          return;
        }
        const shopBtn = e.target.closest('[data-shop-action]');
        if (shopBtn) {
          handleShopAction(shopBtn.getAttribute('data-shop-action'), shopBtn);
          return;
        }
        const browseBtn = e.target.closest('[data-open-shop-tab]');
        if (browseBtn) {
          const nextTab = browseBtn.getAttribute('data-open-shop-tab');
          if (COSMETIC_CATALOG[nextTab]) {
            activeTab = nextTab;
            if (env.audio?.tap) env.audio.tap();
            renderWardrobeTabs();
            renderWardrobeGrid();
            const fb = defaultFeedbackForTab(activeTab);
            setFeedback(fb.text, fb.tone);
          }
          return;
        }
        const previewBtn = e.target.closest('[data-preview-taunt]');
        if (previewBtn) {
          const tauntId = previewBtn.getAttribute('data-preview-taunt');
          if (typeof env.onPreviewTaunt === 'function') env.onPreviewTaunt(tauntId);
          else playFallbackTauntSynth(tauntId);
          const item = getItem('taunt', tauntId);
          if (item) setFeedback(`🔊 Previewing ${item.icon} ${item.name}…`);
          return;
        }
        const equipBtn = e.target.closest('[data-equip-id]');
        if (equipBtn) {
          handleBuyOrEquip(activeTab, equipBtn.getAttribute('data-equip-id'), equipBtn);
          return;
        }
        const buyBtn = e.target.closest('[data-buy-id]');
        if (buyBtn) {
          handleBuyOrEquip(activeTab, buyBtn.getAttribute('data-buy-id'), buyBtn);
        }
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('on')) {
          e.stopPropagation();
          closeWardrobe();
        } else if (e.key === 'Escape' && dom.adminModal && dom.adminModal.classList.contains('on')) {
          e.stopPropagation();
          closeAdminPanel();
        }
      });
    }

    dom.modal = document.getElementById('wardrobeModal');
    dom.adminModalBtn = document.getElementById('btnAdminInModal');
    if (dom.modal && !dom.modal._adminHooked) {
      dom.modal._adminHooked = true;
      dom.modal.addEventListener('click', (e) => {
        if (e.target.closest('#btnAdminInModal')) {
          openAdminPanel();
        }
      });
    }

    if (appEl && !document.getElementById('adminVerifierModal')) {
      const adminModal = document.createElement('div');
      adminModal.id = 'adminVerifierModal';
      adminModal.className = 'wardrobe-modal admin-modal';
      adminModal.setAttribute('role', 'dialog');
      adminModal.setAttribute('aria-modal', 'true');
      adminModal.setAttribute('aria-hidden', 'true');
      adminModal.setAttribute('aria-labelledby', 'adminModalTitle');
      const worldBtnsHtml = Object.values(MAP_DISPLAY_META).map((m) =>
        `<button type="button" class="admin-world-btn" data-admin-map="${m.id}"><span>${m.icon} ${m.name}</span><small>Unlock Req: Lv.${m.levelReq}</small></button>`
      ).join('');
      adminModal.innerHTML = `
        <div class="admin-dialog">
          <div class="admin-hdr">
            <div>
              <h2 id="adminModalTitle">👑 Admin &amp; World Verifier</h2>
              <p id="adminMetaTxt">Account: walid · Lv. 99/99 · Bypass: ON</p>
            </div>
            <button type="button" class="w-close" id="btnCloseAdminModal" aria-label="Close Admin Panel">✕</button>
          </div>
          <div class="admin-sec">
            <div class="admin-sec-lbl">🌍 Instant Jump to Any World (No Level Wait)</div>
            <div class="admin-world-grid" id="adminWorldGrid">${worldBtnsHtml}</div>
          </div>
          <div class="admin-sec">
            <div class="admin-sec-lbl">🔓 Verification &amp; Account Tools</div>
            <div class="admin-actions-row">
              <button type="button" class="admin-action-btn is-on" id="btnAdminBypassToggle">🔓 Bypass World &amp; Gun Locks: ON</button>
              <button type="button" class="admin-action-btn" data-admin-lv="1">Test Lv. 1</button>
              <button type="button" class="admin-action-btn" data-admin-lv="11">Test Lv. 11</button>
              <button type="button" class="admin-action-btn" data-admin-lv="36">Test Lv. 36</button>
              <button type="button" class="admin-action-btn gold" data-admin-lv="99">👑 Lv. 99 MAX</button>
              <button type="button" class="admin-action-btn" id="btnAdminTokens">+1,000 🪙</button>
              <button type="button" class="admin-action-btn" id="btnAdminSkipTut">🎓 Mark Tutorials Done</button>
            </div>
          </div>
        </div>
      `;
      appEl.appendChild(adminModal);
      adminModal.addEventListener('click', (e) => {
        if (e.target === adminModal || e.target.closest('#btnCloseAdminModal')) {
          closeAdminPanel();
          return;
        }
        const mapBtn = e.target.closest('[data-admin-map]');
        if (mapBtn) {
          const mapId = mapBtn.getAttribute('data-admin-map');
          if (env.audio?.tap) env.audio.tap();
          setAdminBypass(true);
          if (typeof env.onAdminSelectMap === 'function') env.onAdminSelectMap(mapId);
          syncAdminModalUI();
          closeAdminPanel();
          spawnHudToast('👑', `Loaded ${MAP_DISPLAY_META[mapId]?.name || mapId}`, 'Admin World Verifier active', '');
          return;
        }
        if (e.target.closest('#btnAdminBypassToggle')) {
          if (env.audio?.tap) env.audio.tap();
          const next = setAdminBypass(!adminWorldBypass);
          spawnHudToast('👑', next ? 'All Locks Bypassed (ON)' : 'Normal Level Locks (OFF)', next ? 'Verify any world & gun at any level!' : `Enforcing Lv. ${state.level} gates`, '');
          return;
        }
        const lvBtn = e.target.closest('[data-admin-lv]');
        if (lvBtn) {
          if (env.audio?.tap) env.audio.tap();
          const lv = Number(lvBtn.getAttribute('data-admin-lv')) || 99;
          if (lv === 99) state.tokens = Math.max(state.tokens, 5000);
          setLevelForAdmin(lv);
          spawnHudToast('⭐', `Level set to Lv. ${lv}`, lv === 99 ? 'Lv. 99 MAX · All rewards unlocked!' : `Admin bypass is ${adminWorldBypass ? 'ON' : 'OFF'}`, 'level-up');
          return;
        }
        if (e.target.closest('#btnAdminTokens')) {
          if (env.audio?.tap) env.audio.tap();
          awardTokens('admin_gift', 1000, '👑 Admin Gift! +1000 🪙', 0);
          syncAdminModalUI();
          return;
        }
        if (e.target.closest('#btnAdminSkipTut')) {
          if (env.audio?.tap) env.audio.tap();
          writeStorageSafe('hs_tutorial_hide_done_v1', '1');
          writeStorageSafe('hs_tutorial_seek_done_v1', '1');
          try { env.onAdminTutorialsSkipped?.(); } catch (_) { /* ignore */ }
          spawnHudToast('🎓', 'Tutorials Marked Complete', 'Jump directly into any 5v5 match!', '');
        }
      });
    }
    dom.adminModal = document.getElementById('adminVerifierModal');
    dom.adminMetaTxt = document.getElementById('adminMetaTxt');
    dom.adminBypassBtn = document.getElementById('btnAdminBypassToggle');
    dom.adminWorldGrid = document.getElementById('adminWorldGrid');

    dom.walletCount = document.getElementById('wardrobeWalletCount');
    dom.lvMini = document.getElementById('wardrobeLvMini');
    dom.tabsHost = document.getElementById('wardrobeTabs');
    dom.gridHost = document.getElementById('wardrobeGrid');
    dom.feedback = document.getElementById('wardrobeFeedback');

    if (appEl && !document.getElementById('progToastHost')) {
      const toastHost = document.createElement('div');
      toastHost.id = 'progToastHost';
      toastHost.setAttribute('aria-live', 'polite');
      appEl.appendChild(toastHost);
    }
    dom.toastHost = document.getElementById('progToastHost');

    syncIdentity(env.getPlayerName?.() || activeAccountName, { silent: true });
    syncStripUI(false);
    applyBlasterSkin();
  }

  // Promote existing admin profile (e.g. 'walid') immediately at initialization too
  syncIdentity(activeAccountName, { silent: true, noCallbacks: true });

  return {
    MAX_LEVEL,
    LEVEL_ROAD,
    xpNeededForLevel,
    mountUI,
    openWardrobe,
    closeWardrobe,
    openAdminPanel,
    closeAdminPanel,
    isAdmin,
    isAdminBypassActive,
    setAdminAccess,
    setAdminBypass,
    syncIdentity,
    setLevel: setLevelForAdmin,
    update,
    clearRoundVfx,
    resetMatchSessionCounter,
    awardTokens,
    awardXp: (xp) => {
      applyDirectTokenAndXpGrant(0, Math.max(0, Math.round(Number(xp) || 0)));
      saveState();
      syncStripUI(true);
      if (dom.modal && dom.modal.classList.contains('on')) renderWardrobeGrid();
    },
    equipPerk: (role, perkId) => {
      const cat = role === 'seeker' ? 'seekerPerk' : 'hiderPerk';
      if (isUnlocked(cat, perkId)) {
        state.equipped[cat] = perkId;
        saveState();
        syncStripUI(false);
        if (dom.modal && dom.modal.classList.contains('on')) renderWardrobeGrid();
        return true;
      }
      return false;
    },
    recordSeriesOutcome,
    renderResultSummary,
    getProfile: () => state,
    getLevel: () => state.level,
    getWinStreak: () => state.winStreak || 0,
    getRankTitle: () => getRankTitleForLevel(state.level),
    isMapUnlocked,
    getMapUnlockLevel,
    notifyLockedMap,
    getNextMajorUnlock,
    getDailyContractsStatus,
    getContractRerollCost,
    rerollDailyContracts,
    hasLuckyCharm,
    buyLuckyCharm,
    getDailyLoginStatus,
    claimDailyLoginReward,
    getSpiritChestStatus,
    claimSpiritChest,
    getDailyBlasterTrialStatus,
    claimDailyBlasterTrial,
    getRankLeague: () => getRankLeagueForTrophies(state.trophies || 0),
    getPlaystylePersona: () => computePlaystylePersona(state.personaStats),
    recordPersonaStat: (key, val = 1, isMax = false) => {
      if (!state.personaStats || typeof state.personaStats !== 'object') {
        state.personaStats = { boops: 0, rescues: 0, maxWantedStars: 0, bounties: 0, stealthWins: 0 };
      }
      if (!(key in state.personaStats)) return;
      state.personaStats[key] = isMax
        ? Math.max(state.personaStats[key] || 0, Math.floor(Number(val) || 0))
        : (state.personaStats[key] || 0) + Math.floor(Number(val) || 1);
      saveState();
    },
    getNextMilestoneNudge,
    getCollectionStats,
    getEquipped: (category) => state.equipped[category],
    getActiveElemGun,
    getUnlockedElemGuns,
    getActiveHiderPerk,
    getActiveSeekerPerk,
    setEquippedElemGun,
    setTrialElemGun,
    unlockElemGun,
    consumeTrialElemGun,
    recordAchievementStat,
    getAchievements,
    getAchievementStats: () => ({ ...state.achStats }),
    pickDeterministicElemGunForBot,
    buildHatMesh: buildHatMeshBound,
    attachHatToChar,
    pickRandomCosmeticHatForPeer,
    spawnPoofVfx,
    applyBlasterSkin,
  };
}
