import { createContext, useContext } from 'react';

/** Mouse na página: nx/ny de -1 a 1 (centro = 0), mx/my em px dentro do layout. */
export interface Pointer {
  nx: number;
  ny: number;
  mx: number;
  my: number;
  inside: boolean;
}

export const POINTER_REST: Pointer = { nx: 0, ny: 0, mx: -999, my: -999, inside: false };

export const PointerContext = createContext<Pointer>(POINTER_REST);

export const usePointer = () => useContext(PointerContext);
