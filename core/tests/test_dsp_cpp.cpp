#include "../include/mrq_dsp.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <vector>
#include <algorithm>
#include <cassert>

static constexpr double kPi = 3.14159265358979323846;

static float measure_dominant_freq_yin(const float* samples, int32_t n, int32_t sr) {
    int32_t frames = 0;
    float* freqs = nullptr;
    float* confs = nullptr;
    int rc = mrq_detect_pitch_yin_f32(samples, n, sr, 2048, 512, 80.0f, 1600.0f, 0.15f, &frames, &freqs, &confs);
    assert(rc == 0 && frames > 0);

    // Take median of high-confidence middle frames
    std::vector<float> valid;
    for (int32_t i = frames / 4; i < (3 * frames) / 4; ++i) {
        if (freqs[i] > 0.0f && confs[i] > 0.7f) {
            valid.push_back(freqs[i]);
        }
    }
    mrq_free_buffer(freqs);
    mrq_free_buffer(confs);
    assert(!valid.empty());
    std::nth_element(valid.begin(), valid.begin() + valid.size() / 2, valid.end());
    return valid[valid.size() / 2];
}

int main() {
    std::printf("=== MRQ Native C++17 DSP Verification Suite ===\n");
    std::printf("Version: %s\n", mrq_dsp_version());

    const int32_t sr = 44100;
    const int32_t duration_frames = sr * 2; // 2 seconds
    const double test_freq = 440.0; // A4

    std::vector<float> sine_mono(duration_frames);
    std::vector<float> sine_stereo(duration_frames * 2);
    for (int32_t i = 0; i < duration_frames; ++i) {
        float s = static_cast<float>(0.6 * std::sin(2.0 * kPi * test_freq * i / sr));
        sine_mono[i] = s;
        sine_stereo[2 * i] = s;
        sine_stereo[2 * i + 1] = s;
    }

    // 1. Test YIN pitch detector on pure 440Hz
    float f_orig = measure_dominant_freq_yin(sine_mono.data(), duration_frames, sr);
    std::printf("[1] YIN F0 original (expected 440.0 Hz): %.2f Hz\n", f_orig);
    assert(std::fabs(f_orig - 440.0f) < 1.5f);

    // 2. Test Time Stretching 50% (0.5x speed -> 2x length, SAME pitch 440Hz!)
    float* stretched_50 = nullptr;
    int32_t stretched_50_frames = 0;
    int rc = mrq_time_stretch_f32(sine_mono.data(), duration_frames, 1, sr, 0.5, 2048, 4, &stretched_50, &stretched_50_frames);
    assert(rc == 0);
    assert(std::abs(stretched_50_frames - duration_frames * 2) < 10);
    float f_50 = measure_dominant_freq_yin(stretched_50, stretched_50_frames, sr);
    std::printf("[2] Time Stretch 50%%: frames=%d (expected %d), pitch=%.2f Hz (expected 440.0 Hz)\n",
                stretched_50_frames, duration_frames * 2, f_50);
    assert(std::fabs(f_50 - 440.0f) < 3.0f);
    mrq_free_buffer(stretched_50);

    // 3. Test Time Stretching 150% (1.5x speed -> 0.667x length, SAME pitch 440Hz!)
    float* stretched_150 = nullptr;
    int32_t stretched_150_frames = 0;
    rc = mrq_time_stretch_f32(sine_mono.data(), duration_frames, 1, sr, 1.5, 2048, 4, &stretched_150, &stretched_150_frames);
    assert(rc == 0);
    float f_150 = measure_dominant_freq_yin(stretched_150, stretched_150_frames, sr);
    std::printf("[3] Time Stretch 150%%: frames=%d, pitch=%.2f Hz (expected 440.0 Hz)\n",
                stretched_150_frames, f_150);
    assert(std::fabs(f_150 - 440.0f) < 4.0f);
    mrq_free_buffer(stretched_150);

    // 4. Test Independent Pitch Shift (+12 semitones -> 880Hz, SAME length!)
    float* pitched_up = nullptr;
    int32_t pitched_up_frames = 0;
    rc = mrq_pitch_shift_f32(sine_mono.data(), duration_frames, 1, sr, 12.0, 0.0, &pitched_up, &pitched_up_frames);
    assert(rc == 0);
    assert(pitched_up_frames == duration_frames);
    float f_up = measure_dominant_freq_yin(pitched_up, pitched_up_frames, sr);
    std::printf("[4] Pitch Shift +12 st: frames=%d (expected %d), pitch=%.2f Hz (expected 880.0 Hz)\n",
                pitched_up_frames, duration_frames, f_up);
    assert(std::fabs(f_up - 880.0f) < 6.0f);
    mrq_free_buffer(pitched_up);

    // 5. Test Combined Time Stretch (75%) + Pitch Shift (-5 semitones + 50 cents -> 339.28 Hz)
    float* combined = nullptr;
    int32_t combined_frames = 0;
    rc = mrq_time_and_pitch_f32(sine_mono.data(), duration_frames, 1, sr, 0.75, -5.0, 50.0, &combined, &combined_frames);
    assert(rc == 0);
    float expected_f = static_cast<float>(440.0 * std::pow(2.0, -4.5 / 12.0));
    float f_comb = measure_dominant_freq_yin(combined, combined_frames, sr);
    std::printf("[5] Combined 75%% + (-5st, +50c): frames=%d, pitch=%.2f Hz (expected %.2f Hz)\n",
                combined_frames, f_comb, expected_f);
    assert(std::fabs(f_comb - expected_f) < 5.0f);
    mrq_free_buffer(combined);

    // 6. Test Waveform Peaks (Stereo)
    std::vector<float> mn(100), mx(100), rms(100);
    rc = mrq_compute_waveform_peaks_f32(sine_stereo.data(), duration_frames, 2, 100, mn.data(), mx.data(), rms.data());
    assert(rc == 0);
    std::printf("[6] Waveform Peaks bin[50]: min=%.3f, max=%.3f, rms=%.3f\n", mn[50], mx[50], rms[50]);
    assert(mx[50] > 0.58f && mn[50] < -0.58f && rms[50] > 0.40f && rms[50] < 0.45f);

    // 7. Test Spectrogram (Log-scale)
    int32_t spec_frames = 0, spec_bins = 0;
    float* spec_db = nullptr;
    rc = mrq_compute_spectrogram_f32(sine_mono.data(), duration_frames, sr, 2048, 512, 128, 27.5f, 8000.0f, &spec_frames, &spec_bins, &spec_db);
    assert(rc == 0 && spec_frames > 100 && spec_bins == 128);
    std::printf("[7] Log Spectrogram: %d frames x %d bins\n", spec_frames, spec_bins);
    mrq_free_buffer(spec_db);

    // 8. Test Onset Envelope
    int32_t onset_frames = 0;
    float* onset_env = nullptr;
    rc = mrq_compute_onset_envelope_f32(sine_mono.data(), duration_frames, sr, 2048, 512, &onset_frames, &onset_env);
    assert(rc == 0 && onset_frames > 100);
    std::printf("[8] Onset Envelope: %d frames\n", onset_frames);
    mrq_free_buffer(onset_env);

    // 9. Test Standard MIDI File Writer
    MrqMidiNote test_notes[3] = {
        {69, 0.0, 0.5, 100, 0},
        {72, 0.5, 0.5, 95, 0},
        {76, 1.0, 1.0, 110, 0}
    };
    const char* tmp_mid = "/tmp/mrq_cpp_test.mid";
    rc = mrq_write_midi_file(tmp_mid, 120.0, 4, 4, test_notes, 3);
    assert(rc == 0);
    std::ifstream ifs(tmp_mid, std::ios::binary);
    char hdr[4] = {0};
    ifs.read(hdr, 4);
    assert(std::memcmp(hdr, "MThd", 4) == 0);
    std::printf("[9] MIDI Writer: wrote valid SMF Type 1 file (%s)\n", tmp_mid);

    std::printf("=== ALL C++17 DSP TESTS PASSED ===\n");
    return 0;
}
