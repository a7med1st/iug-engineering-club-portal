"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

const CspNonceContext = createContext<string | undefined>(undefined);

export function CspNonceProvider({
  children,
  nonce,
}: {
  children: ReactNode;
  nonce?: string;
}) {
  return (
    <CspNonceContext.Provider value={nonce}>
      {children}
    </CspNonceContext.Provider>
  );
}

export function useCspNonce() {
  return useContext(CspNonceContext);
}

export function NonceStyle({ children }: { children: string }) {
  const nonce = useCspNonce();

  return <style nonce={nonce}>{children}</style>;
}
