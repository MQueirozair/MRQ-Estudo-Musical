// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VideoZoomStage } from './VideoZoomStage';

afterEach(cleanup);

describe('VideoZoomStage', () => {
  it('cancels modified wheel events and accumulates rapid zoom steps', () => {
    const { getByTestId } = render(<VideoZoomStage><div data-testid="video" /></VideoZoomStage>);
    const target = getByTestId('video');
    const first = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100 });
    const second = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100 });
    act(() => { target.dispatchEvent(first); target.dispatchEvent(second); });
    expect(first.defaultPrevented).toBe(true);
    expect(second.defaultPrevented).toBe(true);
    expect(screen.getByTitle(/Zoom Horizontal do Vídeo —/).textContent).toContain('132%');
    expect(screen.getByTitle(/Zoom Vertical do Vídeo —/).textContent).toContain('100%');
  });

  it('aligns both axes when locking aspect ratio and resets correctly', () => {
    render(<VideoZoomStage><div data-testid="video" /></VideoZoomStage>);
    fireEvent.click(screen.getByTitle('Aumentar Zoom Horizontal do Vídeo'));
    fireEvent.click(screen.getByTitle('H e V independentes (clique para travar proporção H=V)'));
    expect(screen.getByTitle(/Zoom Vertical do Vídeo —/).textContent).toContain('120%');
    fireEvent.click(screen.getByTitle('Resetar Zoom e Enquadramento do Vídeo para 100%'));
    expect(screen.getByTitle(/Zoom Horizontal do Vídeo —/).textContent).toContain('100%');
    expect(screen.getByTitle(/Zoom Vertical do Vídeo —/).textContent).toContain('100%');
  });

  it('provides a selectable shield for a cross-origin iframe and restores access', () => {
    render(<VideoZoomStage isIframe><iframe title="Player" /></VideoZoomStage>);
    expect(screen.queryByTitle(/Ctrl\+Scroll: Zoom Horizontal/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom V' }));
    expect(screen.getByTitle(/Ctrl\+Scroll: Zoom Horizontal/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    expect(screen.queryByTitle(/Ctrl\+Scroll: Zoom Horizontal/)).toBeNull();
  });
});
