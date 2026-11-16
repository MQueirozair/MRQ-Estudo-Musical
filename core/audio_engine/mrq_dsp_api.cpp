#include "../include/mrq_dsp.h"
#include "../dsp/fft.hpp"

#include <cmath>
#include <cstdlib>
#include <vector>
#include <complex>
#include <algorithm>

extern "C" {

MRQ_API const char* mrq_dsp_version(void) {
    return "1.0.0-cpp17";
}

MRQ_API void mrq_free_buffer(void* ptr) {
    if (ptr) {
        std::free(ptr);
    }
}

/**
 * YIN fundamental frequency estimator (de Cheveigné & Kawahara 2002)
 * using Cumulative Mean Normalized Difference Function (CMNDF) + parabolic interpolation.
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
) {
    if (!mono_in || !out_frames || !out_freqs || !out_confidences) return -1;
    if (num_samples <= 0 || sample_rate <= 0) return -2;

    if (frame_size <= 0) frame_size = 2048;
    if (hop_size <= 0) hop_size = 512;
    if (min_freq <= 20.0f) min_freq = 40.0f;
    if (max_freq <= min_freq) max_freq = 2000.0f;
    if (threshold <= 0.01f || threshold >= 0.9f) threshold = 0.15f;

    const int32_t half_frame = frame_size / 2;
    const int32_t tau_min = std::max<int32_t>(2, static_cast<int32_t>(std::floor(sample_rate / max_freq)));
    const int32_t tau_max = std::min<int32_t>(half_frame - 1, static_cast<int32_t>(std::ceil(sample_rate / min_freq)));
    if (tau_max <= tau_min) return -3;

    const int32_t n_frames = (num_samples >= frame_size)
        ? (1 + (num_samples - frame_size) / hop_size)
        : 1;

    float* freqs = static_cast<float*>(std::malloc(static_cast<size_t>(n_frames) * sizeof(float)));
    float* confs = static_cast<float*>(std::malloc(static_cast<size_t>(n_frames) * sizeof(float)));
    if (!freqs || !confs) {
        std::free(freqs);
        std::free(confs);
        return -4;
    }

    std::vector<double> diff(tau_max + 2, 0.0);
    std::vector<double> cmndf(tau_max + 2, 0.0);
    std::vector<double> frame(frame_size, 0.0);

    for (int32_t f = 0; f < n_frames; ++f) {
        int32_t offset = f * hop_size;
        double rms = 0.0;
        for (int32_t i = 0; i < frame_size; ++i) {
            double s = (offset + i < num_samples) ? static_cast<double>(mono_in[offset + i]) : 0.0;
            frame[i] = s;
            rms += s * s;
        }
        rms = std::sqrt(rms / static_cast<double>(frame_size));
        if (rms < 0.005) {
            freqs[f] = 0.0f;
            confs[f] = 0.0f;
            continue;
        }

        // Step 1: Difference function d(tau)
        diff[0] = 0.0;
        cmndf[0] = 1.0;
        double running_sum = 0.0;

        for (int32_t tau = 1; tau <= tau_max; ++tau) {
            double sum = 0.0;
            for (int32_t j = 0; j < half_frame; ++j) {
                double delta = frame[j] - frame[j + tau];
                sum += delta * delta;
            }
            diff[tau] = sum;
            running_sum += sum;
            cmndf[tau] = (running_sum > 1e-12) ? (sum * static_cast<double>(tau) / running_sum) : 1.0;
        }

        // Step 2: Absolute threshold search for first local minimum below threshold
        int32_t best_tau = -1;
        for (int32_t tau = tau_min; tau <= tau_max; ++tau) {
            if (cmndf[tau] < threshold) {
                while (tau + 1 <= tau_max && cmndf[tau + 1] < cmndf[tau]) {
                    ++tau;
                }
                best_tau = tau;
                break;
            }
        }

        // Fallback: global minimum in [tau_min, tau_max] if above threshold
        if (best_tau == -1) {
            double min_val = 1e9;
            for (int32_t tau = tau_min; tau <= tau_max; ++tau) {
                if (cmndf[tau] < min_val) {
                    min_val = cmndf[tau];
                    best_tau = tau;
                }
            }
        }

        if (best_tau <= 0 || cmndf[best_tau] > 0.55) {
            freqs[f] = 0.0f;
            confs[f] = 0.0f;
            continue;
        }

        // Step 3: Parabolic interpolation around best_tau
        double refined_tau = static_cast<double>(best_tau);
        if (best_tau > 1 && best_tau < tau_max) {
            double s0 = cmndf[best_tau - 1];
            double s1 = cmndf[best_tau];
            double s2 = cmndf[best_tau + 1];
            double denom = 2.0 * (2.0 * s1 - s2 - s0);
            if (std::abs(denom) > 1e-12) {
                refined_tau += (s2 - s0) / denom;
            }
        }

        double f0 = static_cast<double>(sample_rate) / std::max(1.0, refined_tau);
        double conf = std::clamp(1.0 - cmndf[best_tau], 0.0, 1.0);

        if (f0 >= min_freq && f0 <= max_freq) {
            freqs[f] = static_cast<float>(f0);
            confs[f] = static_cast<float>(conf);
        } else {
            freqs[f] = 0.0f;
            confs[f] = 0.0f;
        }
    }

    *out_frames = n_frames;
    *out_freqs = freqs;
    *out_confidences = confs;
    return 0;
}

/**
 * Computes log-compressed spectral SuperFlux onset envelope in C++.
 */
MRQ_API int mrq_compute_onset_envelope_f32(
    const float* mono_in,
    int32_t num_samples,
    int32_t sample_rate,
    int32_t fft_size,
    int32_t hop_size,
    int32_t* out_frames,
    float** out_envelope
) {
    if (!mono_in || !out_frames || !out_envelope) return -1;
    if (num_samples <= 0 || sample_rate <= 0) return -2;

    if (fft_size <= 0) fft_size = 2048;
    fft_size = mrq::is_power_of_two(fft_size) ? fft_size : mrq::next_power_of_two(fft_size);
    if (hop_size <= 0) hop_size = 512;

    const int32_t bins = fft_size / 2 + 1;
    const int32_t n_frames = (num_samples >= fft_size)
        ? (1 + (num_samples - fft_size) / hop_size)
        : 1;

    float* env = static_cast<float*>(std::malloc(static_cast<size_t>(n_frames) * sizeof(float)));
    if (!env) return -3;

    std::vector<double> win;
    mrq::make_hann_window(win, fft_size);
    std::vector<std::complex<double>> buf(fft_size);
    std::vector<double> prev_log_mag(bins, 0.0);
    std::vector<double> cur_log_mag(bins, 0.0);

    const double gamma = 100.0; // Log compression factor

    for (int32_t f = 0; f < n_frames; ++f) {
        int32_t offset = f * hop_size;
        for (int32_t i = 0; i < fft_size; ++i) {
            double s = (offset + i < num_samples) ? static_cast<double>(mono_in[offset + i]) : 0.0;
            buf[i] = std::complex<double>(s * win[i], 0.0);
        }
        mrq::fft_inplace(buf, false);

        for (int32_t k = 0; k < bins; ++k) {
            cur_log_mag[k] = std::log1p(gamma * std::abs(buf[k]));
        }

        double flux = 0.0;
        if (f > 0) {
            // SuperFlux max-filter across +/- 1 frequency bin to suppress vibrato false onsets
            for (int32_t k = 1; k < bins - 1; ++k) {
                double prev_max = std::max({prev_log_mag[k - 1], prev_log_mag[k], prev_log_mag[k + 1]});
                double diff = cur_log_mag[k] - prev_max;
                if (diff > 0.0) flux += diff;
            }
        }
        env[f] = static_cast<float>(flux);
        prev_log_mag = cur_log_mag;
    }

    // Normalize envelope to [0, 1]
    float max_val = 1e-6f;
    for (int32_t f = 0; f < n_frames; ++f) {
        if (env[f] > max_val) max_val = env[f];
    }
    for (int32_t f = 0; f < n_frames; ++f) {
        env[f] /= max_val;
    }

    *out_frames = n_frames;
    *out_envelope = env;
    return 0;
}

} // extern "C"
