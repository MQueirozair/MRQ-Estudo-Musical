#ifndef MRQ_FFT_HPP
#define MRQ_FFT_HPP

#include <cmath>
#include <complex>
#include <vector>
#include <algorithm>
#include <cstdint>

namespace mrq {

constexpr double kPi = 3.14159265358979323846264338327950288;
constexpr double kTwoPi = 2.0 * kPi;

inline bool is_power_of_two(int n) {
    return n > 0 && (n & (n - 1)) == 0;
}

inline int next_power_of_two(int n) {
    int p = 1;
    while (p < n) p <<= 1;
    return p;
}

inline void make_hann_window(std::vector<double>& win, int size) {
    win.resize(size);
    for (int i = 0; i < size; ++i) {
        win[i] = 0.5 * (1.0 - std::cos(kTwoPi * static_cast<double>(i) / static_cast<double>(size)));
    }
}

inline void make_sqrt_hann_window(std::vector<double>& win, int size) {
    win.resize(size);
    for (int i = 0; i < size; ++i) {
        double h = 0.5 * (1.0 - std::cos(kTwoPi * static_cast<double>(i) / static_cast<double>(size)));
        win[i] = std::sqrt(std::max(0.0, h));
    }
}

/**
 * In-place iterative Radix-2 Cooley-Tukey FFT / IFFT.
 * buf.size() must be a power of two.
 */
inline void fft_inplace(std::vector<std::complex<double>>& buf, bool inverse) {
    const size_t n = buf.size();
    if (n <= 1) return;

    // Bit-reversal permutation
    for (size_t i = 1, j = 0; i < n; ++i) {
        size_t bit = n >> 1;
        for (; j & bit; bit >>= 1) {
            j ^= bit;
        }
        j ^= bit;
        if (i < j) {
            std::swap(buf[i], buf[j]);
        }
    }

    // Butterfly stages
    for (size_t len = 2; len <= n; len <<= 1) {
        double angle = (inverse ? kTwoPi : -kTwoPi) / static_cast<double>(len);
        std::complex<double> wlen(std::cos(angle), std::sin(angle));
        size_t half = len >> 1;
        for (size_t i = 0; i < n; i += len) {
            std::complex<double> w(1.0, 0.0);
            for (size_t j = 0; j < half; ++j) {
                std::complex<double> u = buf[i + j];
                std::complex<double> v = buf[i + j + half] * w;
                buf[i + j] = u + v;
                buf[i + j + half] = u - v;
                w *= wlen;
            }
        }
    }

    if (inverse) {
        const double inv_n = 1.0 / static_cast<double>(n);
        for (auto& x : buf) {
            x *= inv_n;
        }
    }
}

inline double wrap_phase(double phase) {
    double r = std::fmod(phase + kPi, kTwoPi);
    if (r < 0.0) r += kTwoPi;
    return r - kPi;
}

} // namespace mrq

#endif // MRQ_FFT_HPP
