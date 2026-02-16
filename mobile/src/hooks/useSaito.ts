import { useContext } from 'react';
import { SaitoContext, SaitoContextValue } from '../app/SaitoProvider';

export function useSaito(): SaitoContextValue {
  const ctx = useContext(SaitoContext);
  if (!ctx.bridge && ctx.status === 'ready') {
    throw new Error('useSaito must be used within a SaitoProvider');
  }
  return ctx;
}
