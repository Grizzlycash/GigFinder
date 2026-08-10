import { useEffect, useReducer } from 'react';
import { subscribe } from '@/store/store';

/** Re-render the tree whenever the store is saved. Mounted once, at the root. */
export function useStoreSync() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => subscribe(force), []);
}
