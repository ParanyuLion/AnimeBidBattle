import type { MusicSync } from '@abb/shared';
import { MusicControls } from './MusicControls';
import { SoundControls } from './SoundControls';

interface Props {
  music: MusicSync;
  clockOffset: number;
  /** Lifts the dock above the sticky bid dock on phones. */
  raised?: boolean;
}

/** Music and sound-effect controls pinned to the bottom-right corner. */
export function AudioDock({ music, clockOffset, raised = false }: Props) {
  return (
    <div className={`audio-dock ${raised ? 'raised' : ''}`}>
      <MusicControls sync={music} clockOffset={clockOffset} />
      <SoundControls />
    </div>
  );
}
