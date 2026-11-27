import { createContext, useContext } from 'react';
import { Swap, SwapSide } from './data';

export interface SwapApi {
  swaps: Swap[];
  send: (kind: 'venue' | 'time', iso: string, from: SwapSide, to: SwapSide, venue?: string) => void;
  reschedule: (sourceIso: string, from: SwapSide, iso: string, start: number, venue: string) => boolean;
  decide: (id: string, decision: 'accepted' | 'declined') => void;
}
export const SwapCtx = createContext<SwapApi>({ swaps: [], send: () => {}, reschedule: () => false, decide: () => {} });
export const useSwaps = () => useContext(SwapCtx);
