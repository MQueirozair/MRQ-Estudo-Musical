.PHONY: setup build-dsp build-ui build-all test run clean

PYTHON ?= .venv/bin/python

setup:
	bash scripts/setup.sh

build-dsp:
	$(MAKE) -C core all

test-dsp:
	$(MAKE) -C core test

build-ui:
	npm --prefix apps/studio run build

build-all: build-dsp build-ui

test: test-dsp
	$(PYTHON) -m pytest -v tests/

run: build-all
	$(PYTHON) -m backend.main

clean:
	$(MAKE) -C core clean
	rm -rf apps/studio/dist data/temp_cache
