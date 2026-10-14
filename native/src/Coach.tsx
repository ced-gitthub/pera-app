import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { withTimeout, type Rect } from './coachLogic';

// The registry behind the live tour. A <CoachTarget id="..."> wraps a REAL control and registers its view here; the tour asks for its on-screen
// rect (measureInWindow) whenever it needs it. Nothing in this file re-renders the app: it is a plain mutable registry with a tiny event hook.
type Meta = { node: View | null; empty: boolean };
export type CoachApi = {
  setNode: (id: string, node: View | null) => void;
  setEmpty: (id: string, empty: boolean) => void;
  isEmpty: (id: string) => boolean;
  has: (id: string) => boolean;
  measure: (id: string) => Promise<Rect | null>;
  setScroller: (view: ScrollView | null) => void;
  setScrollY: (y: number) => void;
  scrollBy: (dy: number) => void;
  poke: () => void;
  subscribe: (fn: () => void) => () => void;
};

const none: CoachApi = {
  setNode: () => {},
  setEmpty: () => {},
  isEmpty: () => false,
  has: () => false,
  measure: async () => null,
  setScroller: () => {},
  setScrollY: () => {},
  scrollBy: () => {},
  poke: () => {},
  subscribe: () => () => {},
};
const MEASURE_MS = 400; // a view that unmounts mid-measure never calls back; without this the tour would wait forever
const Ctx = createContext<CoachApi>(none);
export const useCoach = () => useContext(Ctx);

export function CoachProvider({ children }: { children: ReactNode }) {
  const metas = useRef(new Map<string, Meta>());
  const scroller = useRef<{ view: ScrollView | null; y: number }>({ view: null, y: 0 });
  const listeners = useRef(new Set<() => void>());
  const api = useMemo<CoachApi>(() => {
    const meta = (id: string) => {
      let m = metas.current.get(id);
      if (!m) metas.current.set(id, (m = { node: null, empty: false }));
      return m;
    };
    const poke = () => listeners.current.forEach((f) => f());
    return {
      setNode: (id, node) => {
        meta(id).node = node;
        poke();
      },
      setEmpty: (id, empty) => {
        meta(id).empty = empty;
      },
      isEmpty: (id) => !!metas.current.get(id)?.empty,
      has: (id) => !!metas.current.get(id)?.node,
      measure: (id) =>
        withTimeout(
          new Promise<Rect | null>((resolve) => {
          const n = metas.current.get(id)?.node;
          if (!n) return resolve(null);
          try {
            n.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 && Number.isFinite(x + y) ? { x, y, w, h } : null));
          } catch {
            resolve(null);
          }
          }),
          MEASURE_MS,
          null,
        ),
      setScroller: (view) => {
        scroller.current = { view, y: 0 };
      },
      setScrollY: (y) => {
        scroller.current.y = y;
      },
      scrollBy: (dy) => {
        const sc = scroller.current;
        if (!sc.view || !dy) return;
        sc.y = Math.max(0, sc.y + dy);
        sc.view.scrollTo({ y: sc.y, animated: false });
      },
      poke,
      subscribe: (fn) => {
        listeners.current.add(fn);
        return () => void listeners.current.delete(fn);
      },
    };
  }, []);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

// A ref callback that registers a view under an id (used by CoachTarget, the Fab and anything that already owns its own view).
export function useCoachNode(id: string, empty = false) {
  const api = useCoach();
  useEffect(() => {
    api.setEmpty(id, empty);
  }, [api, id, empty]);
  return useCallback((n: View | null) => api.setNode(id, n), [api, id]);
}

// Wraps a real control so the tour can point at it. `empty` marks a placeholder (for example "Nothing yet") standing in for a list with no rows.
// `on={false}` renders the children untouched, so a list can mark only its first row.
export function CoachTarget({
  id,
  children,
  style,
  empty,
  on = true,
}: {
  id: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  empty?: boolean;
  on?: boolean;
}) {
  const ref = useCoachNode(on ? id : '', !!empty);
  const api = useCoach();
  if (!on) return <>{children}</>;
  return (
    <View ref={ref} collapsable={false} style={style} onLayout={api.poke}>
      {children}
    </View>
  );
}

// Spread on a tab's ScrollView so the tour can scroll a target into view.
export function useCoachScroll() {
  const api = useCoach();
  return {
    ref: (v: ScrollView | null) => api.setScroller(v),
    onScroll: (ev: NativeSyntheticEvent<NativeScrollEvent>) => api.setScrollY(ev.nativeEvent.contentOffset.y),
    scrollEventThrottle: 32,
  };
}
