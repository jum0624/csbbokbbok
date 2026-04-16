import { useSyncExternalStore } from 'react';

const getSnapshot = () => window.innerWidth;
const getServerSnapshot = () => 0;
const subscribe = (callback: () => void) => {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
};

export const useWindowSize = () => {
  const width = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { width };
};
