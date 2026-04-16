export type RedactionTarget = {
  page: number;   // 0-indexed
  x: number;      // points, PDF coord space (origin bottom-left)
  y: number;
  width: number;
  height: number;
  text?: string;  // the string this region is expected to hide (for verification)
};

export type RedactionResult = {
  bytes: Uint8Array;
  pageCount: number;
  regionCount: number;
  sha256: string;
};
