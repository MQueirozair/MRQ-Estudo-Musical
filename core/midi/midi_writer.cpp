#include "../include/mrq_dsp.h"

#include <cstdio>
#include <cstdint>
#include <cmath>
#include <vector>
#include <algorithm>
#include <fstream>

namespace {

struct MidiEvent {
    uint64_t tick;
    int priority; // NoteOff before NoteOn at same tick
    std::vector<uint8_t> data;
};

void write_be16(std::vector<uint8_t>& out, uint16_t v) {
    out.push_back(static_cast<uint8_t>((v >> 8) & 0xFF));
    out.push_back(static_cast<uint8_t>(v & 0xFF));
}

void write_be32(std::vector<uint8_t>& out, uint32_t v) {
    out.push_back(static_cast<uint8_t>((v >> 24) & 0xFF));
    out.push_back(static_cast<uint8_t>((v >> 16) & 0xFF));
    out.push_back(static_cast<uint8_t>((v >> 8) & 0xFF));
    out.push_back(static_cast<uint8_t>(v & 0xFF));
}

void write_vlq(std::vector<uint8_t>& out, uint64_t value) {
    uint8_t bytes[10];
    int count = 0;
    bytes[count++] = static_cast<uint8_t>(value & 0x7F);
    value >>= 7;
    while (value > 0) {
        bytes[count++] = static_cast<uint8_t>((value & 0x7F) | 0x80);
        value >>= 7;
    }
    for (int i = count - 1; i >= 0; --i) {
        out.push_back(bytes[i]);
    }
}

void append_track(std::vector<uint8_t>& file_bytes, const std::vector<uint8_t>& track_data) {
    file_bytes.push_back('M');
    file_bytes.push_back('T');
    file_bytes.push_back('r');
    file_bytes.push_back('k');
    write_be32(file_bytes, static_cast<uint32_t>(track_data.size()));
    file_bytes.insert(file_bytes.end(), track_data.begin(), track_data.end());
}

} // namespace

extern "C" {

MRQ_API int mrq_write_midi_file(
    const char* filepath,
    double bpm,
    int32_t time_sig_num,
    int32_t time_sig_den,
    const MrqMidiNote* notes,
    int32_t num_notes
) {
    if (!filepath) return -1;
    if (bpm <= 10.0 || bpm > 400.0) bpm = 120.0;
    if (time_sig_num <= 0) time_sig_num = 4;
    if (time_sig_den <= 0) time_sig_den = 4;

    const uint16_t ticks_per_quarter = 480;
    const double ticks_per_sec = (bpm / 60.0) * static_cast<double>(ticks_per_quarter);

    std::vector<uint8_t> smf;
    // Header chunk MThd (SMF Type 1, 2 tracks: meta + notes)
    smf.push_back('M'); smf.push_back('T'); smf.push_back('h'); smf.push_back('d');
    write_be32(smf, 6);
    write_be16(smf, 1); // Type 1
    write_be16(smf, 2); // 2 tracks
    write_be16(smf, ticks_per_quarter);

    // Track 0: Tempo & Time Signature Meta Track
    std::vector<uint8_t> meta_track;
    // Track Name: "MRQ Estudo Musical"
    const char* name = "MRQ Estudo Musical";
    write_vlq(meta_track, 0);
    meta_track.push_back(0xFF);
    meta_track.push_back(0x03);
    meta_track.push_back(18);
    for (int i = 0; i < 18; ++i) meta_track.push_back(static_cast<uint8_t>(name[i]));

    // Set Tempo meta event (microseconds per quarter note)
    uint32_t us_per_quarter = static_cast<uint32_t>(std::llround(60000000.0 / bpm));
    write_vlq(meta_track, 0);
    meta_track.push_back(0xFF);
    meta_track.push_back(0x51);
    meta_track.push_back(0x03);
    meta_track.push_back(static_cast<uint8_t>((us_per_quarter >> 16) & 0xFF));
    meta_track.push_back(static_cast<uint8_t>((us_per_quarter >> 8) & 0xFF));
    meta_track.push_back(static_cast<uint8_t>(us_per_quarter & 0xFF));

    // Time Signature meta event
    uint8_t den_pow = 2; // 4 -> 2^2
    if (time_sig_den == 2) den_pow = 1;
    else if (time_sig_den == 8) den_pow = 3;
    else if (time_sig_den == 16) den_pow = 4;
    write_vlq(meta_track, 0);
    meta_track.push_back(0xFF);
    meta_track.push_back(0x58);
    meta_track.push_back(0x04);
    meta_track.push_back(static_cast<uint8_t>(time_sig_num));
    meta_track.push_back(den_pow);
    meta_track.push_back(24);
    meta_track.push_back(8);

    // End of Track
    write_vlq(meta_track, 0);
    meta_track.push_back(0xFF);
    meta_track.push_back(0x2F);
    meta_track.push_back(0x00);
    append_track(smf, meta_track);

    // Track 1: Note Events
    std::vector<MidiEvent> events;
    events.reserve(static_cast<size_t>(std::max(0, num_notes)) * 2);

    for (int32_t i = 0; i < num_notes; ++i) {
        const MrqMidiNote& n = notes[i];
        int pitch = std::clamp<int>(n.pitch, 0, 127);
        int vel = std::clamp<int>(n.velocity, 1, 127);
        int ch = std::clamp<int>(n.channel, 0, 15);
        double start = std::max(0.0, n.start_sec);
        double dur = std::max(0.02, n.duration_sec);

        uint64_t t_on = static_cast<uint64_t>(std::llround(start * ticks_per_sec));
        uint64_t t_off = static_cast<uint64_t>(std::llround((start + dur) * ticks_per_sec));
        if (t_off <= t_on) t_off = t_on + 1;

        events.push_back({t_on, 1, {static_cast<uint8_t>(0x90 | ch), static_cast<uint8_t>(pitch), static_cast<uint8_t>(vel)}});
        events.push_back({t_off, 0, {static_cast<uint8_t>(0x80 | ch), static_cast<uint8_t>(pitch), 0}});
    }

    std::stable_sort(events.begin(), events.end(), [](const MidiEvent& a, const MidiEvent& b) {
        if (a.tick != b.tick) return a.tick < b.tick;
        return a.priority < b.priority;
    });

    std::vector<uint8_t> note_track;
    // Program change to Acoustic Grand Piano (0) on channel 0
    write_vlq(note_track, 0);
    note_track.push_back(0xC0);
    note_track.push_back(0x00);

    uint64_t prev_tick = 0;
    for (const auto& ev : events) {
        uint64_t delta = (ev.tick >= prev_tick) ? (ev.tick - prev_tick) : 0;
        write_vlq(note_track, delta);
        note_track.insert(note_track.end(), ev.data.begin(), ev.data.end());
        prev_tick = ev.tick;
    }

    // End of Track
    write_vlq(note_track, 0);
    note_track.push_back(0xFF);
    note_track.push_back(0x2F);
    note_track.push_back(0x00);
    append_track(smf, note_track);

    std::ofstream ofs(filepath, std::ios::binary | std::ios::trunc);
    if (!ofs.is_open()) return -2;
    ofs.write(reinterpret_cast<const char*>(smf.data()), static_cast<std::streamsize>(smf.size()));
    ofs.close();
    return ofs.good() ? 0 : -3;
}

} // extern "C"
