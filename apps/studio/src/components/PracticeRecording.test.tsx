// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PracticeRecording } from './PracticeRecording';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('reports microphone permission errors', async () => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(new Error('Permissão negada')) } });
  vi.stubGlobal('MediaRecorder', class {});
  render(<PracticeRecording />);
  fireEvent.click(screen.getByRole('button', { name: 'Gravar microfone' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Permissão negada');
});

it('records locally and stops microphone tracks', async () => {
  const stopTrack = vi.fn();
  const input = { getTracks: () => [{ stop: stopTrack }] };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(input) } });
  class Recorder {
    state = 'inactive'; mimeType = 'audio/webm';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['audio']) }); this.onstop?.(); }
  }
  vi.stubGlobal('MediaRecorder', Recorder);
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:test') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
  render(<PracticeRecording />);
  fireEvent.click(screen.getByRole('button', { name: 'Gravar microfone' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Parar gravação' }));
  await waitFor(() => expect(screen.getByRole('link', { name: 'Baixar gravação' }).getAttribute('href')).toBe('blob:test'));
  expect(stopTrack).toHaveBeenCalled();
});
