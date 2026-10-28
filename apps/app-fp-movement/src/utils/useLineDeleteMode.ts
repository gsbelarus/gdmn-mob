import { useCallback, useState } from 'react';

import { deleteSelectedLineItems, getDelLineList } from '@lib/mobile-hooks';

export type LineDeleteHandlers = {
  onPress: () => void;
  onLongPress?: () => void;
  checked: boolean;
};

export const useLineDeleteMode = ({ allowLineDelete, isBlocked }: { allowLineDelete: boolean; isBlocked: boolean }) => {
  const [delList, setDelList] = useState<string[]>([]);
  const isDelList = delList.length > 0;
  const canSelectLines = allowLineDelete && !isBlocked;

  const toggleLineSelection = useCallback((lineId: string) => {
    setDelList((current) => getDelLineList(current, lineId));
  }, []);

  const clearSelection = useCallback(() => {
    setDelList([]);
  }, []);

  const handleDeleteSelectedLines = useCallback(
    (onConfirm: () => void) => {
      if (!delList.length) {
        return;
      }

      deleteSelectedLineItems(onConfirm);
    },
    [delList.length],
  );

  const getLineHandlers = useCallback(
    (lineId: string, existingOnPress?: () => void): LineDeleteHandlers => {
      const checked = delList.includes(lineId);

      if (!canSelectLines) {
        return {
          checked: false,
          onPress: existingOnPress ?? (() => undefined),
        };
      }

      return {
        checked,
        onPress: () => {
          if (isDelList) {
            toggleLineSelection(lineId);
            return;
          }

          existingOnPress?.();
        },
        onLongPress: () => toggleLineSelection(lineId),
      };
    },
    [canSelectLines, delList, isDelList, toggleLineSelection],
  );

  return {
    delList,
    isDelList,
    toggleLineSelection,
    handleDeleteSelectedLines,
    getLineHandlers,
    clearSelection,
  };
};
