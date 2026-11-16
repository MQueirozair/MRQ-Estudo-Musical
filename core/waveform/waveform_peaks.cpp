#include "../include/mrq_dsp.h"

#include <cmath>
#include <algorithm>

extern "C" {

MRQ_API int mrq_compute_waveform_peaks_f32(
    const float* in_interleaved,
    int32_t in_frames,
    int32_t channels,
    int32_t num_bins,
    float* out_min,
    float* out_max,
    float* out_rms
) {
    if (!in_interleaved || !out_min || !out_max || !out_rms) return -1;
    if (in_frames <= 0 || channels <= 0 || num_bins <= 0) return -2;

    const double frames_per_bin = static_cast<double>(in_frames) / static_cast<double>(num_bins);
    const float inv_ch = 1.0f / static_cast<float>(channels);

    for (int32_t b = 0; b < num_bins; ++b) {
        int32_t start = static_cast<int32_t>(std::floor(b * frames_per_bin));
        int32_t end = static_cast<int32_t>(std::floor((b + 1) * frames_per_bin));
        if (end <= start) end = std::min(in_frames, start + 1);
        if (end > in_frames) end = in_frames;

        float mn = 1.0f;
        float mx = -1.0f;
        double sum_sq = 0.0;
        int32_t count = 0;

        for (int32_t i = start; i < end; ++i) {
            float mono = 0.0f;
            const int64_t base = static_cast<int64_t>(i) * channels;
            for (int32_t c = 0; c < channels; ++c) {
                mono += in_interleaved[base + c];
            }
            mono *= inv_ch;
            if (mono < mn) mn = mono;
            if (mono > mx) mx = mono;
            sum_sq += static_cast<double>(mono) * static_cast<double>(mono);
            ++count;
        }

        if (count == 0) {
            out_min[b] = 0.0f;
            out_max[b] = 0.0f;
            out_rms[b] = 0.0f;
        } else {
            out_min[b] = mn;
            out_max[b] = mx;
            out_rms[b] = static_cast<float>(std::sqrt(sum_sq / static_cast<double>(count)));
        }
    }

    return 0;
}

} // extern "C"
