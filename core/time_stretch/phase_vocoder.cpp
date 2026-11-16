#include "../include/mrq_dsp.h"
#include "../dsp/fft.hpp"

#include <cmath>
#include <cstdlib>
#include <cstring>
#include <vector>
#include <algorithm>
#include <complex>

namespace mrq {

/**
 * Single-channel Identity Phase-Locked Phase Vocoder (Laroche & Dolson 1999)
 * with transient detection (high-frequency content + spectral flux) so drum hits
 * and plucks stay crisp while vocals, piano, bass and full mixes stay phase-coherent.
 *
 * stretch_factor = output_duration / input_duration = 1.0 / speed_ratio.
 */
std::vector<float> phase_vocoder_stretch_channel(
    const std::vector<float>& input,
    double stretch_factor,
    int fft_size,
    int hop_factor
) {
    const int in_len = static_cast<int>(input.size());
    if (in_len <= 0) return {};

    // Fast path when stretch is virtually 1.0
    if (std::abs(stretch_factor - 1.0) < 1e-4) {
        return input;
    }

    fft_size = is_power_of_two(fft_size) ? fft_size : next_power_of_two(fft_size);
    if (fft_size < 512) fft_size = 512;
    if (fft_size > 8192) fft_size = 8192;
    if (hop_factor < 4) hop_factor = 4;

    // Keep both synthesis hop AND analysis hop <= fft_size / 4 for >=75% overlap at all speeds
    int hs = fft_size / hop_factor;
    if (stretch_factor < 1.0) {
        hs = std::max(64, static_cast<int>(std::floor(static_cast<double>(fft_size) * stretch_factor / 4.0)));
    }
    const double ha_f = static_cast<double>(hs) / stretch_factor; // Fractional analysis hop
    const int num_bins = fft_size / 2 + 1;

    const int out_len = std::max(1, static_cast<int>(std::llround(in_len * stretch_factor)));

    // Pad input slightly on both ends to avoid edge attenuation
    const int pad = fft_size / 2;
    std::vector<double> padded(in_len + 2 * pad, 0.0);
    for (int i = 0; i < in_len; ++i) {
        padded[i + pad] = static_cast<double>(input[i]);
    }

    std::vector<double> win;
    make_sqrt_hann_window(win, fft_size);

    std::vector<double> out_acc(out_len + 2 * pad + fft_size, 0.0);
    std::vector<double> win_acc(out_len + 2 * pad + fft_size, 0.0);

    std::vector<std::complex<double>> frame_buf(fft_size);
    std::vector<double> prev_phase(num_bins, 0.0);
    std::vector<double> sum_phase(num_bins, 0.0);
    std::vector<double> prev_mag(num_bins, 0.0);
    std::vector<double> cur_mag(num_bins, 0.0);
    std::vector<double> cur_phase(num_bins, 0.0);
    std::vector<double> synth_phase(num_bins, 0.0);
    std::vector<double> omega(num_bins, 0.0);
    std::vector<int> peaks;
    peaks.reserve(num_bins / 4);

    for (int k = 0; k < num_bins; ++k) {
        omega[k] = kTwoPi * static_cast<double>(k) / static_cast<double>(fft_size);
    }

    double prev_flux = 0.0;
    double avg_flux = 1e-6;
    bool first_frame = true;

    const int max_out_pos = out_len + pad;
    double in_pos_f = 0.0;
    int prev_in_pos = 0;

    for (int out_pos = 0; out_pos < max_out_pos; out_pos += hs) {
        const int in_pos = static_cast<int>(std::llround(in_pos_f));
        const double actual_ha = first_frame ? ha_f : static_cast<double>(std::max(1, in_pos - prev_in_pos));
        prev_in_pos = in_pos;
        const int padded_len = static_cast<int>(padded.size());

        // Windowed analysis frame
        for (int i = 0; i < fft_size; ++i) {
            int idx = in_pos + i;
            double s = (idx >= 0 && idx < padded_len) ? padded[idx] : 0.0;
            frame_buf[i] = std::complex<double>(s * win[i], 0.0);
        }

        fft_inplace(frame_buf, false);

        // Extract magnitude, phase & compute spectral flux for transient detection
        double flux = 0.0;
        double energy = 0.0;
        for (int k = 0; k < num_bins; ++k) {
            double mag = std::abs(frame_buf[k]);
            double ph = std::arg(frame_buf[k]);
            cur_mag[k] = mag;
            cur_phase[k] = ph;
            energy += mag * mag;
            if (!first_frame && k > 4) {
                double diff = mag - prev_mag[k];
                if (diff > 0.0) flux += diff;
            }
        }

        // Adaptive transient detection
        bool is_transient = false;
        if (!first_frame && energy > 1e-7) {
            if (flux > avg_flux * 2.6 && flux > prev_flux * 1.45) {
                is_transient = true;
            }
            avg_flux = 0.85 * avg_flux + 0.15 * flux;
            prev_flux = flux;
        }

        if (first_frame || is_transient) {
            // Reset synthesis phase to original analysis phase on strong transients
            // to preserve sharp attacks (percussion, guitar plucks, piano strikes)
            for (int k = 0; k < num_bins; ++k) {
                synth_phase[k] = cur_phase[k];
                sum_phase[k] = cur_phase[k];
            }
            first_frame = false;
        } else {
            // Find local spectral magnitude peaks for identity phase locking
            peaks.clear();
            for (int k = 2; k < num_bins - 2; ++k) {
                double m = cur_mag[k];
                if (m > cur_mag[k - 1] && m >= cur_mag[k + 1] &&
                    m > cur_mag[k - 2] && m >= cur_mag[k + 2] &&
                    m > 1e-7) {
                    peaks.push_back(k);
                }
            }

            // Advance phase using true instantaneous frequency at all bins first
            for (int k = 0; k < num_bins; ++k) {
                double expected_adv = omega[k] * actual_ha;
                double dphi = wrap_phase(cur_phase[k] - prev_phase[k] - expected_adv);
                double inst_freq = omega[k] + dphi / std::max(1.0, actual_ha);
                sum_phase[k] = wrap_phase(sum_phase[k] + inst_freq * static_cast<double>(hs));
                synth_phase[k] = sum_phase[k];
            }

            // Rigid / identity phase-locking around spectral peaks:
            // locks neighboring bins within each peak's region of influence to prevent phasiness
            if (!peaks.empty()) {
                for (size_t p_idx = 0; p_idx < peaks.size(); ++p_idx) {
                    int pk = peaks[p_idx];
                    int left = (p_idx == 0) ? 1 : (peaks[p_idx - 1] + pk) / 2;
                    int right = (p_idx + 1 == peaks.size()) ? (num_bins - 1) : (pk + peaks[p_idx + 1]) / 2;
                    left = std::max(left, pk - 6);
                    right = std::min(right, pk + 6);

                    double rotation = wrap_phase(sum_phase[pk] - cur_phase[pk]);
                    for (int k = left; k <= right; ++k) {
                        if (k == pk) continue;
                        synth_phase[k] = wrap_phase(cur_phase[k] + rotation);
                    }
                }
                // Keep sum_phase synchronized with locked phases
                for (int k = 0; k < num_bins; ++k) {
                    sum_phase[k] = synth_phase[k];
                }
            }
        }

        // Reconstruct Hermitian-symmetric spectrum
        frame_buf[0] = std::complex<double>(cur_mag[0] * std::cos(synth_phase[0]), 0.0);
        for (int k = 1; k < num_bins - 1; ++k) {
            double re = cur_mag[k] * std::cos(synth_phase[k]);
            double im = cur_mag[k] * std::sin(synth_phase[k]);
            frame_buf[k] = std::complex<double>(re, im);
            frame_buf[fft_size - k] = std::complex<double>(re, -im);
        }
        frame_buf[num_bins - 1] = std::complex<double>(
            cur_mag[num_bins - 1] * std::cos(synth_phase[num_bins - 1]), 0.0
        );

        fft_inplace(frame_buf, true);

        // Overlap-add with synthesis window
        for (int i = 0; i < fft_size; ++i) {
            int o_idx = out_pos + i;
            if (o_idx >= 0 && o_idx < static_cast<int>(out_acc.size())) {
                out_acc[o_idx] += frame_buf[i].real() * win[i];
                win_acc[o_idx] += win[i] * win[i];
            }
        }

        prev_phase = cur_phase;
        prev_mag = cur_mag;
        in_pos_f += ha_f;
    }

    // Normalize by COLA window sum and trim padding
    std::vector<float> output(out_len, 0.0f);
    for (int i = 0; i < out_len; ++i) {
        int idx = i + pad;
        double norm = (idx < static_cast<int>(win_acc.size()) && win_acc[idx] > 1e-6) ? win_acc[idx] : 1.0;
        double val = out_acc[idx] / norm;
        if (val > 1.0) val = 1.0;
        if (val < -1.0) val = -1.0;
        output[i] = static_cast<float>(val);
    }

    return output;
}

} // namespace mrq

