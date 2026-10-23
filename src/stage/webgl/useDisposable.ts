import { useEffect } from 'react';

export function useDisposable(resource: { dispose(): void } | null): void {
  useEffect(() => () => { resource?.dispose(); }, [resource]);
}
