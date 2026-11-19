import React, { useEffect, useRef, useState } from 'react';

/** A local reference take. Playback is deliberately manual, not presented as latency-corrected. */
export function PracticeRecording() {
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [extension, setExtension] = useState('webm');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const alive = useRef(true);
  const recordedUrl = useRef<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      requestId.current++;
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (recordedUrl.current) URL.revokeObjectURL(recordedUrl.current);
    };
  }, []);

  const start = async () => {
    if (pending || recording) return;
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Gravação indisponível neste navegador ou contexto. Use o aplicativo desktop ou HTTPS.');
      return;
    }
    setPending(true);
    const id = ++requestId.current;
    let input: MediaStream | null = null;
    try {
      input = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (!alive.current || id !== requestId.current) { input.getTracks().forEach(t => t.stop()); return; }
      stream.current = input;
      const r = new MediaRecorder(input);
      const chunks: Blob[] = [];
      recorder.current = r;
      r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      r.onerror = () => { if (alive.current) setError('A gravação falhou. Verifique o microfone.'); };
      r.onstop = () => {
        input?.getTracks().forEach(t => t.stop());
        if (stream.current === input) stream.current = null;
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = null;
        if (!alive.current) return;
        setRecording(false);
        if (!chunks.length) { setError('Nenhum áudio foi gravado.'); return; }
        const mime = r.mimeType || chunks[0].type || 'audio/webm';
        const blob = new Blob(chunks, { type: mime });
        setExtension(mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');
        if (recordedUrl.current) URL.revokeObjectURL(recordedUrl.current);
        recordedUrl.current = URL.createObjectURL(blob);
        setUrl(recordedUrl.current);
      };
      r.start();
      setRecording(true);
      timer.current = window.setTimeout(() => { if (r.state !== 'inactive') r.stop(); }, 5 * 60 * 1000);
    } catch (e) {
      input?.getTracks().forEach(t => t.stop());
      stream.current = null;
      if (alive.current) setError(e instanceof Error ? e.message : 'Não foi possível iniciar o microfone.');
    } finally {
      if (alive.current) setPending(false);
    }
  };

  return <section aria-label="Gravação para comparação" className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap gap-3 items-center">
    <div><h3 className="text-sm font-bold text-white">Grave sua execução</h3><p className="text-xs text-slate-400">Use fones para evitar captar a música no microfone. Limite: 5 minutos.</p></div>
    <button type="button" disabled={pending} onClick={() => recording ? recorder.current?.stop() : void start()} className="rounded-lg px-3 py-2 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold disabled:opacity-50">{pending ? 'Aguardando microfone...' : recording ? 'Parar gravação' : 'Gravar microfone'}</button>
    {url && <><audio controls src={url} aria-label="Ouvir gravação" className="h-9 max-w-full" /><a href={url} download={`mrq-pratica.${extension}`} className="text-sky-300 text-xs underline">Baixar gravação</a></>}
    <p className="w-full text-xs text-slate-400">Compare ouvindo a gravação e a referência manualmente; não há alinhamento automático nem compensação de latência. Baixe antes de fechar a página.</p>
    {error && <p role="alert" className="w-full text-xs text-rose-300">{error}</p>}
  </section>;
}
