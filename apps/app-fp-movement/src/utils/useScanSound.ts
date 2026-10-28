import { useCallback, useEffect, useRef } from 'react';

import { Audio } from 'expo-av';

/**
 * Загружает звук скана один раз на монтирование экрана и возвращает функцию
 * воспроизведения. Создание Audio.Sound в теле компонента грузило новый
 * аудио-объект на каждом рендере.
 */
export const useScanSound = (source: number): (() => void) => {
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(source);
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
      } catch {
        // ошибка загрузки звука не должна мешать сканированию
      }
    };

    loadSound().catch(() => undefined);

    return () => {
      cancelled = true;
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, [source]);

  return useCallback(() => {
    soundRef.current?.replayAsync();
  }, []);
};
