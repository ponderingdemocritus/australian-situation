import { beforeEach, vi } from "vitest";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const DEFAULT_TEST_WIDTH = 320;
const DEFAULT_TEST_HEIGHT = 240;

Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get() {
    return DEFAULT_TEST_WIDTH;
  }
});

Object.defineProperty(HTMLElement.prototype, "clientHeight", {
  configurable: true,
  get() {
    return DEFAULT_TEST_HEIGHT;
  }
});

Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value() {
    return {
      width: DEFAULT_TEST_WIDTH,
      height: DEFAULT_TEST_HEIGHT,
      top: 0,
      right: DEFAULT_TEST_WIDTH,
      bottom: DEFAULT_TEST_HEIGHT,
      left: 0,
      x: 0,
      y: 0,
      toJSON() {
        return this;
      }
    };
  }
});

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});
