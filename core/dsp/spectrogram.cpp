#include "../include/mrq_dsp.h"
#include "../dsp/fft.hpp"

#include <cmath>
#include <cstdlib>
#include <vector>
#include <complex>
#include <algorithm>

extern "C" {

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
) {
    if (!mono_in || !out_frames || !out_bins || !out_db_matrix) return -1;
    if (num_samples <= 0 || sample_rate <= 0) return -2;

    if (fft_size <= 0) fft_size = 2048;
    fft_size = mrq::is_power_of_two(fft_size) ? fft_size : mrq::next_power_of_two(fft_size);
    if (hop_size <= 0) hop_size = fft_size / 4;

    const int32_t linear_bins = fft_size / 2 + 1;
    const int32_t n_frames = (num_samples >= fft_size)
        ? (1 + (num_samples - fft_size) / hop_size)
        : 1;

    const bool use_log = (log_freq_bins > 0);
    const int32_t final_bins = use_log ? log_freq_bins : linear_bins;

    const double nyquist = static_cast<double>(sample_rate) * 0.5;
    double f_min = (min_freq > 10.0f) ? static_cast<double>(min_freq) : 27.5;
    double f_max = (max_freq > f_min && max_freq <= nyquist) ? static_cast<double>(max_freq) : nyquist;

    // Precompute log-frequency bin mapping if requested
    std::vector<double> log_bin_indices;
    if (use_log) {
        log_bin_indices.resize(final_bins);
        double log_min = std::log(f_min);
        double log_max = std::log(f_max);
        for (int32_t b = 0; b < final_bins; ++b) {
            double frac = static_cast<double>(b) / static_cast<double>(std::max(1, final_bins - 1));
            double freq = std::exp(log_min + frac * (log_max - log_min));
            double lin_idx = freq * static_cast<double>(fft_size) / static_cast<double>(sample_rate);
            log_bin_indices[b] = std::clamp(lin_idx, 0.0, static_cast<double>(linear_bins - 1));
        }
    }

    std::vector<double> win;
    mrq::make_hann_window(win, fft_size);
    double win_sum = 0.0;
    for (double w : win) win_sum += w;
    const double scale = 2.0 / std::max(1.0, win_sum);

    float* matrix = static_cast<float*>(
        std::malloc(static_cast<size_t>(n_frames) * final_bins * sizeof(float))
    );
    if (!matrix) return -3;

    std::vector<std::complex<double>> buf(fft_size);
    std::vector<double> mag(linear_bins);

    for (int32_t f = 0; f < n_frames; ++f) {
        int32_t offset = f * hop_size;
        for (int32_t i = 0; i < fft_size; ++i) {
            int32_t idx = offset + i;
            double s = (idx < num_samples) ? static_cast<double>(mono_in[idx]) : 0.0;
            buf[i] = std::complex<double>(s * win[i], 0.0);
        }
        mrq::fft_inplace(buf, false);

        for (int32_t k = 0; k < linear_bins; ++k) {
            mag[k] = std::abs(buf[k]) * scale;
        }

        float* row = matrix + static_cast<size_t>(f) * final_bins;
        if (!use_log) {
            for (int32_t k = 0; k < linear_bins; ++k) {
                double db = 20.0 * std::log10(mag[k] + 1e-6);
                row[k] = static_cast<float>(std::clamp(db, -120.0, 0.0));
            }
        } else {
            for (int32_t b = 0; b < final_bins; ++b) {
                double pos = log_bin_indices[b];
                int32_t i0 = static_cast<int32_t>(std::floor(pos));
                int32_t i1 = std::min(linear_bins - 1, i0 + 1);
                double frac = pos - static_cast<double>(i0);
                double m = mag[i0] * (1.0 - frac) + mag[i1] * frac;
                double db = 20.0 * std::log10(m + 1e-6);
                row[b] = static_cast<float>(std::clamp(db, -120.0, 0.0));
            }
        }
    }

    *out_frames = n_frames;
    *out_bins = final_bins;
    *out_db_matrix = matrix;
    return 0;
}

} // extern "C"
