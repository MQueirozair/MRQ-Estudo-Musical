CXX ?= g++
CXXFLAGS := -std=c++17 -O3 -Wall -Wextra -fPIC -DMRQ_DSP_EXPORTS -Iinclude
UNAME_S := $(shell uname -s)

ifeq ($(UNAME_S),Darwin)
    LIB_EXT := dylib
    SHARED_FLAGS := -dynamiclib -install_name @rpath/libmrq_dsp.dylib
else
    LIB_EXT := so
    SHARED_FLAGS := -shared
endif

BUILD_DIR := build
TARGET_LIB := $(BUILD_DIR)/libmrq_dsp.$(LIB_EXT)
TEST_BIN := $(BUILD_DIR)/test_dsp_cpp

SOURCES := \
    time_stretch/phase_vocoder.cpp \
    pitch_shift/pitch_shifter.cpp \
    waveform/waveform_peaks.cpp \
    dsp/spectrogram.cpp \
    midi/midi_writer.cpp \
    audio_engine/mrq_dsp_api.cpp

.PHONY: all test clean

all: $(TARGET_LIB)

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

$(TARGET_LIB): $(SOURCES) include/mrq_dsp.h dsp/fft.hpp | $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) $(SHARED_FLAGS) $(SOURCES) -o $(TARGET_LIB) -lm

$(TEST_BIN): tests/test_dsp_cpp.cpp $(TARGET_LIB)
	$(CXX) -std=c++17 -O2 -Wall -Wextra -Iinclude tests/test_dsp_cpp.cpp -L$(BUILD_DIR) -lmrq_dsp -Wl,-rpath,'$$ORIGIN' -o $(TEST_BIN) -lm

test: $(TEST_BIN)
	./$(TEST_BIN)

clean:
	rm -rf $(BUILD_DIR)
