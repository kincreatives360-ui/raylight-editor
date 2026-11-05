// Curated sound catalog facade; category data lives in ./curatedSounds.
import type { CuratedSound } from './curatedSoundTypes';
import { ambienceSounds } from './curatedSounds/ambience';
import { clickSounds } from './curatedSounds/click';
import { glitchSounds } from './curatedSounds/glitch';
import { impactSounds } from './curatedSounds/impact';
import { popSounds } from './curatedSounds/pop';
import { riserSounds } from './curatedSounds/riser';
import { slideSounds } from './curatedSounds/slide';
import { typingSounds } from './curatedSounds/typing';
import { uiSounds } from './curatedSounds/ui';
import { whooshSounds } from './curatedSounds/whoosh';

export type { CuratedSound } from './curatedSoundTypes';

export const CURATED_SOUNDS: CuratedSound[] = [
  ...ambienceSounds,
  ...clickSounds,
  ...glitchSounds,
  ...impactSounds,
  ...popSounds,
  ...riserSounds,
  ...slideSounds,
  ...typingSounds,
  ...uiSounds,
  ...whooshSounds,
];
