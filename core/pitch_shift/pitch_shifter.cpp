#include "../include/mrq_dsp.h"

#include <cmath>
#include <cstdlib>
#include <vector>
#include <algorithm>

namespace mrq {

// Defined in phase_vocoder.cpp
std::vector<float> phase_vocoder_stretch_channel(
    const std::vector<float>& input,
    double stretch_factor,
    int fft_size,
    int hop_factor
);

/**
 * High-precision Catmull-Rom cubic Hermite resampler (4-point, 3rd-order).
 * Resamples `in` of size N into `out_len` samples spanning the exact input duration.
 */
static std::vector<float> resample_cubic(const std::vector<float>& in, int out_len) {
    const int in_len = static_cast<int>(in.size());
    if (in_len <= 0 || out_len <= 0) return {};
    if (in_len == out_len) return in;

    std::vector<float> out(out_len, 0.0f);
    const double ratio = static_cast<double>(in_len - 1) / static_cast<double>(std::max(1, out_len - 1));

    auto sample_at = [&](int idx) -> double {
        if (idx < 0) return static_cast<double>(in[0]);
        if (idx >= in_len) return static_cast<double>(in[in_len - 1]);
        return static_cast<double>(in[idx]);
    };

    for (int i = 0; i < out_len; ++i) {
        double pos = i * ratio;
        int idx = static_cast<int>(std::floor(pos));
        double t = pos - static_cast<double>(idx);

        double y0 = sample_at(idx - 1);
        double y1 = sample_at(idx);
        double y2 = sample_at(idx + 1);
        double y3 = sample_at(idx + 2);

        // Catmull-Rom spline coefficients
        double c0 = y1;
        double c1 = 0.5 * (y2 - y0);
        double c2 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
        double c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);

        double val = ((c3 * t + c2) * t + c1) * t + c0;
        if (val > 1.0) val = 1.0;
        if (val < -1.0) val = -1.0;
        out[i] = static_cast<float>(val);
    }

    return out;
}

} // namespace mrq

extern "C" {

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
) {
    if (!in_interleaved || !out_interleaved || !out_frames) return -1;
    if (in_frames <= 0 || channels <= 0 || sample_rate <= 0) return -2;

    if (speed_ratio < 0.20) speed_ratio = 0.20;
    if (speed_ratio > 2.50) speed_ratio = 2.50;

    const double total_semitones = semitones + cents / 100.0;
    const double pitch_factor = std::pow(2.0, total_semitones / 12.0);
    const int32_t target_out_frames = std::max<int32_t>(
        1, static_cast<int32_t>(std::llround(static_cast<double>(in_frames) / speed_ratio))
    );

    // Identity fast-path (no speed or pitch change)
    if (std::abs(speed_ratio - 1.0) < 1e-4 && std::abs(total_semitones) < 1e-4) {
        size_t total_samples = static_cast<size_t>(in_frames) * channels;
        float* buf = static_cast<float*>(std::malloc(total_samples * sizeof(float)));
        if (!buf) return -3;
        std::copy(in_interleaved, in_interleaved + total_samples, buf);
        *out_interleaved = buf;
        *out_frames = in_frames;
        return 0;
    }

    const int fft_size = (sample_rate >= 44100) ? 2048 : 1024;
    const int hop_factor = 4;

    // Mathematical key to independent time + pitch in ONE phase vocoder pass:
    //   1. Time-stretch by `pv_stretch = pitch_factor / speed_ratio`
    //      -> Output has duration (in_frames * pitch_factor / speed_ratio), original pitch.
    //   2. Resample back to `target_out_frames = in_frames / speed_ratio`
    //      -> Resampling ratio is `pitch_factor`, which shifts all frequencies by `pitch_factor`
    //         while yielding EXACTLY `target_out_frames`!
    const double pv_stretch = pitch_factor / speed_ratio;

    std::vector<std::vector<float>> processed_ch(channels);
    for (int c = 0; c < channels; ++c) {
        std::vector<float> ch_in(in_frames);
        for (int32_t i = 0; i < in_frames; ++i) {
            ch_in[i] = in_interleaved[i * channels + c];
        }
        std::vector<float> stretched = mrq::phase_vocoder_stretch_channel(ch_in, pv_stretch, fft_size, hop_factor);
        if (std::abs(total_semitones) > 1e-4) {
            processed_ch[c] = mrq::resample_cubic(stretched, target_out_frames);
        } else {
            processed_ch[c] = std::move(stretched);
        }
    }

    int32_t final_frames = static_cast<int32_t>(processed_ch[0].size());
    for (int c = 1; c < channels; ++c) {
        final_frames = std::min(final_frames, static_cast<int32_t>(processed_ch[c].size()));
    }

    float* buf = static_cast<float*>(std::malloc(static_cast<size_t>(final_frames) * channels * sizeof(float)));
    if (!buf) return -3;

    for (int32_t i = 0; i < final_frames; ++i) {
        for (int c = 0; c < channels; ++c) {
            buf[i * channels + c] = processed_ch[c][i];
        }
    }

    *out_interleaved = buf;
    *out_frames = final_frames;
    return 0;
}

MRQ_API int mrq_pitch_shift_f32(
    const float* in_interleaved,
    int32_t in_frames,
    int32_t channels,
    int32_t sample_rate,
    double semitones,
    double cents,
    float** out_interleaved,
    int32_t* out_frames
) {
    return mrq_time_and_pitch_f32(
        in_interleaved,
        in_frames,
        channels,
        sample_rate,
        1.0,
        semitones,
        cents,
        out_interleaved,
        out_frames
    );
}

} // extern "C"
