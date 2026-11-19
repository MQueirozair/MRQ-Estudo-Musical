"""Export an editable, approximate score from timestamped notes, without external libraries.

Times are interpreted at the project's *constant* BPM (120 when absent).  A
separate MusicXML voice is used for each overlapping note, preserving polyphony;
notes crossing a barline are split and tied. This is not rhythmic transcription.
"""
from __future__ import annotations

import math
import re
from pathlib import Path
from xml.etree import ElementTree as ET

DIVISIONS = 480  # divisions per quarter note
PITCHES = (("C", 0), ("C", 1), ("D", 0), ("D", 1), ("E", 0), ("F", 0),
           ("F", 1), ("G", 0), ("G", 1), ("A", 0), ("A", 1), ("B", 0))


def export_musicxml(project: dict, output_path: str | Path) -> Path:
    try:
        bpm = float(project.get('bpm') or 120)
    except (TypeError, ValueError):
        bpm = 120
    if not math.isfinite(bpm) or not 20 <= bpm <= 400:
        bpm = 120
    match = re.fullmatch(r'(\d{1,2})/(1|2|4|8|16)', str(project.get('time_signature') or '4/4'))
    numerator, denominator = (int(match[1]), int(match[2])) if match and 1 <= int(match[1]) <= 32 else (4, 4)
    measure_ticks = numerator * DIVISIONS * 4 // denominator
    notes = []
    for item in project.get('notes', []):
        try:
            pitch = int(item['pitch'])
            start, duration = float(item['start_sec']), float(item['duration_sec'])
            if not 0 <= pitch <= 127 or not math.isfinite(start) or not math.isfinite(duration) or start < 0 or duration <= 0:
                continue
            start_tick = round(start * bpm / 60 * DIVISIONS)
            end_tick = max(start_tick + 1, round((start + duration) * bpm / 60 * DIVISIONS))
            notes.append((start_tick, end_tick, pitch))
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
    if len(notes) > 20000:
        raise ValueError('Muitas notas para exportar MusicXML (limite: 20000).')
    notes.sort()
    measure_count = max(1, math.ceil(max((n[1] for n in notes), default=1) / measure_ticks))
    if measure_count > 10000:
        raise ValueError('Duração muito longa para exportar MusicXML (limite: 10000 compassos).')

    # Assign non-overlapping voices, retaining simultaneous or overlapping notes.
    voices: list[list[tuple[int, int, int]]] = []
    ends: list[int] = []
    for note in notes:
        voice = next((i for i, end in enumerate(ends) if end <= note[0]), None)
        if voice is None:
            if len(voices) >= 128:
                raise ValueError('Polifonia muito grande para exportar MusicXML (limite: 128 vozes).')
            voice = len(voices)
            voices.append([])
            ends.append(0)
        voices[voice].append(note)
        ends[voice] = note[1]
    if not voices:
        voices = [[]]
    if measure_count * len(voices) > 200000:
        raise ValueError('Partitura complexa demais para exportação MusicXML.')

    root = ET.Element('score-partwise', version='4.0')
    work = ET.SubElement(root, 'work')
    ET.SubElement(work, 'work-title').text = str(project.get('name') or 'MRQ Estudo Musical')
    parts = ET.SubElement(root, 'part-list')
    score_part = ET.SubElement(parts, 'score-part', id='P1')
    ET.SubElement(score_part, 'part-name').text = 'Transcrição'
    part = ET.SubElement(root, 'part', id='P1')
    indices = [0] * len(voices)

    def rest(parent: ET.Element, ticks: int, voice: int) -> None:
        n = ET.SubElement(parent, 'note')
        ET.SubElement(n, 'rest')
        ET.SubElement(n, 'duration').text = str(ticks)
        ET.SubElement(n, 'voice').text = str(voice)

    for m in range(measure_count):
        measure = ET.SubElement(part, 'measure', number=str(m + 1))
        begin, end = m * measure_ticks, (m + 1) * measure_ticks
        if m == 0:
            attrs = ET.SubElement(measure, 'attributes')
            ET.SubElement(attrs, 'divisions').text = str(DIVISIONS)
            time = ET.SubElement(attrs, 'time')
            ET.SubElement(time, 'beats').text = str(numerator)
            ET.SubElement(time, 'beat-type').text = str(denominator)
            clef = ET.SubElement(attrs, 'clef')
            ET.SubElement(clef, 'sign').text = 'G'
            ET.SubElement(clef, 'line').text = '2'
            direction = ET.SubElement(measure, 'direction', placement='above')
            dtype = ET.SubElement(direction, 'direction-type')
            metronome = ET.SubElement(dtype, 'metronome')
            ET.SubElement(metronome, 'beat-unit').text = 'quarter'
            ET.SubElement(metronome, 'per-minute').text = str(bpm)
            ET.SubElement(direction, 'sound', tempo=str(bpm))
        for vi, sequence in enumerate(voices):
            if vi:
                backup = ET.SubElement(measure, 'backup')
                ET.SubElement(backup, 'duration').text = str(measure_ticks)
            cursor = begin
            idx = indices[vi]
            while idx < len(sequence) and sequence[idx][0] < end:
                start, stop, pitch = sequence[idx]
                if stop <= begin:
                    idx += 1
                    continue
                seg_start, seg_end = max(begin, start), min(end, stop)
                if seg_start > cursor:
                    rest(measure, seg_start - cursor, vi + 1)
                n = ET.SubElement(measure, 'note')
                p = ET.SubElement(n, 'pitch')
                step, alter = PITCHES[pitch % 12]
                ET.SubElement(p, 'step').text = step
                if alter:
                    ET.SubElement(p, 'alter').text = str(alter)
                ET.SubElement(p, 'octave').text = str(pitch // 12 - 1)
                ET.SubElement(n, 'duration').text = str(seg_end - seg_start)
                if start < begin:
                    ET.SubElement(n, 'tie', type='stop')
                if stop > end:
                    ET.SubElement(n, 'tie', type='start')
                ET.SubElement(n, 'voice').text = str(vi + 1)
                if start < begin or stop > end:
                    notations = ET.SubElement(n, 'notations')
                    if start < begin:
                        ET.SubElement(notations, 'tied', type='stop')
                    if stop > end:
                        ET.SubElement(notations, 'tied', type='start')
                cursor = seg_end
                if stop <= end:
                    idx += 1
                else:
                    break
            indices[vi] = idx
            if cursor < end:
                rest(measure, end - cursor, vi + 1)
    path = Path(output_path)
    ET.ElementTree(root).write(path, encoding='utf-8', xml_declaration=True)
    return path
