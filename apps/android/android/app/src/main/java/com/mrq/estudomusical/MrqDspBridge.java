package com.mrq.estudomusical;

/**
 * JNI Bridge exposing the shared C++17 MRQ DSP Core (Phase Vocoder, Pitch Shift, FFT, YIN)
 * natively on Android arm64-v8a & armeabi-v7a devices.
 */
public final class MrqDspBridge {
    static {
        System.loadLibrary("mrq_dsp_jni");
    }

    public static native String nativeGetVersion();

    public static native float[] nativeTimeAndPitch(
        float[] inputInterleaved,
        int channels,
        int sampleRate,
        double speedRatio,
        double semitones,
        double cents
    );
}
