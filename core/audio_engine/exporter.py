"""
Complete Export Subsystem for MRQ Estudo Musical:
- Audio export: MP3, WAV, FLAC (full track, selection, loop A/B, slowed/transposed, individual stem or custom stem mix)
- MIDI export: Standard MIDI File (SMF Type 1) via native C++17 writer
- Notes export: Formatted TXT table
- Chords / Lead sheet export: Formatted TXT cipher sheet with timestamps & sections
- Analysis Report export: Professional PDF document generated via ReportLab
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ai.source_separation.separator import mix_stems
from core.audio_engine.audio_manager import AudioManager
from core.audio_engine.bridge import NativeDSPEngine, get_dsp_engine


def _fmt_time(sec: float) -> str:
    sec = max(0.0, float(sec))
    mins = int(sec // 60)
    rem = sec - mins * 60
    return f"{mins:02d}:{rem:05.2f}"


class ProjectExporter:
    def __init__(self, audio_manager: AudioManager, dsp: Optional[NativeDSPEngine] = None) -> None:
        self.audio_manager = audio_manager
        self.dsp = dsp or get_dsp_engine()

    def export_audio(
        self,
        audio_path: str | Path,
        output_path: str | Path,
        fmt: str = "mp3",
        speed: float = 1.0,
        semitones: float = 0.0,
        cents: float = 0.0,
        start_sec: Optional[float] = None,
        end_sec: Optional[float] = None,
    ) -> Path:
        """Exports processed audio (time-stretched, transposed, trimmed) as MP3, WAV or FLAC."""
        fmt_clean = fmt.lower().lstrip(".")
        if fmt_clean not in ("mp3", "wav", "flac"):
            raise ValueError(f"Formato de exportação de áudio não suportado: {fmt}")

        rendered = self.audio_manager.render_processed_audio(
            file_path=audio_path,
            speed=speed,
            semitones=semitones,
            cents=cents,
            start_sec=start_sec,
            end_sec=end_sec,
            output_format=fmt_clean,
        )
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        if rendered.resolve() != out.resolve():
            import shutil

            shutil.copy2(rendered, out)
        return out

    def export_stems_mix(
        self,
        stem_paths: Dict[str, str | Path],
        gains: Dict[str, float],
        mutes: Dict[str, bool],
        output_path: str | Path,
        fmt: str = "mp3",
    ) -> Path:
        return mix_stems(stem_paths, gains, mutes, output_path, fmt=fmt)

    def export_midi(
        self,
        notes: List[Dict[str, Any]],
        output_path: str | Path,
        bpm: float = 120.0,
        time_signature: str = "4/4",
    ) -> Path:
        parts = (time_signature or "4/4").split("/")
        ts_num = int(parts[0]) if len(parts) == 2 and parts[0].isdigit() else 4
        ts_den = int(parts[1]) if len(parts) == 2 and parts[1].isdigit() else 4
        return self.dsp.write_midi_file(
            output_path,
            notes=notes,
            bpm=float(bpm or 120.0),
            time_sig_num=ts_num,
            time_sig_den=ts_den,
        )

    def export_notes_txt(self, project: Dict[str, Any], output_path: str | Path) -> Path:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        notes = project.get("notes", [])
        lines = [
            "==========================================================================",
            f"MRQ ESTUDO MUSICAL — TRANSCRIÇÃO DE NOTAS",
            "==========================================================================",
            f"Projeto     : {project.get('name', '')}",
            f"Arquivo     : {project.get('original_filename', '')}",
            f"BPM         : {project.get('bpm') or 'N/D'}  |  Compasso: {project.get('time_signature', '4/4')}",
            f"Tonalidade  : {project.get('musical_key') or 'N/D'} ({project.get('scale_name') or 'N/D'})",
            f"Total Notas : {len(notes)}",
            f"Exportado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "--------------------------------------------------------------------------",
            f"{'INÍCIO':>10} | {'FIM':>10} | {'DUR(s)':>7} | {'NOTA':<5} | {'MIDI':>4} | {'VEL':>3} | {'CONF':>5} | {'PAPEL'}",
            "--------------------------------------------------------------------------",
        ]
        for n in notes:
            start = float(n["start_sec"])
            dur = float(n["duration_sec"])
            lines.append(
                f"{_fmt_time(start):>10} | {_fmt_time(start + dur):>10} | {dur:7.3f} | "
                f"{n.get('note_name', ''):<5} | {int(n['pitch']):>4} | {int(n.get('velocity', 90)):>3} | "
                f"{int(round(float(n.get('confidence', 0.8)) * 100)):>4}% | {n.get('role', 'harmony')}"
            )
        out.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return out

    def export_chords_txt(self, project: Dict[str, Any], output_path: str | Path) -> Path:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        chords = project.get("chords", [])
        markers = project.get("markers", [])

        lines = [
            "==========================================================================",
            "MRQ ESTUDO MUSICAL — CIFRA E PROGRESSÃO HARMÔNICA",
            "==========================================================================",
            f"Projeto     : {project.get('name', '')}",
            f"Arquivo     : {project.get('original_filename', '')}",
            f"BPM         : {project.get('bpm') or 'N/D'}  |  Compasso: {project.get('time_signature', '4/4')}",
            f"Tonalidade  : {project.get('musical_key') or 'N/D'}  |  Escala: {project.get('scale_name') or 'N/D'}",
            f"Afinação    : {project.get('semitones', 0):+d} st, {project.get('octaves', 0):+d} oit, {project.get('cents', 0):+d} cents",
            "==========================================================================",
            "",
            "SEQUÊNCIA RESUMIDA:",
            " | ".join(c["symbol"] for c in chords if c.get("symbol") != "N.C.") or "(Nenhum acorde detectado)",
            "",
            "LINHA DO TEMPO DE ACORDES:",
        ]

        marker_idx = 0
        for c in chords:
            t0 = float(c["start_sec"])
            while marker_idx < len(markers) and float(markers[marker_idx]["time_sec"]) <= t0 + 0.05:
                mk = markers[marker_idx]
                lines.append(f"\n[{mk.get('section_type', 'Seção').upper()}: {mk.get('label', '')} — {_fmt_time(mk['time_sec'])}]")
                marker_idx += 1
            conf_pct = int(round(float(c.get("confidence", 0.0)) * 100))
            notes_str = ", ".join(c.get("notes", []))
            lines.append(
                f"  {_fmt_time(t0)} -> {_fmt_time(float(c['end_sec']))}   {c['symbol']:<10} "
                f"(Notas: {notes_str:<16} | Confiança: {conf_pct}%)"
            )

        if project.get("study_notes"):
            lines.extend(["", "OBSERVAÇÕES DE ESTUDO:", project["study_notes"]])

        out.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return out

    def export_analysis_pdf(self, project: Dict[str, Any], output_path: str | Path) -> Path:
        """Generates a real commercial-grade PDF Musical Analysis Report with ReportLab."""
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)

        doc = SimpleDocTemplate(
            str(out),
            pagesize=A4,
            leftMargin=1.8 * cm,
            rightMargin=1.8 * cm,
            topMargin=1.8 * cm,
            bottomMargin=1.8 * cm,
            title=f"MRQ Estudo Musical — {project.get('name', 'Relatório')}",
            author="MRQ Estudo Musical",
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "MRQTitle",
            parent=styles["Heading1"],
            fontSize=18,
            textColor=colors.HexColor("#1E1B4B"),
            spaceAfter=6,
        )
        subtitle_style = ParagraphStyle(
            "MRQSub",
            parent=styles["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#475569"),
            spaceAfter=14,
        )
        h2_style = ParagraphStyle(
            "MRQH2",
            parent=styles["Heading2"],
            fontSize=13,
            textColor=colors.HexColor("#312E81"),
            spaceBefore=12,
            spaceAfter=6,
        )
        body_style = styles["BodyText"]

        story = [
            Paragraph("MRQ ESTUDO MUSICAL — Relatório de Análise Musical", title_style),
            Paragraph(
                f"Projeto: <b>{project.get('name', 'Sem nome')}</b> &nbsp;|&nbsp; "
                f"Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')}",
                subtitle_style,
            ),
        ]

        # Technical & Musical Summary Table
        dur_str = _fmt_time(float(project.get("duration_sec", 0.0)))
        bpm_val = project.get("bpm")
        bpm_conf = project.get("bpm_confidence")
        key_conf = project.get("key_confidence")
        summary_data = [
            ["Propriedade", "Valor", "Propriedade", "Valor"],
            [
                "Arquivo",
                str(project.get("original_filename") or "N/D")[:32],
                "Duração",
                dur_str,
            ],
            [
                "Formato / Codec",
                f"{project.get('format_name', '')} / {project.get('codec_name', '')}",
                "Amostragem",
                f"{project.get('sample_rate', 44100)} Hz ({project.get('channels', 2)} ch)",
            ],
            [
                "BPM Estimado",
                f"{bpm_val} BPM ({int(round((bpm_conf or 0)*100))}%)" if bpm_val else "Não analisado",
                "Compasso",
                str(project.get("time_signature") or "4/4"),
            ],
            [
                "Tonalidade",
                f"{project.get('musical_key') or 'N/D'} ({int(round((key_conf or 0)*100))}%)",
                "Escala",
                str(project.get("scale_name") or "N/D"),
            ],
            [
                "Velocidade Estudo",
                f"{int(round(float(project.get('speed', 1.0)) * 100))}%",
                "Transposição",
                f"{int(project.get('semitones', 0)):+d} st / {int(project.get('octaves', 0)):+d} oit / {int(project.get('cents', 0)):+d}¢",
            ],
        ]
        summary_table = Table(summary_data, colWidths=[3.4 * cm, 5.2 * cm, 3.4 * cm, 5.2 * cm])
        summary_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E1B4B")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
                    ("FONTNAME", (2, 1), (2, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
                    ("PADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.extend([summary_table, Spacer(1, 10)])

        # Chord Progression Section
        chords = project.get("chords", [])
        story.append(Paragraph("1. Reconhecimento Harmônico e Cifras", h2_style))
        if chords:
            prog = " | ".join(c["symbol"] for c in chords if c.get("symbol") != "N.C.")
            story.append(Paragraph(f"<b>Progressão:</b> {prog[:1200]}", body_style))
            story.append(Spacer(1, 6))
            chord_rows = [["Início", "Fim", "Acorde", "Notas", "Confiança"]]
            for c in chords[:60]:
                chord_rows.append(
                    [
                        _fmt_time(c["start_sec"]),
                        _fmt_time(c["end_sec"]),
                        c["symbol"],
                        ", ".join(c.get("notes", [])),
                        f"{int(round(float(c.get('confidence', 0)) * 100))}%",
                    ]
                )
            ct = Table(chord_rows, colWidths=[2.5 * cm, 2.5 * cm, 3.0 * cm, 6.2 * cm, 3.0 * cm])
            ct.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
                    ]
                )
            )
            story.append(ct)
        else:
            story.append(Paragraph("Nenhum acorde analisado ainda.", body_style))

        # Markers & Loops Section
        markers = project.get("markers", [])
        loops = project.get("loops", [])
        story.append(Paragraph("2. Marcadores de Seção e Loops A/B", h2_style))
        if markers:
            mk_rows = [["Tempo", "Seção", "Rótulo", "Observação"]]
            for m in markers:
                mk_rows.append([_fmt_time(m["time_sec"]), m.get("section_type", ""), m.get("label", ""), m.get("note", "")[:50]])
            mt = Table(mk_rows, colWidths=[2.5 * cm, 3.5 * cm, 4.2 * cm, 7.0 * cm])
            mt.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                    ]
                )
            )
            story.append(mt)
            story.append(Spacer(1, 6))
        if loops:
            lp_rows = [["Loop", "Ponto A", "Ponto B", "Velocidade", "Afinação"]]
            for lp in loops:
                lp_rows.append(
                    [
                        lp.get("name", "Loop"),
                        _fmt_time(lp["start_sec"]),
                        _fmt_time(lp["end_sec"]),
                        f"{int(round(float(lp.get('speed', 1.0)) * 100))}%",
                        f"{int(lp.get('semitones', 0)):+d} st / {int(lp.get('cents', 0)):+d}¢",
                    ]
                )
            lt = Table(lp_rows, colWidths=[5.0 * cm, 3.0 * cm, 3.0 * cm, 3.0 * cm, 3.2 * cm])
            lt.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F766E")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                    ]
                )
            )
            story.append(lt)

        # Notes Summary
        notes = project.get("notes", [])
        story.append(Paragraph(f"3. Transcrição de Notas ({len(notes)} eventos)", h2_style))
        if notes:
            n_rows = [["Início", "Nota", "MIDI", "Duração", "Vel.", "Papel", "Confiança"]]
            for n in notes[:80]:
                n_rows.append(
                    [
                        _fmt_time(n["start_sec"]),
                        n.get("note_name", ""),
                        str(n["pitch"]),
                        f"{float(n['duration_sec']):.2f}s",
                        str(n.get("velocity", 90)),
                        n.get("role", ""),
                        f"{int(round(float(n.get('confidence', 0.8)) * 100))}%",
                    ]
                )
            nt = Table(n_rows, colWidths=[2.6 * cm, 2.2 * cm, 1.8 * cm, 2.4 * cm, 1.8 * cm, 3.2 * cm, 3.2 * cm])
            nt.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
                    ]
                )
            )
            story.append(nt)
        else:
            story.append(Paragraph("Nenhuma nota transcrita ainda.", body_style))

        if project.get("study_notes"):
            story.append(Paragraph("4. Anotações do Estudante", h2_style))
            story.append(Paragraph(str(project["study_notes"]).replace("\n", "<br/>"), body_style))

        doc.build(story)
        return out
