cmake_minimum_required(VERSION 3.22.1)
project(mrq_dsp_jni LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CORE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../../../../core")

add_library(mrq_dsp_jni SHARED
    mrq_jni.cpp
    ${CORE_DIR}/time_stretch/phase_vocoder.cpp
    ${CORE_DIR}/pitch_shift/pitch_shifter.cpp
    ${CORE_DIR}/waveform/waveform_peaks.cpp
    ${CORE_DIR}/dsp/spectrogram.cpp
    ${CORE_DIR}/midi/midi_writer.cpp
    ${CORE_DIR}/audio_engine/mrq_dsp_api.cpp
)

target_include_directories(mrq_dsp_jni PRIVATE ${CORE_DIR}/include)
target_compile_definitions(mrq_dsp_jni PRIVATE MRQ_DSP_EXPORTS)
target_link_libraries(mrq_dsp_jni log m)
