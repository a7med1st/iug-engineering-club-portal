"use client";

import {
  QRCodeSVG,
} from "qrcode.react";

import {
  useEffect,
  useState,
} from "react";

export default function CertificateQr({
  code,
  size = 128,
}: {
  code: string;
  size?: number;
}) {
  const [
    value,
    setValue,
  ] =
    useState(
      `/certificates/verify/${code}`,
    );

  useEffect(() => {
    setValue(
      `${window.location.origin}/certificates/verify/${code}`,
    );
  }, [
    code,
  ]);

  return (
    <QRCodeSVG
      value={
        value
      }
      size={
        size
      }
      level="H"
      marginSize={
        2
      }
      title={`Certificate ${code}`}
    />
  );
}
