'use client';

import { useEffect, useState } from 'react';
import type { CharacterView } from '@abb/shared';
import { characterImageUrl, initialsOf } from '../lib/character';

interface Props {
  character: CharacterView;
  size?: 'lg' | 'sm';
  showPower?: boolean;
}

export function CharacterCard({ character, size = 'lg', showPower = false }: Props) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [character.id]);

  const revealed = showPower && character.power !== undefined;
  return (
    <figure className={`char-card ${size}`}>
      <div className="char-art">
        {broken ? (
          <div className="char-fallback" aria-hidden="true">
            {initialsOf(character.name)}
          </div>
        ) : (
          <img
            src={characterImageUrl(character.id)}
            alt={character.name}
            loading={size === 'lg' ? 'eager' : 'lazy'}
            draggable={false}
            onError={() => setBroken(true)}
          />
        )}
      </div>
      <figcaption className="char-plate">
        <span className="char-name">{character.name}</span>
        <span className="char-anime">{character.anime}</span>
        <span className={`power-slot ${revealed ? 'unsealed' : 'sealed'}`}>
          <small>Power</small>
          <b>{revealed ? character.power : '???'}</b>
        </span>
      </figcaption>
    </figure>
  );
}
