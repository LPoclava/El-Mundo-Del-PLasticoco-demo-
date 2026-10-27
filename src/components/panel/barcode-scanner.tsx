"use client";

import { useEffect, useRef, useState } from "react";
import { acceptReading, createDecoder, type Decoder } from "@/lib/barcode/reader";
import { Icon } from "./icons";
import { Button } from "./ui";

/**
 * Lector de códigos de barras con la cámara del dispositivo (getUserMedia).
 * El video se procesa en el navegador: no se graba ni se envía a ningún servidor.
 * Requiere HTTPS (o localhost): ver docs/demo-escaner-celular.md.
 */

// Marco de lectura, como fracción de la vista previa. Solo se analiza lo que queda dentro.
const FRAME_W = 0.86;
const FRAME_H = 0.4;
const SCAN_INTERVAL_MS = 140;
const HINT_AFTER_MS = 12_000;
const REPEAT_COOLDOWN_MS = 2_000;

type Facing = "environment" | "user";
type Status = "starting" | "scanning" | "paused" | "error";
type CameraError = { title: string; message: string; canRetry: boolean };

function describeError(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      title: "Sin permiso para usar la cámara",
      message: "Habilitá la cámara para este sitio desde el candado de la barra de direcciones (Permisos → Cámara) y tocá «Reintentar».",
      canRetry: true,
    };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return { title: "No hay cámara disponible", message: "Este dispositivo no tiene una cámara que se pueda usar. Podés ingresar el código a mano.", canRetry: false };
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return { title: "No se pudo acceder a la cámara", message: "Otra aplicación la está usando. Cerrala y tocá «Reintentar».", canRetry: true };
  }
  return { title: "No se pudo iniciar la cámara", message: "Ocurrió un error inesperado al abrirla. Probá de nuevo o ingresá el código a mano.", canRetry: true };
}

async function openStream(facing: Facing): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
}

/** Copia al canvas solo la zona del marco, equivalente a lo que se ve (object-cover). */
function cropFrame(video: HTMLVideoElement, box: HTMLElement, canvas: HTMLCanvasElement): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = box.clientWidth;
  const ch = box.clientHeight;
  if (!vw || !vh || !cw || !ch) return false;
  const scale = Math.max(cw / vw, ch / vh);
  const offsetX = (vw * scale - cw) / 2;
  const offsetY = (vh * scale - ch) / 2;
  const frameW = cw * FRAME_W;
  const frameH = ch * FRAME_H;
  const sx = ((cw - frameW) / 2 + offsetX) / scale;
  const sy = ((ch - frameH) / 2 + offsetY) / scale;
  const sw = frameW / scale;
  const sh = frameH / scale;
  const shrink = Math.min(1, 960 / sw);
  canvas.width = Math.max(1, Math.round(sw * shrink));
  canvas.height = Math.max(1, Math.round(sh * shrink));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return true;
}

