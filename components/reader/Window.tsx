"use client";

import { VList, type VListHandle } from "virtua";
import { useCallback, useMemo, useRef } from "react";

type Props<T> = {
  items: T[];
  /** Stable, unique key per item — virtua keys its size cache on this. */
  keyOf: (item: T, index: number) => string;
  /** Starting size estimate in px; refined automatically after measuring. */
  estimateHeight: number;
  /** Pixels rendered beyond the viewport, per side. */
  buffer?: number;
  render: (item: T, index: number) => React.ReactNode;
  /** Index of the topmost visible item, as the reader scrolls. */
  onVisibleIndex?: (index: number) => void;
};

/**
 * Windowed vertical list.
 *
 * virtua measures each item as it renders and keeps a per-key size cache, so a
 * font-size change re-flows without a full re-layout pass. Scroll position is
 * only ever read, never written during reading, which leaves momentum and
 * rubber-band scrolling entirely with the platform compositor.
 */
export function Window<T>({
  items,
  keyOf,
  estimateHeight,
  buffer = 1200,
  render,
  onVisibleIndex,
}: Props<T>) {
  const listRef = useRef<VListHandle>(null);

  const handleScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    onVisibleIndex?.(list.findItemIndex(list.scrollOffset));
  }, [onVisibleIndex]);

  // Memoised so virtua can keep its internal element cache stable across
  // progress-only re-renders.
  const children = useMemo(
    () =>
      items.map((item, index) => (
        <div key={keyOf(item, index)}>{render(item, index)}</div>
      )),
    // `render` is intentionally excluded: callers pass an inline closure, and
    // keying on it would rebuild every item on each parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, keyOf],
  );

  return (
    <VList
      ref={listRef}
      style={{
        height: "100%",
        overflowX: "hidden",
        overscrollBehaviorY: "contain",
        WebkitOverflowScrolling: "touch",
      }}
      itemSize={estimateHeight}
      bufferSize={buffer}
      onScroll={handleScroll}
    >
      {children}
    </VList>
  );
}