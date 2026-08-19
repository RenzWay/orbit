import { QRCodeSVG } from "qrcode.react";
import type { TransferSession } from "../../service/transfer/transfer.type";

interface TransferQrProps {
  session: TransferSession;
}

export function TransferQr({ session }: TransferQrProps) {
  const payload = JSON.stringify({
    peerId: session.peerId,
    token: session.token,
  });

  return (
    <div>
      <QRCodeSVG value={payload} size={256} />

      <p>{session.token}</p>
    </div>
  );
}
