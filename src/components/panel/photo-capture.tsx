"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dialog } from "./ui";

type Phase = "starting" | "live" | "review" | "error";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Recibe la foto ya aceptada (un File JPEG). Recién entonces pasa al formulario; nada se sube acá. */
  onAccept: (file: File) => void;
};

/** Foto cuadrada: el encuadre que se ve es el que se guarda (el catálogo muestra las fotos casi cuadradas). */
const MAX_SIDE = 2000;

/**
 * Captura con la cámara del dispositivo (la trasera, si hay), dentro del formulario. Flujo: encuadrar → sacar →
 * ver la foto → «Usar foto» o «Volver a sacar». No sube nada: entrega el archivo al formulario, que lo prepara
 * (orientación, tamaño, WebP) y lo sube recién al guardar el producto. Si no hay cámara o el permiso está
 * denegado, ofrece la cámara nativa del teléfono (input con capture) y la galería.
 */
export function PhotoCapture({ open, onClose, onAccept }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="Sacar foto">
      {open && <Capture onClose={onClose} onAccept={onAccept} />}
    </Dialog>
  );
}

function errorMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "No se pudo usar la cámara porque el permiso está denegado. Habilitá la cámara para este sitio en el navegador, o usá otra opción.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Este dispositivo no tiene una cámara disponible.";
  if (name === "NotReadableError") return "La cámara está siendo usada por otra aplicación. Cerrala e intentá de nuevo.";
  return "No se pudo abrir la cámara. Probá de nuevo o usá otra opción.";
}

function Capture({ onClose, onAccept }: Omit<Props, "open">) {
  const supported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const [phase, setPhase] = useState<Phase>(supported ? "starting" : "error");
  const [error, setError] = useState<string | null>(supported ? null : "Este navegador no permite abrir la cámara desde acá (hace falta una conexión segura o un navegador más nuevo).");
  const [shot, setShot] = useState<{ url: string; file: File } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const shotUrl = useRef<string | null>(null);
  const native = useRef<HTMLInputElement>(null);

  // Abre la cámara al montar y la apaga al desmontar (cerrar el diálogo siempre libera la cámara).
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 2560 } }, audio: false })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        const el = video.current;
        if (el) {
          el.srcObject = s;
          await el.play().catch(() => undefined);
        }
        setPhase("live");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(errorMessage(e));
        setPhase("error");
      });
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      if (shotUrl.current) URL.revokeObjectURL(shotUrl.current);
    };
  }, [supported]);

  function take() {
    const el = video.current;
    if (!el || !el.videoWidth) return;
    const side = Math.min(el.videoWidth, el.videoHeight);
    const out = Math.min(side, MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("No se pudo capturar la foto. Probá de nuevo.");
      return;
    }
    // Recorte cuadrado centrado: lo mismo que muestra el visor.
    ctx.drawImage(el, (el.videoWidth - side) / 2, (el.videoHeight - side) / 2, side, side, 0, 0, out, out);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("No se pudo capturar la foto. Probá de nuevo.");
          return;
        }
        if (shotUrl.current) URL.revokeObjectURL(shotUrl.current);
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);
        shotUrl.current = url;
        setError(null);
        setShot({ url, file });
        el.pause();
        setPhase("review");
      },
      "image/jpeg",
      0.92,
    );
  }

  function retake() {
    if (shotUrl.current) URL.revokeObjectURL(shotUrl.current);
    shotUrl.current = null;
    setShot(null);
    void video.current?.play();
    setPhase("live");
  }

  function accept() {
    if (!shot) return;
    onAccept(shot.file);
    onClose();
  }

  return (
    <div className="space-y-3">
      {phase !== "error" && (
        <div className="relative aspect-square overflow-hidden rounded-xl bg-black">
          {/* El video queda montado también al revisar (pausado) para poder volver a sacar sin reabrir la cámara. */}
          <video ref={video} playsInline muted aria-label="Vista de la cámara" className={`size-full object-cover ${phase === "review" ? "invisible" : ""}`} />
          {phase === "review" && shot && (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no pasa por el optimizador
            <img src={shot.url} alt="Foto sacada, lista para revisar" className="absolute inset-0 size-full object-cover" />
          )}
          {phase === "starting" && <p role="status" className="absolute inset-0 grid place-items-center text-sm text-white">Abriendo la cámara…</p>}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-brand-danger/30 bg-brand-danger/5 p-3 text-sm text-brand-danger">{error}</div>
      )}

      {phase === "live" && (
        <Button variant="primary" icon="camera" className="h-12 w-full text-base" onClick={take}>Sacar foto</Button>
      )}
      {phase === "review" && (
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-12" onClick={retake}>Volver a sacar</Button>
          <Button variant="primary" icon="check" className="h-12" onClick={accept}>Usar foto</Button>
        </div>
      )}
      {phase === "error" && (
        <div className="space-y-2">
          <p className="text-sm text-brand-muted">Podés sacar la foto con la cámara del teléfono o elegir una de la galería.</p>
          <Button variant="primary" icon="camera" className="h-12 w-full" onClick={() => native.current?.click()}>Usar la cámara del teléfono</Button>
          <input
            ref={native}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              onAccept(file);
              onClose();
            }}
          />
        </div>
      )}
      <Button variant="ghost" className="w-full" onClick={onClose}>Cancelar</Button>
    </div>
  );
}
