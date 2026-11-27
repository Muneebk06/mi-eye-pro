import { createContext, useContext } from 'react';
import { ReportRow } from './data';
import { Screen } from './types';

export interface Remark {
  id: string; iso: string; section: string; code: string; teachers: string[]; text: string; sentAt: number; status: 'delivered' | 'seen';
}
export interface RemarkApi {
  remarks: Remark[];
  bell: number;
  send: (row: ReportRow, text: string) => Promise<void>;
  markSeen: (id: string) => void;
  openRemark: (id: string, from: Screen) => void;
}
export const RemarkCtx = createContext<RemarkApi>({ remarks: [], bell: 0, send: async () => {}, markSeen: () => {}, openRemark: () => {} });
export const useRemarks = () => useContext(RemarkCtx);
