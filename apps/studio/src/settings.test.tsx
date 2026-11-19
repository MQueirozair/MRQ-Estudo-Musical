// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { defaultSettings, LOG_KEY, readSettings, recordDiagnostic, saveSettings } from './settings';
import { SettingsModal } from './components/SettingsModal';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('settings and local diagnostics', () => {
  it('validates stored settings and persists choices', () => {
    localStorage.setItem('mrq.settings.v1', '{"waveform":false,"diagnostics":"bad"}');
    expect(readSettings().waveform).toBe(false);
    expect(readSettings().diagnostics).toBe(false);
    saveSettings({ ...defaultSettings, speedPanel: false });
    expect(readSettings().speedPanel).toBe(false);
  });
  it('records only when enabled and caps entries', () => {
    recordDiagnostic('error', 'not recorded');
    expect(localStorage.getItem(LOG_KEY)).toBeNull();
    saveSettings({ ...defaultSettings, diagnostics: true });
    for (let i = 0; i < 110; i++) recordDiagnostic('error', `message ${i}`);
    const entries = JSON.parse(localStorage.getItem(LOG_KEY)!);
    expect(entries).toHaveLength(100);
    expect(entries[0].message).toBe('message 10');
  });
  it('allows changing visibility from settings', () => {
    const onChange = vi.fn();
    render(<SettingsModal settings={defaultSettings} onChange={onChange} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Forma de onda/ }));
    expect(onChange).toHaveBeenCalledWith({ ...defaultSettings, waveform: false });
  });
});
