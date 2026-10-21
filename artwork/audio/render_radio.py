"""Render the project's 16-bar, 72 BPM Jingle Bells radio arrangement.
Requires Python + NumPy (included with Steam Blender). Downloads eight CC0
upright-piano samples from VSCO 2 CE into the ignored .local/audio-sources cache.
The result is a periodic PCM loop; reverb and note tails wrap across bar 16.
"""
from pathlib import Path
from urllib.request import urlretrieve
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.local/audio-sources'
RATE, BPM = 32000, 72
BEAT = 60 / BPM
LENGTH = round(64 * BEAT * RATE)
RNG = np.random.default_rng(22102026)
ROOTS = {8: 37, 12: 45, 16: 53, 20: 61, 22: 65, 24: 69, 26: 73, 28: 77}
BASE = 'https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Keys/Upright%20Piano/'
CACHE.mkdir(parents=True, exist_ok=True)


def read_sample(index):
    name = f'Player_dyn1_rr1_{index:03}.wav'
    path = CACHE / name
    if not path.exists():
        urlretrieve(BASE + name, path)
    with wave.open(str(path), 'rb') as wav:
        channels, width, rate = wav.getnchannels(), wav.getsampwidth(), wav.getframerate()
        raw = wav.readframes(wav.getnframes())
    if width == 3:
        data = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        data = data[:, 0] | data[:, 1] << 8 | data[:, 2] << 16
        data = ((data ^ 0x800000) - 0x800000) / 8388608
    else:
        data = np.frombuffer(raw, dtype='<i2') / 32768
    data = data.reshape(-1, channels).mean(axis=1)
    # Remove only initial recording silence, retaining the acoustic hammer attack.
    indices = np.flatnonzero(np.abs(data) > 0.001)
    if len(indices):
        data = data[max(0, indices[0] - round(rate * 0.004)):]
    return data, rate


SAMPLES = {ROOTS[index]: read_sample(index) for index in ROOTS}
track = np.zeros(LENGTH, dtype=np.float64)


def add(signal, beat, gain=1):
    start = round(beat * BEAT * RATE)
    np.add.at(track, (np.arange(len(signal)) + start) % LENGTH, signal * gain)


def piano(note, beat, duration, gain):
    root = min(SAMPLES, key=lambda root: abs(root - note))
    sample, rate = SAMPLES[root]
    ratio = rate / RATE * 2 ** ((note - root) / 12)
    positions = np.arange(min(int((duration * BEAT + 1.1) * RATE), int(len(sample) / ratio))) * ratio
    signal = np.interp(positions, np.arange(len(sample)), sample)
    time = np.arange(len(signal)) / RATE
    signal *= np.exp(-time / (2.2 if note < 55 else 1.5))
    signal *= np.clip((duration * BEAT + 0.55 - time) / 0.55, 0, 1)
    signal[:100] *= np.linspace(0, 1, min(100, len(signal)))
    signal[-400:] *= np.linspace(1, 0, min(400, len(signal)))
    add(signal, beat + RNG.uniform(-0.008, 0.008), gain * RNG.uniform(0.94, 1.03))


# Public-domain chorus; every line occupies two 4/4 bars.
phrases = [
    [(64, 1), (64, 1), (64, 2), (64, 1), (64, 1), (64, 2)],
    [(64, 1), (67, 1), (60, 1.5), (62, .5), (64, 4)],
    [(65, 1), (65, 1), (65, 1.5), (65, .5), (65, 1), (64, 1), (64, 1), (64, .5), (64, .5)],
    [(64, 1), (62, 1), (62, 1), (64, 1), (62, 2), (67, 2)],
    [(64, 1), (64, 1), (64, 2), (64, 1), (64, 1), (64, 2)],
    [(64, 1), (67, 1), (60, 1.5), (62, .5), (64, 4)],
    [(65, 1), (65, 1), (65, 1), (65, 1), (65, 1), (64, 1), (64, 1), (64, 1)],
    [(67, 1), (67, 1), (65, 1), (62, 1), (60, 3), (None, 1)],
]
for phrase_index, phrase in enumerate(phrases):
    beat = phrase_index * 8
    for note, duration in phrase:
        if note is not None:
            piano(note + 12, beat, duration * .85, .48)
        beat += duration

# Warm Cmaj7 / Am7 / Fmaj7 / Dm7 / G6 voicings, with a sparse swung backbeat.
chords = [
    (36, [55, 59, 64, 67]), (45, [55, 60, 64, 67]),
    (36, [55, 59, 64, 67]), (36, [55, 60, 64, 67]),
    (41, [53, 57, 60, 64]), (41, [53, 57, 60, 64]),
    (38, [53, 57, 60, 64]), (43, [53, 59, 62, 67]),
    (36, [55, 59, 64, 67]), (45, [55, 60, 64, 67]),
    (36, [55, 59, 64, 67]), (36, [55, 60, 64, 67]),
    (41, [53, 57, 60, 64]), (41, [53, 57, 60, 64]),
    (43, [53, 59, 62, 67]), (36, [55, 59, 62, 64]),
]
for bar, (bass, notes) in enumerate(chords):
    piano(bass, bar * 4, 2.5, .5)
    piano(bass + 7, bar * 4 + 2.6, 1.1, .22)
    for onset in [0.05, 2.62]:
        for i, note in enumerate(notes):
            piano(note, bar * 4 + onset + i * .018, 1.45, .19)
    for onset in [0, 2.05]:
        time = np.arange(int(.24 * RATE)) / RATE
        kick = np.sin(2 * np.pi * (49 * time + 3.8 * (1 - np.exp(-time * 27))))
        add(kick * np.exp(-time * 25) * np.minimum(time * 500, 1), bar * 4 + onset, .075)
    for onset in [1.04, 3.04]:
        time = np.arange(int(.13 * RATE)) / RATE
        brush = RNG.normal(0, 1, len(time)) * np.exp(-time * 48) * np.minimum(time * 900, 1)
        add(brush, bar * 4 + onset, .012)
    for onset in np.arange(.64, 4, 1):
        time = np.arange(int(.045 * RATE)) / RATE
        add(RNG.normal(0, 1, len(time)) * np.exp(-time * 100) * np.minimum(time * 1200, 1), bar * 4 + onset, .005)

# A circular frequency-domain EQ / reverb keeps the tail and the first beat seamless.
frequency = np.fft.rfftfreq(LENGTH, 1 / RATE)
spectrum = np.fft.rfft(track)
lowpass = 1 / np.sqrt(1 + (frequency / 2600) ** 8)
highpass = 1 - np.exp(-(frequency / 75) ** 2)
track = np.fft.irfft(spectrum * lowpass * highpass, n=LENGTH)
for delay, gain in [(0.087, .11), (.163, .075), (.251, .05), (.379, .025)]:
    track += np.roll(track, round(delay * RATE)) * gain
track = np.tanh(track * 1.1)
track *= min(.16 / np.sqrt(np.mean(track ** 2)), .68 / np.max(np.abs(track)))
output = ROOT / 'src/renderer/src/assets/audio/jingle-bells-radio.wav'
with wave.open(str(output), 'wb') as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes((np.clip(track, -1, 1) * 32767).astype('<i2').tobytes())
print(f'{output.name}: {LENGTH / RATE:.3f}s, 16 bars, {BPM} BPM, RMS {np.sqrt(np.mean(track ** 2)):.4f}, peak {np.max(np.abs(track)):.4f}')
