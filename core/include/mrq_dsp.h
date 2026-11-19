#ifndef MRQ_DSP_H
#define MRQ_DSP_H

#include <stdint.h>
#include <stddef.h>

#ifdef _WIN32
  #ifdef MRQ_DSP_EXPORTS
    #define MRQ_API __declspec(dllexport)
  #else
    #define MRQ_API __declspec(dllimport)
  #endif
#else
  #define MRQ_API __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef struct MrqMidiNote {
    int32_t pitch;          /* MIDI pitch 0..127 */
    double start_sec;       /* Start time in seconds */
    double duration_sec;    /* Duration in seconds */
    int32_t velocity;       /* 1..127 */
    int32_t channel;        /* 0..15 */
} MrqMidiNote;

/** Returns semantic version string of native DSP core. */
MRQ_API const char* mrq_dsp_version(void);

/** Frees any heap buffer allocated and returned by mrq_* functions. */
MRQ_API void mrq_free_buffer(void* ptr);

/**
 * Real phase-locked Phase Vocoder time stretching without pitch alteration.
 * speed_ratio: 0.25 (quarter speed / 4x duration) to 2.0 (double speed / 0.5x duration).
 * Returns 0 on success, non-zero error code otherwise.
 */
MRQ_API int mrq_time_stretch_f32(
    const float* in_interleaved,
    int32_t in_frames,
    int32_t channels,
    int32_t sample_rate,
    double speed_ratio,
    int32_t fft_size,
    int32_t hop_factor,
    float** out_interleaved,
    int32_t* out_frames
);

/**
 * Independent pitch shifting (preserves duration/tempo).
 * semitones: e.g. -24..+24, cents: -100..+100.
 * Returns 0 on success.
 */
MRQ_API int mrq_pitch_shift_f32(
    const float* in_interleaved,
    int32_t in_frames,
    int32_t channels,
    int32_t sample_rate,
    double semitones,
    double cents,
    float** out_interleaved,
    int32_t* out_frames
);

/**
 * Combined single-pass time stretching + independent pitch shifting.
 * Higher quality and faster than cascading two separate passes.
 */
MRQ_API int mrq_time_and_pitch_f32(
    const float* in_interleaved,
    int32_t in_frames,
    int32_t channels,
    int32_t sample_rate,
    double speed_ratio,
    double semitones,
    double cents,
    float** out_interleaved,
    int32_t* out_frames
);

/**
 * Computes multi-resolution waveform min, max and RMS peaks.
 */
MRQ_API int mrq_compute_waveform_peaks_f32(
    const float* in_interleaved,
    int32_t in_frames,
    int32_t channels,
    int32_t num_bins,
    float* out_min,
    float* out_max,
    float* out_rms
);

/**
 * Computes real STFT magnitude spectrogram in dB.
 * Output matrix has shape [out_frames * out_bins] in row-major order (frame-major).
 * log_freq_bins: if > 0, resamples frequency axis logarithmically into log_freq_bins (e.g. 128 or 256).
 */
MRQ_API int mrq_compute_spectrogram_f32(
    const float* mono_in,
    int32_t num_samples,
    int32_t sample_rate,
    int32_t fft_size,
    int32_t hop_size,
    int32_t log_freq_bins,
    float min_freq,
    float max_freq,
    int32_t* out_frames,
    int32_t* out_bins,
    float** out_db_matrix
);

/**
 * Monophonic fundamental frequency (F0) tracker using YIN (CMNDF + parabolic interpolation).
 */
MRQ_API int mrq_detect_pitch_yin_f32(
    const float* mono_in,
    int32_t num_samples,
    int32_t sample_rate,
    int32_t frame_size,
    int32_t hop_size,
    float min_freq,
    float max_freq,
    float threshold,
    int32_t* out_frames,
    float** out_freqs,
    float** out_confidences
);

/**
 * Computes spectral superflux onset strength envelope for BPM & beat tracking.
 */
MRQ_API int mrq_compute_onset_envelope_f32(
    const float* mono_in,
    int32_t num_samples,
    int32_t sample_rate,
    int32_t fft_size,
    int32_t hop_size,
    int32_t* out_frames,
    float** out_envelope
);

/**
 * Writes a Standard MIDI File (SMF Type 1) with tempo, time signature and notes.
 */
MRQ_API int mrq_write_midi_file(
    const char* filepath,
    double bpm,
    int32_t time_sig_num,
    int32_t time_sig_den,
    const MrqMidiNote* notes,
    int32_t num_notes
);

#ifdef __cplusplus
}
#endif

#endif /* MRQ_DSP_H */