export function BarcodeScanner({ onDetect, onClose, onManual }: {
  onDetect: (code: string) => void;
  onClose: () => void;
  onManual: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const decoderRef = useRef<Decoder | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const scanningRef = useRef(false);
  const tickRef = useRef<() => void>(() => {});
  const lastRef = useRef<{ code: string; at: number } | null>(null);
  const onDetectRef = useRef(onDetect);

  const [status, setStatus] = useState<Status>("starting");
  const [error, setError] = useState<CameraError | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [attempt, setAttempt] = useState(0);
  const [cameraCount, setCameraCount] = useState(0);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    onDetectRef.current = onDetect;
  });

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    const box = boxRef.current;
    if (!video || !box) return;

    function stopStream() {
      window.clearTimeout(timerRef.current);
      scanningRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (video) video.srcObject = null;
    }

    function beep() {
      const ctx = audioRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 1100;
      gain.gain.value = 0.12;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }

    async function tick() {
      if (cancelled || !scanningRef.current || !video || !box) return;
      const decoder = decoderRef.current;
      if (decoder && video.readyState >= 2) {
        const canvas = (canvasRef.current ??= document.createElement("canvas"));
        if (cropFrame(video, box, canvas)) {
          const reading = await decoder.decode(canvas);
          if (cancelled || !scanningRef.current) return;
          if (reading) {
            const accepted = acceptReading(reading);
            if (!accepted.ok) {
              setWarning(accepted.reason);
            } else {
              const last = lastRef.current;
              const repeated = last && last.code === accepted.code && Date.now() - last.at < REPEAT_COOLDOWN_MS;
              if (!repeated) {
                // Una sola lectura: se pausa el video y el análisis hasta que se pida reanudar.
                scanningRef.current = false;
                lastRef.current = { code: accepted.code, at: Date.now() };
                video.pause();
                beep();
                navigator.vibrate?.(80);
                setWarning(null);
                setFound(accepted.code);
                setStatus("paused");
                onDetectRef.current(accepted.code);
                return;
              }
            }
          }
        }
      }
      timerRef.current = window.setTimeout(tick, SCAN_INTERVAL_MS);
    }
    tickRef.current = tick;

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError({
          title: "La cámara necesita una conexión segura (HTTPS)",
          message: `Estás en «${window.location.origin}». Los navegadores solo dejan usar la cámara con https:// o en localhost. Abrí la demo con una dirección https o seguí docs/demo-escaner-celular.md.`,
          canRetry: false,
        });
        setStatus("error");
        return;
      }
      try {
        const stream = await openStream(facing);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video!.srcObject = stream;
        await video!.play();
        const track = stream.getVideoTracks()[0];
        const capabilities = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorchAvailable(Boolean(capabilities.torch));
        setTorchOn(false);
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameraCount(devices.filter((d) => d.kind === "videoinput").length);
        decoderRef.current ??= await createDecoder();
        if (cancelled) return;
        scanningRef.current = true;
        setStatus("scanning");
        tick();
      } catch (e) {
        if (cancelled) return;
        stopStream();
        setError(describeError(e));
        setStatus("error");
      }
    }
    start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facing, attempt]);

  // Aviso si pasa un rato sin leer nada.
  useEffect(() => {
    if (status !== "scanning") return;
    const id = window.setTimeout(() => setHint(true), HINT_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [status, attempt, facing]);

  useEffect(() => {
    return () => {
      void audioRef.current?.close();
      audioRef.current = null;
    };
  }, []);

  function unlockAudio() {
    try {
      audioRef.current ??= new AudioContext();
      void audioRef.current.resume();
    } catch {
      // Sin audio: queda el aviso visual y la vibración.
    }
  }

  function resume() {
    unlockAudio();
    const video = videoRef.current;
    if (!video) return;
    // La pausa de repetición empieza al reanudar: si el mismo código sigue a la vista no se vuelve a leer en el acto.
    if (lastRef.current) lastRef.current.at = Date.now();
    setFound(null);
    setWarning(null);
    setHint(false);
    void video.play();
    scanningRef.current = true;
    setStatus("scanning");
    tickRef.current();
  }

  function restart(nextFacing?: Facing) {
    unlockAudio();
    setError(null);
    setFound(null);
    setWarning(null);
    setHint(false);
    setStatus("starting");
    if (nextFacing) setFacing(nextFacing);
    else setAttempt((n) => n + 1);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((v) => !v);
    } catch {
      setTorchAvailable(false);
    }
  }

  const statusText =
    status === "starting" ? "Iniciando cámara…"
    : status === "paused" ? `Código leído: ${found}`
    : warning ?? "Apuntá al código y mantenelo dentro del marco";

  return (
    <div className="space-y-3" aria-label="Lector de códigos de barras">
      {status === "error" && error ? (
        <div role="alert" className="rounded-2xl border border-brand-line bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-danger/10 text-brand-danger"><Icon name="alert" /></span>
            <div>
              <p className="font-semibold">{error.title}</p>
              <p className="mt-1 text-sm text-brand-muted">{error.message}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
            {error.canRetry && <Button variant="primary" className="h-12 sm:h-11" onClick={() => restart()}>Reintentar</Button>}
            <Button className="h-12 sm:h-11" onClick={onManual}>Ingresar el código a mano</Button>
            <Button variant="ghost" className="h-12 sm:h-11" onClick={onClose}>Cerrar cámara</Button>
          </div>
        </div>
      ) : (
        <>
          <div ref={boxRef} className="relative h-[min(68dvh,32rem)] w-full overflow-hidden rounded-2xl bg-black md:h-[26rem]">
            <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 size-full object-cover" aria-label="Vista previa de la cámara" />
            <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
              <div
                className={`relative rounded-xl border-[3px] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] transition-colors ${found ? "border-[#5fd37a]" : "border-white"}`}
                style={{ width: `${FRAME_W * 100}%`, height: `${FRAME_H * 100}%` }}
              >
                {status === "scanning" && (
                  <span className="absolute inset-x-3 h-0.5 rounded bg-brand-orange motion-safe:animate-[scan-line_2.2s_ease-in-out_infinite] motion-reduce:top-1/2" />
                )}
                {found && (
                  <span className="absolute inset-0 grid place-items-center text-[#5fd37a]"><Icon name="check" className="size-14" /></span>
                )}
              </div>
            </div>
            <p role="status" className={`absolute inset-x-3 top-3 rounded-lg px-3 py-2 text-center text-sm font-medium text-white ${found ? "bg-brand-green" : warning ? "bg-brand-danger/90" : "bg-black/65"}`}>
              {statusText}
            </p>
          </div>

          {hint && status === "scanning" && (
            <p className="rounded-lg bg-brand-sand px-3 py-2 text-sm text-brand-muted" role="note">
              ¿Cuesta leerlo? Acercá o alejá el teléfono, mejorá la luz{torchAvailable ? " o activá la linterna" : ""}. También podés ingresar el código a mano.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {status === "paused" && (
              <Button variant="primary" icon="refresh" className="col-span-2 h-14 text-base sm:h-11 sm:text-sm" onClick={resume}>Escanear otro código</Button>
            )}
            {cameraCount > 1 && (
              <Button className="h-12 sm:h-11" disabled={status === "starting"} onClick={() => restart(facing === "environment" ? "user" : "environment")}>
                {facing === "environment" ? "Cámara frontal" : "Cámara trasera"}
              </Button>
            )}
            {torchAvailable && status === "scanning" && (
              <Button className="h-12 sm:h-11" aria-pressed={torchOn} onClick={toggleTorch}>{torchOn ? "Apagar linterna" : "Linterna"}</Button>
            )}
            <Button variant="ghost" icon="x" className="h-12 border border-brand-line sm:h-11" onClick={onClose}>Cerrar cámara</Button>
          </div>
        </>
      )}
    </div>
  );
}
