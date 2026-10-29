"use client";

import { useEffect, useRef, useState } from "react";
import {
  CameraSetupError, describeCameraError, readCameraPermission, requestCamera, stopStream,
  type CameraError, type Facing,
} from "@/lib/barcode/camera";
import { acceptReading, createDecoder, type Decoder } from "@/lib/barcode/reader";
import { Icon } from "./icons";
import { Button } from "./ui";

/**
 * Lector de códigos de barras con la cámara del dispositivo.
 * - La cámara NO se enciende al cargar la página: solo cuando el usuario pulsa «Escanear código
 *   de barras» (getUserMedia se llama dentro de ese clic) o «Reintentar» / cambiar de cámara.
 * - El video se procesa en el navegador: no se graba ni se envía a ningún servidor.
 * - Al cerrar el lector se detienen todas las pistas del MediaStream.
 * Requiere HTTPS (o localhost): ver docs/demo-escaner-celular.md.
 */

// Marco de lectura, como fracción de la vista previa. Solo se analiza lo que queda dentro.
const FRAME_W = 0.86;
const FRAME_H = 0.4;
const SCAN_INTERVAL_MS = 140;
const HINT_AFTER_MS = 12_000;
const REPEAT_COOLDOWN_MS = 2_000;

type Status = "idle" | "requesting" | "scanning" | "paused" | "error";

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

