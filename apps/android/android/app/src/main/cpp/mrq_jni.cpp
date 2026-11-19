#include <jni.h>
#include <vector>
#include "mrq_dsp.h"

extern "C" {

JNIEXPORT jstring JNICALL
Java_com_mrq_estudomusical_MrqDspBridge_nativeGetVersion(JNIEnv* env, jclass) {
    return env->NewStringUTF(mrq_dsp_version());
}

JNIEXPORT jfloatArray JNICALL
Java_com_mrq_estudomusical_MrqDspBridge_nativeTimeAndPitch(
    JNIEnv* env,
    jclass,
    jfloatArray inputInterleaved,
    jint channels,
    jint sampleRate,
    jdouble speedRatio,
    jdouble semitones,
    jdouble cents
) {
    jsize len = env->GetArrayLength(inputInterleaved);
    if (len <= 0 || channels <= 0) return nullptr;

    jfloat* inData = env->GetFloatArrayElements(inputInterleaved, nullptr);
    int32_t inFrames = len / channels;
    float* outBuf = nullptr;
    int32_t outFrames = 0;

    int rc = mrq_time_and_pitch_f32(
        inData, inFrames, channels, sampleRate, speedRatio, semitones, cents, &outBuf, &outFrames
    );
    env->ReleaseFloatArrayElements(inputInterleaved, inData, JNI_ABORT);

    if (rc != 0 || !outBuf || outFrames <= 0) {
        if (outBuf) mrq_free_buffer(outBuf);
        return nullptr;
    }

    jsize outLen = outFrames * channels;
    jfloatArray result = env->NewFloatArray(outLen);
    if (result) {
        env->SetFloatArrayRegion(result, 0, outLen, outBuf);
    }
    mrq_free_buffer(outBuf);
    return result;
}

} // extern "C"
