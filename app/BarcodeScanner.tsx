"use client";

import { Camera, CameraOff, ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type BarcodeScannerProps = {
  onDetected: (barcode: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [message, setMessage] = useState("Solicitando acceso a la cámara…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 150,
          delayBetweenScanSuccess: 1000,
        });
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current || undefined,
          (result) => {
            if (!active || !result) return;
            const value = result.getText().replace(/\D/g, "");
            if (value.length < 8 || value.length > 14) return;
            controlsRef.current?.stop();
            onDetected(value);
          },
        );
        controlsRef.current = controls;
        if (active) setMessage("Ubica el código dentro del recuadro");
      } catch {
        if (!active) return;
        setFailed(true);
        setMessage("No pudimos abrir la cámara. Revisa el permiso del navegador o escribe el código.");
      }
    })();

    return () => {
      active = false;
      controlsRef.current?.stop();
    };
  }, [onDetected]);

  return (
    <div className="scanner-panel">
      <div className="scanner-head">
        <div>
          <span className="eyebrow">ESCÁNER</span>
          <h3>Escanea el código de barras</h3>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar cámara">
          <X size={21} />
        </button>
      </div>
      <div className={`scanner-video ${failed ? "failed" : ""}`}>
        <video ref={videoRef} muted playsInline />
        <span className="scanner-frame" aria-hidden="true"><ScanLine size={34} /></span>
        {failed && <CameraOff size={42} />}
      </div>
      <p><Camera size={17} /> {message}</p>
    </div>
  );
}
