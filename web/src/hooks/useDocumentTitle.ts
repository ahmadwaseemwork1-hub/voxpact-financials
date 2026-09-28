import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Voxpact Financials` : 'Voxpact Financials';
  }, [title]);
}