export function BarcodeScanner({ onDetect, onManual, continuous = false, startLabel = "Escanear código de barras" }: {
  onDetect: (code: string) => void;
  onManual: () => void;
  /**
   * Modo venta: tras cada lectura la cámara sigue abierta y leyendo (no se pausa). El mismo código
   * no se vuelve a leer hasta pasados 2 s, para no sumar dos veces el mismo artículo sin querer.
   */
  continuous?: boolean;
  startLabel?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const decoderRef = useRef<Decoder | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const scanningRef = useRef(false);
  // Cada apertura, reintento, cambio de cámara o cierre abre una sesión nueva: lo que llegue tarde de una anterior se descarta.
  const sessionRef = useRef(0);
  const lastRef = useRef<{ code: string; at: number } | null>(null);
  const onDetectRef = useRef(onDetect);
  const continuousRef = useRef(continuous);
  const flashRef = useRef<number | undefined>(undefined);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<CameraError | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [cameraCount, setCameraCount] = useState(0);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    onDetectRef.current = onDetect;
    continuousRef.current = continuous;
  });

  // Al salir de la pantalla: se libera la cámara y el audio.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      sessionRef.current += 1;
      window.clearTimeout(timerRef.current);
      window.clearTimeout(flashRef.current);
      scanningRef.current = false;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (video) video.srcObject = null;
      void audioRef.current?.close();
      audioRef.current = null;
    };
  }, []);

  // Aviso si pasa un rato sin leer nada.
  useEffect(() => {
    if (status !== "scanning") return;
    const id = window.setTimeout(() => setHint(true), HINT_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [status]);

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

  function unlockAudio() {
    try {
      audioRef.current ??= new AudioContext();
      void audioRef.current.resume();
    } catch {
      // Sin audio: queda el aviso visual y la vibración.
    }
  }

  /** Detiene el análisis y libera la cámara (todas las pistas del MediaStream). */
  function releaseCamera() {
    sessionRef.current += 1;
    window.clearTimeout(timerRef.current);
    scanningRef.current = false;
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function fail(session: number, cause: unknown) {
    if (sessionRef.current !== session) return;
    const denied = cause instanceof DOMException && cause.name === "NotAllowedError";
    const permission = denied ? await readCameraPermission() : null;
    if (sessionRef.current !== session) return;
    releaseCamera();
    setError(describeCameraError(cause, window.location.origin, permission));
    setStatus("error");
  }

  async function tick(session: number) {
    if (sessionRef.current !== session || !scanningRef.current) return;
    const video = videoRef.current;
    const box = boxRef.current;
    const decoder = decoderRef.current;
    if (video && box && decoder && video.readyState >= 2) {
      const canvas = (canvasRef.current ??= document.createElement("canvas"));
      if (cropFrame(video, box, canvas)) {
        const reading = await decoder.decode(canvas);
        if (sessionRef.current !== session || !scanningRef.current) return;
        if (reading) {
          const accepted = acceptReading(reading);
          if (!accepted.ok) {
            setWarning(accepted.reason);
          } else {
            const last = lastRef.current;
            const repeated = last && last.code === accepted.code && Date.now() - last.at < REPEAT_COOLDOWN_MS;
            if (!repeated && continuousRef.current) {
              // Modo venta: la lectura se informa y la cámara sigue abierta para el próximo artículo.
              lastRef.current = { code: accepted.code, at: Date.now() };
              beep();
              navigator.vibrate?.(80);
              setWarning(null);
              setFound(accepted.code);
              window.clearTimeout(flashRef.current);
              flashRef.current = window.setTimeout(() => setFound(null), 1400);
              onDetectRef.current(accepted.code);
            } else if (!repeated) {
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
            } else if (continuousRef.current && last) {
              // El mismo código sigue a la vista: se renueva la espera para no sumarlo otra vez mientras se lo sostiene.
              last.at = Date.now();
            }
          }
        }
      }
    }
    timerRef.current = window.setTimeout(() => void tick(session), SCAN_INTERVAL_MS);
  }

  /**
   * Abre la cámara y empieza a leer. Se llama SOLO desde un clic/toque del usuario, y
   * requestCamera() (getUserMedia) se invoca sin ningún await antes: es respuesta directa a esa acción.
   */
  async function start(nextFacing: Facing) {
    unlockAudio();
    releaseCamera();
    const session = sessionRef.current;
    setError(null);
    setFound(null);
    setWarning(null);
    setHint(false);
    setTorchOn(false);
    setFacing(nextFacing);
    setStatus("requesting");

    let stream: MediaStream;
    try {
      stream = await requestCamera(nextFacing);
    } catch (cause) {
      return fail(session, cause);
    }
    if (sessionRef.current !== session) {
      stopStream(stream); // se cerró o reintentó mientras Chrome preguntaba
      return;
    }
    streamRef.current = stream;
    const track = stream.getVideoTracks()[0];
    track.addEventListener("ended", () => {
      if (sessionRef.current === session && streamRef.current === stream) void fail(session, new CameraSetupError("ended", ""));
    });

    try {
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
    } catch (cause) {
      return fail(session, new CameraSetupError("video", String(cause)));
    }

    const capabilities = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
    setTorchAvailable(Boolean(capabilities.torch));
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameraCount(devices.filter((d) => d.kind === "videoinput").length);
    } catch {
      setCameraCount(0);
    }

    try {
      decoderRef.current ??= await createDecoder();
    } catch {
      return fail(session, new CameraSetupError("decoder", ""));
    }
    if (sessionRef.current !== session) return;
    scanningRef.current = true;
    setStatus("scanning");
    void tick(session);
  }

  function close() {
    releaseCamera();
    setFound(null);
    setWarning(null);
    setHint(false);
    setError(null);
    setStatus("idle");
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
    void tick(sessionRef.current);
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

  const active = status === "requesting" || status === "scanning" || status === "paused";
  const statusText =
    status === "requesting" ? "Esperando permiso… elegí «Permitir» en el aviso de Chrome"
    : status === "paused" ? `Código leído: ${found}`
    : found ? `Leído: ${found}`
    : warning ?? "Apuntá al código y mantenelo dentro del marco";

  return (
    <div className="space-y-3" aria-label="Lector de códigos de barras">
      {status === "idle" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-brand-muted sm:max-w-md">
            Chrome te va a pedir permiso para usar la cámara. El video se procesa en el navegador: no se graba ni se envía a ningún lado.
          </p>
          <Button variant="primary" icon="barcode" className="h-14 w-full text-base sm:h-12 sm:w-auto" onClick={() => void start("environment")}>
            {startLabel}
          </Button>
        </div>
      )}

      {status === "error" && error && (
        <div role="alert" className="rounded-2xl border border-brand-line bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-danger/10 text-brand-danger"><Icon name="alert" /></span>
            <div className="min-w-0">
              <p className="font-semibold">{error.title}</p>
              <p className="mt-1 text-sm text-brand-muted">{error.message}</p>
              {error.steps && (
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-brand-muted">
                  {error.steps.map((s) => <li key={s}>{s}</li>)}
                </ol>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
            {error.canRetry && <Button variant="primary" className="h-12 sm:h-11" onClick={() => void start(facing)}>Reintentar</Button>}
            <Button className="h-12 sm:h-11" onClick={() => { close(); onManual(); }}>Ingresar el código a mano</Button>
            <Button variant="ghost" className="h-12 sm:h-11" onClick={close}>Cerrar</Button>
          </div>
        </div>
      )}

      {/* El video está siempre en el DOM (oculto sin cámara) para poder conectarle el flujo al recibirlo. */}
      <div className={active ? "space-y-3" : "hidden"}>
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
              {found && <span className="absolute inset-0 grid place-items-center text-[#5fd37a]"><Icon name="check" className="size-14" /></span>}
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
          {cameraCount > 1 && status !== "requesting" && (
            <Button className="h-12 sm:h-11" onClick={() => void start(facing === "environment" ? "user" : "environment")}>
              {facing === "environment" ? "Cámara frontal" : "Cámara trasera"}
            </Button>
          )}
          {torchAvailable && status === "scanning" && (
            <Button className="h-12 sm:h-11" aria-pressed={torchOn} onClick={toggleTorch}>{torchOn ? "Apagar linterna" : "Linterna"}</Button>
          )}
          <Button variant="ghost" icon="x" className="h-12 border border-brand-line sm:h-11" onClick={close}>Cerrar cámara</Button>
        </div>
      </div>
    </div>
  );
}
