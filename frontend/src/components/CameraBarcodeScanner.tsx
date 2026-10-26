"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface CameraBarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export default function CameraBarcodeScanner({
  onDetected,
  onClose,
}: CameraBarcodeScannerProps) {
  const [errorMsg, setErrorMsg] = useState<string>("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = "barcode-camera-reader";

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(readerId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.33,
          },
          (decodedText) => {
            if (isMounted) {
              onDetected(decodedText.trim());
              stopScanner();
              onClose();
            }
          },
          () => {}
        );
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(
            "No se pudo acceder a la cámara. Asegúrate de dar permisos de cámara en tu navegador."
          );
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, []);

  const stopScanner = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current
        .stop()
        .then(() => scannerRef.current?.clear())
        .catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Escáner de Código con Cámara</h3>
              <p className="text-[11px] text-slate-500">
                Apunta la cámara al código de barras del producto
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {errorMsg ? (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs">
            {errorMsg}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-black relative flex items-center justify-center min-h-[260px]">
            <div id={readerId} className="w-full h-full" />
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-64 h-36 border-2 border-dashed border-indigo-400/80 rounded-xl animate-pulse" />
              <span className="text-[11px] text-white/80 bg-black/50 px-2.5 py-1 rounded-full mt-2">
                Enfoca el código de barras aquí
              </span>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            stopScanner();
            onClose();
          }}
          className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Cerrar Cámara
        </button>
      </div>
    </div>
  );
}
