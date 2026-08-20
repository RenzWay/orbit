import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerProps {
  onScan: (data: string) => void;
}

export function QrScanner({ onScan }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");

    scannerRef.current = scanner;

    let cancelled = false;

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 320, height: 320 },
          },
          (decodedText) => {
            console.log("QR DETECTED:", decodedText);

            if (cancelled) return;

            onScan(decodedText);

            scanner.stop().catch((error) => {
              console.error("Scanner stop error:", error);
            });
          },
          () => {},
        );

        if (cancelled) {
          await scanner.stop().catch(() => {});
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Camera error:", error);
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;

      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }

      try {
        scanner.clear();
      } catch {
        // empty
      }
    };
  }, [onScan]);

  return <div id="qr-reader" />;
}
