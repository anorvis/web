// biome-ignore-start lint/style/noRestrictedImports: approved scroll-sync hook wrapping useEffect
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// biome-ignore-end lint/style/noRestrictedImports: approved scroll-sync hook wrapping useEffect

type UseChatScrollOptions = {
  scrollRef: RefObject<HTMLDivElement | null>;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  messageCount: number;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
};

/**
 * Encapsulates chat scroll behavior: initial scroll on history load,
 * auto-scroll on new content, and IntersectionObserver for pagination.
 * Keeps all useEffect calls out of the Chat component.
 */
export function useChatScroll({
  scrollRef,
  loadMoreRef,
  messageCount,
  totalCount,
  hasMore,
  loadMore,
}: UseChatScrollOptions) {
  const historyLoadedRef = useRef(false);
  const prevCountRef = useRef(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const updateBottomState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 96);
  }, [scrollRef]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const el = scrollRef.current;
      if (!el) return;
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior });
        requestAnimationFrame(updateBottomState);
      });
    },
    [scrollRef, updateBottomState],
  );

  // Scroll once when history first loads
  useEffect(() => {
    if (!historyLoadedRef.current && messageCount > 0) {
      historyLoadedRef.current = true;
      scrollToBottom("auto");
    }
  }, [messageCount, scrollToBottom]);

  // Auto-scroll on new content
  useEffect(() => {
    if (historyLoadedRef.current && totalCount > prevCountRef.current) {
      scrollToBottom("smooth");
    }
    prevCountRef.current = totalCount;
  }, [totalCount, scrollToBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateBottomState();
    el.addEventListener("scroll", updateBottomState, { passive: true });
    return () => el.removeEventListener("scroll", updateBottomState);
  }, [scrollRef, updateBottomState]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!hasMore || !loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { threshold: 0.1 },
    );
    const el = loadMoreRef.current;
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [hasMore, loadMore, loadMoreRef]);

  return { isAtBottom, scrollToBottom };
}
