cmake_minimum_required(VERSION 3.16)
project(mrq_dsp VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(MRQ_DSP_SOURCES
    time_stretch/phase_vocoder.cpp
    pitch_shift/pitch_shifter.cpp
    waveform/waveform_peaks.cpp
    dsp/spectrogram.cpp
    midi/midi_writer.cpp
    audio_engine/mrq_dsp_api.cpp
)

add_library(mrq_dsp SHARED ${MRQ_DSP_SOURCES})
target_include_directories(mrq_dsp PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_compile_definitions(mrq_dsp PRIVATE MRQ_DSP_EXPORTS)

if(MSVC)
    target_compile_options(mrq_dsp PRIVATE /O2 /W3)
else()
    target_compile_options(mrq_dsp PRIVATE -O3 -Wall -Wextra -fPIC)
endif()

if(NOT ANDROID)
    enable_testing()
    add_executable(test_dsp_cpp tests/test_dsp_cpp.cpp)
    target_link_libraries(test_dsp_cpp PRIVATE mrq_dsp)
    add_test(NAME mrq_dsp_cpp_unit COMMAND test_dsp_cpp)
endif()
