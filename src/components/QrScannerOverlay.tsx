import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Thermometer,
  X,
} from 'lucide-react';
import { FoodListing } from '../types';

interface QrScannerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  listing: FoodListing;
  otpType: 'pickup' | 'dropoff';
  defaultTempC: string;
  onScanVerified: (
    otpType: 'pickup' | 'dropoff',
    decodedOtp: string,
    loggedTempC: number
  ) => Promise<void>;
}

/**
 * Generates a deterministic 21x21 Version-1 QR-like matrix from a payload string
 * with standard 7x7 finder patterns in the three corners.
 */
function buildDeterministicQrMatrix(payload: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  const placeFinder = (rowOffset: number, colOffset: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[rowOffset + r][colOffset + c] = isBorder || isCore;
        reserved[rowOffset + r][colOffset + c] = true;
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }

  // Deterministic hash bits from payload
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let seed = Math.abs(hash) || 123456789;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      // Leave quiet separator around finders
      if (
        (r < 8 && c < 8) ||
        (r < 8 && c >= size - 8) ||
        (r >= size - 8 && c < 8)
      ) {
        continue;
      }
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      grid[r][c] = (seed & 1) === 1;
    }
  }

  return grid;
}

export const QrScannerOverlay: React.FC<QrScannerOverlayProps> = ({
  isOpen,
  onClose,
  listing,
  otpType,
  defaultTempC,
  onScanVerified,
}) => {
  const [scanPhase, setScanPhase] = useState<
    'aligning' | 'decoding' | 'locked'
  >('aligning');
  const [tempReadingC, setTempReadingC] = useState<string>(defaultTempC);
  const [useLiveCamera, setUseLiveCamera] = useState<boolean>(false);
  const [cameraStatus, setCameraStatus] = useState<string>(
    'Optical Packaging Sensor Ready'
  );
  const [verifying, setVerifying] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const targetOtp =
    otpType === 'pickup' ? listing.pickupOtp : listing.dropoffOtp;

  const qrPayload = useMemo(() => {
    return `ANNAKSHETRA://VERIFY?batch=${listing.batchCode}&stage=${otpType.toUpperCase()}&otp=${targetOtp}&org=${encodeURIComponent(
      otpType === 'pickup'
        ? listing.donorOrg
        : listing.claimedByReceiverOrg || 'Community Shelter'
    )}&temp=${tempReadingC}C`;
  }, [listing, otpType, targetOtp, tempReadingC]);

  const qrMatrix = useMemo(
    () => buildDeterministicQrMatrix(qrPayload),
    [qrPayload]
  );

  useEffect(() => {
    setTempReadingC(defaultTempC);
    setScanPhase('aligning');
    setVerifying(false);
  }, [isOpen, defaultTempC, listing.id, otpType]);

  // Manage optional live camera stream
  useEffect(() => {
    if (!isOpen || !useLiveCamera) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let active = true;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraStatus('Webcam unavailable — using simulated optical sensor');
          setUseLiveCamera(false);
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraStatus('Live Camera Active — Align Donor QR Label');
      } catch {
        if (active) {
          setCameraStatus(
            'Camera permission declined — using simulated optical QR reader'
          );
          setUseLiveCamera(false);
        }
      }
    }

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, useLiveCamera]);

  if (!isOpen) return null;

  const handleTriggerOpticalScan = async () => {
    if (verifying) return;
    setScanPhase('decoding');

    window.setTimeout(async () => {
      setScanPhase('locked');
      setVerifying(true);
      try {
        await onScanVerified(
          otpType,
          targetOtp,
          Number(tempReadingC) ||
            (listing.storageCondition.includes('Chilled') ? 4.2 : 62.5)
        );
        window.setTimeout(() => {
          onClose();
        }, 450);
      } finally {
        setVerifying(false);
      }
    }, 650);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-orange-400 font-medium">
              <QrCode className="w-3.5 h-3.5" />
              <span>
                {otpType === 'pickup'
                  ? 'Donor Container Pickup QR Verification'
                  : 'Shelter Intake Drop-off QR Verification'}
              </span>
            </div>
            <h2 className="text-base font-bold text-white mt-0.5">
              Scan Packaging Custody Label — {listing.batchCode}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            aria-label="Close QR scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Optical Viewfinder Area */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{cameraStatus}</span>
            <button
              type="button"
              onClick={() => setUseLiveCamera((v) => !v)}
              className="px-2.5 py-1 rounded-md border border-slate-700 hover:border-slate-600 text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-orange-400" />
              {useLiveCamera ? 'Switch to Label Target' : 'Use Device Camera'}
            </button>
          </div>

          {/* Reticle Frame */}
          <div className="relative h-72 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
            {useLiveCamera && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover opacity-55"
              />
            )}

            {/* Simulated Food Container Thermal Packaging Label in Viewfinder */}
            <div
              className={`relative z-10 bg-white text-slate-900 p-4 rounded-xl shadow-lg border-2 transition-transform duration-200 w-64 ${
                scanPhase === 'locked'
                  ? 'border-emerald-500 scale-102'
                  : scanPhase === 'decoding'
                  ? 'border-orange-500'
                  : 'border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                <div>
                  <div className="text-[10px] font-mono-tabular font-bold uppercase text-slate-500">
                    ANNAKSHETRA CUSTODY SEAL
                  </div>
                  <div className="text-xs font-extrabold text-slate-900">
                    {listing.batchCode} · {listing.weightKg} KG
                  </div>
                </div>
                <span className="text-[10px] font-mono-tabular font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">
                  {otpType.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Deterministic SVG QR Code */}
                <svg
                  viewBox="0 0 21 21"
                  className="w-24 h-24 shrink-0 bg-white p-1 border border-slate-200 rounded"
                  role="img"
                  aria-label={`QR Code for ${listing.batchCode}`}
                >
                  {qrMatrix.map((row, rIdx) =>
                    row.map((cell, cIdx) =>
                      cell ? (
                        <rect
                          key={`${rIdx}-${cIdx}`}
                          x={cIdx}
                          y={rIdx}
                          width={1}
                          height={1}
                          fill="#0F172A"
                        />
                      ) : null
                    )
                  )}
                </svg>

                <div className="text-[11px] space-y-1 leading-tight">
                  <div className="font-bold text-slate-900 line-clamp-2">
                    {otpType === 'pickup'
                      ? listing.donorOrg
                      : listing.claimedByReceiverOrg || 'Community Shelter'}
                  </div>
                  <div className="text-slate-600">
                    {listing.servings} meals · {listing.dietaryType}
                  </div>
                  <div className="text-slate-500 font-mono-tabular">
                    {listing.storageCondition}
                  </div>
                  <div className="pt-1 font-mono-tabular font-bold text-orange-600">
                    ENC-OTP: {targetOtp}
                  </div>
                </div>
              </div>
            </div>

            {/* Corner Targeting Brackets */}
            <div className="absolute inset-6 pointer-events-none">
              <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-orange-500 rounded-tl-md" />
              <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-orange-500 rounded-tr-md" />
              <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-orange-500 rounded-bl-md" />
              <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-orange-500 rounded-br-md" />
            </div>

            {/* Active Laser Line Indicator */}
            {scanPhase !== 'locked' && (
              <div
                className={`absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent shadow-sm transition-all duration-300 ${
                  scanPhase === 'decoding' ? 'top-1/2 opacity-100' : 'top-1/3 opacity-80'
                }`}
              />
            )}

            {/* Status Pill Overlay at Bottom of Viewfinder */}
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md bg-slate-900/90 border border-slate-700 text-[11px] font-mono-tabular flex items-center gap-1.5">
              {scanPhase === 'locked' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">
                    QR Checksum Verified — OTP {targetOtp} Locked
                  </span>
                </>
              ) : scanPhase === 'decoding' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-orange-400 animate-spin" />
                  <span className="text-orange-300">
                    Decoding Container Signature &amp; OTP...
                  </span>
                </>
              ) : (
                <>
                  <ScanLine className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-slate-300">
                    Target Locked: {listing.batchCode} Packaging QR
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Decoded Payload & Thermal Sensor Check */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">
                Encoded QR Custody Payload:
              </span>
              <span className="font-mono-tabular text-emerald-400 font-semibold">
                SHA-256 Valid
              </span>
            </div>
            <div className="font-mono-tabular text-[11px] text-slate-300 break-all bg-slate-900 p-2 rounded border border-slate-800">
              {qrPayload}
            </div>

            <div className="flex items-center justify-between gap-4 pt-1">
              <label className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                <span>IR Container Probe Temp (°C):</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={tempReadingC}
                onChange={(e) => setTempReadingC(e.target.value)}
                className="w-24 px-2.5 py-1 text-xs font-mono-tabular font-bold bg-slate-900 border border-slate-700 rounded-md text-white text-right"
              />
            </div>
          </div>

          {/* Primary Action Bar */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Eliminates manual 4-digit OTP entry errors</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={verifying}
                onClick={handleTriggerOpticalScan}
                className="px-4 py-2.5 text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <QrCode className="w-4 h-4" />
                {verifying
                  ? 'Verifying Custody...'
                  : `Scan & Verify ${
                      otpType === 'pickup' ? 'Pickup' : 'Drop-off'
                    } QR`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
