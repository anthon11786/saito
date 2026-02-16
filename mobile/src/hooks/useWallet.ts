import { useCallback, useEffect, useState } from 'react';
import { useSaito } from './useSaito';

export function useWallet() {
  const { bridge, status } = useSaito();
  const [publicKey, setPublicKey] = useState('');
  const [balance, setBalance] = useState('0');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (status !== 'ready' || !bridge) return;

    let cancelled = false;

    async function load() {
      try {
        const pk = await bridge!.call<string>('wallet', 'getPublicKey');
        const bal = await bridge!.call<string>('wallet', 'getBalance');
        if (!cancelled) {
          setPublicKey(pk);
          setBalance(bal);
          setConnected(true);
        }
      } catch (e) {
        console.error('[useWallet] load error:', e);
      }
    }

    load();

    const unsub = bridge.on('wallet', 'balance-updated', (data) => {
      if (!cancelled) {
        setBalance(data.balance);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [bridge, status]);

  const sendTransaction = useCallback(
    async (recipient: string, amount: string) => {
      if (!bridge) throw new Error('Bridge not ready');
      return bridge.call('wallet', 'createAndSendTransaction', {
        recipient,
        amount,
      });
    },
    [bridge],
  );

  const refreshBalance = useCallback(async () => {
    if (!bridge) return;
    const bal = await bridge.call<string>('wallet', 'getBalance');
    setBalance(bal);
  }, [bridge]);

  return {
    publicKey,
    balance,
    connected,
    sendTransaction,
    refreshBalance,
  };
}
