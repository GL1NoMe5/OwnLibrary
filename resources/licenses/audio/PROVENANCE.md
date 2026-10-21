# Audio assets

All third-party recordings and instrument samples listed here are CC0 1.0:
https://creativecommons.org/publicdomain/zero/1.0/
The legal text is in CC0-1.0.txt. Sources verified on 2026-10-22.

## Fireplace

- Fireplace — tripjazz, Freesound.
- Source: https://freesound.org/people/tripjazz/sounds/394754/
- Download: https://cdn.freesound.org/previews/394/394754_7473420-hq.mp3
- Bundled: src/renderer/src/assets/audio/fireplace.mp3 (public HQ preview).

## Gentle rain

- Gentle Rain.wav — shelbyshark, Freesound.
- Source: https://freesound.org/people/shelbyshark/sounds/501243/
- Download: https://cdn.freesound.org/previews/501/501243_8644110-hq.mp3
- Bundled: src/renderer/src/assets/audio/rain-soft.mp3 (public HQ preview).
- The author describes gentle rain with very distant thunder. Runtime low-pass
  filtering at 1.4 kHz and a lower playback level soften the outdoor recording.
- Replaces Ylmir's previous rain recording, which is no longer bundled.

Both field recordings are trimmed by 80 ms at each end, joined with a 1.5-second
circular crossfade and balanced during playback. The packaged app needs no network.

## Jingle Bells — radio arrangement

- Composition: James Lord Pierpont, 1857; public-domain melody.
- This project's instrumental arrangement: 72 BPM, 16 bars, 53 1/3 seconds.
- Bundled: src/renderer/src/assets/audio/jingle-bells-radio.wav.
- Reproducible score and render: artwork/audio/render_radio.py.
- Sampled upright piano: Simon Dalzell / Ivy Audio, distributed by
  Versilian Studios / Sam Gossner as VSCO 2 Community Edition, CC0 1.0.
- Bank: https://versilian-studios.com/vsco-community/
- Source: https://github.com/sgossner/VSCO-2-CE/tree/master/Keys/Upright%20Piano
- Samples: Player_dyn1_rr1_008, 012, 016, 020, 022, 024, 026 and 028 (.wav).
- Original sample information: VSCO-UPRIGHT-INFO.txt.
- Piano resampling, soft original percussion, jazz chord voicings, circular
  reverb, saturation and EQ are rendered by the project script. Note and reverb
  tails wrap across the final bar, retaining the exact musical loop length.
- The arrangement and rendered recording were created for this project; no
  third-party commercial recording was used. No general project license has been chosen.

These assets retain their own licensing independently of the application code.
