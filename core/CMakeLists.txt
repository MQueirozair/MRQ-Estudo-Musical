cmake_minimum_required(VERSION 3.16)
project(mrq_dsp VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Link MSVC C/C++ runtime statically on Windows so mrq_dsp.dll has zero external VC++ Redist dependencies
if(MSVC)
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded")
    if(POLICY CMP0091)
        cmake_policy(SET CMP0091 NEW)
    endif()
endif()

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
    target_compile_options(mrq_dsp PRIVATE /O2 /W3 /MT)
else()
    target_compile_options(mrq_dsp PRIVATE -O3 -Wall -Wextra -fPIC)
endif()

if(NOT ANDROID)
    enable_testing()
    add_executable(test_dsp_cpp tests/test_dsp_cpp.cpp)
    target_link_libraries(test_dsp_cpp PRIVATE mrq_dsp)
    if(MSVC)
        target_compile_options(test_dsp_cpp PRIVATE /MT)
    endif()
    add_test(NAME mrq_dsp_cpp_unit COMMAND test_dsp_cpp)
endif()