extern "C" {

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
) {
    if (!in_interleaved || !out_interleaved || !out_frames) return -1;
    if (in_frames <= 0 || channels <= 0 || sample_rate <= 0) return -2;

    // Clamp speed ratio into supported safe range [0.20, 2.50]
    if (speed_ratio < 0.20) speed_ratio = 0.20;
    if (speed_ratio > 2.50) speed_ratio = 2.50;

    if (fft_size <= 0) {
        // Choose optimal FFT size for sample rate (~46ms window for clean musical resolution)
        fft_size = (sample_rate >= 44100) ? 2048 : 1024;
    }
    if (hop_factor <= 0) hop_factor = 4;

    const double stretch_factor = 1.0 / speed_ratio;

    // De-interleave, stretch each channel independently (preserving stereo width cleanly)
    std::vector<std::vector<float>> stretched_ch(channels);
    int32_t final_frames = 0;

    for (int c = 0; c < channels; ++c) {
        std::vector<float> ch_in(in_frames);
        for (int32_t i = 0; i < in_frames; ++i) {
            ch_in[i] = in_interleaved[i * channels + c];
        }
        stretched_ch[c] = mrq::phase_vocoder_stretch_channel(ch_in, stretch_factor, fft_size, hop_factor);
        if (c == 0) {
            final_frames = static_cast<int32_t>(stretched_ch[c].size());
        } else {
            final_frames = std::min(final_frames, static_cast<int32_t>(stretched_ch[c].size()));
        }
    }

    float* buf = static_cast<float*>(std::malloc(static_cast<size_t>(final_frames) * channels * sizeof(float)));
    if (!buf) return -3;

    for (int32_t i = 0; i < final_frames; ++i) {
        for (int c = 0; c < channels; ++c) {
            buf[i * channels + c] = stretched_ch[c][i];
        }
    }

    *out_interleaved = buf;
    *out_frames = final_frames;
    return 0;
}

} // extern "C"
