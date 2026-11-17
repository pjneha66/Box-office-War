/* Render optimization patch for Box Office War
   - Debounce render calls
   - Virtualize long lists
   - Cache static sections
*/

const RenderCache = {
  cache: new Map(),
  
  get(key) {
    return this.cache.get(key);
  },
  
  set(key, value) {
    this.cache.set(key, value);
  },
  
  invalidate(key) {
    this.cache.delete(key);
  }
};

// Optimized render function wrapper
function optimizedRender(renderFn) {
  let lastRender = 0;
  const DEBOUNCE_MS = 50;
  
  return function(...args) {
    const now = Date.now();
    if (now - lastRender < DEBOUNCE_MS) return;
    lastRender = now;
    return renderFn.apply(this, args);
  };
}

// Virtualize long lists
function virtualizeList(items, containerHeight = 400, itemHeight = 40) {
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 2;
  return {
    items,
    visibleCount,
    render(startIndex = 0) {
      return items.slice(startIndex, startIndex + visibleCount);
    }
  };
}
