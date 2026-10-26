"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, RefreshCw, Check, RotateCcw } from "lucide-react";

interface CameraPhotoCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraPhotoCapture({ onCapture, onClose }: CameraPhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedBlobUrl, setCapturedBlobUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [devicesCount, setDevicesCount] = useState<number>(0);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startStream = async (mode: "environment" | "user") => {
    stopStream();
    setErrorMsg("");
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check available video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setDevicesCount(videoDevices.length);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("No se pudo iniciar la cámara. Verifica los permisos de tu navegador o usa la opción de subir foto.");
    }
  };

  useEffect(() => {
    startStream(facingMode);
    return () => {
      stopStream();
      if (capturedBlobUrl) {
        URL.revokeObjectURL(capturedBlobUrl);
      }
    };
  }, [facingMode]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `producto_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const url = URL.createObjectURL(blob);
        setCapturedBlobUrl(url);
        setCapturedFile(file);
        stopStream();
      },
      "image/jpeg",
      0.9
    );
  };

  const handleRetake = () => {
    if (capturedBlobUrl) {
      URL.revokeObjectURL(capturedBlobUrl);
    }
    setCapturedBlobUrl(null);
    setCapturedFile(null);
    startStream(facingMode);
  };

  const handleConfirm = () => {
    if (capturedFile) {
      onCapture(capturedFile);
      onClose();
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800 text-white">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Camera className="w-4 h-4 text-indigo-400" />
            <span>Tomar Foto del Producto</span>
          </div>
          <button
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Captured Photo */}
        <div className="relative bg-black aspect-video sm:aspect-square flex items-center justify-center overflow-hidden">
          {errorMsg ? (
            <div className="p-6 text-center text-xs text-rose-300 space-y-3">
              <p>{errorMsg}</p>
            </div>
          ) : capturedBlobUrl ? (
            <img
              src={capturedBlobUrl}
              alt="Foto capturada"
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />
          )}

          {/* Switch Camera Button if multiple exist and still in viewfinder */}
          {!capturedBlobUrl && !errorMsg && devicesCount > 1 && (
            <button
              type="button"
              onClick={toggleCamera}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
              title="Cambiar cámara (frontal/trasera)"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-slate-950 flex items-center justify-center gap-3">
          {capturedBlobUrl ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-200 font-semibold text-xs hover:bg-slate-800 transition"
              >
                <RotateCcw className="w-4 h-4" /> Repetir Foto
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
              >
                <Check className="w-4 h-4" /> Usar Esta Foto
              </button>
            </>
          ) : !errorMsg ? (
            <button
              type="button"
              onClick={handleCapture}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg transition"
            >
              <Camera className="w-5 h-5" /> Capturar Foto
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
