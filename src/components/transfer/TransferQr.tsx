import { QRCodeSVG } from "qrcode.react";
import type { TransferSession } from "../../service/transfer/transfer.type";

interface TransferQrProps {
  session: TransferSession;
}

export function TransferQr({ session }: TransferQrProps) {
  return (
    <div>
      <QRCodeSVG value={session.peerId} size={256} />

      <p>{session.peerId}</p>
    </div>
  );
}
