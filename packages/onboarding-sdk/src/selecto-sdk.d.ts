declare module 'selecto-sdk' {
  export class SelectorGenerator {
    static getCssSelector(el: Element): string;
    static getXPath(el: Element): string;
    static getPlaywrightLocator(el: Element): string;
    static getCypressLocator(el: Element): string;
  }

  export interface ElementInspectorOptions {
    prioritySelectors?: string;
    onHover?: (target: Element, original: Element) => void;
    onSelect?: (target: Element, data: any) => void;
    excludeFilter?: (el: Element) => boolean;
    enableFade?: boolean;
    fadeOpacity?: number;
    showLabel?: boolean;
    highlightColor?: string;
  }

  export class ElementInspector {
    constructor(options?: ElementInspectorOptions);
    start(): void;
    stop(): void;
    setEnableFade(enable: boolean): void;
    setFadeOpacity(opacity: number): void;
    setShowLabel(show: boolean): void;
    setHighlightColor(color: string): void;
    highlightElement(element: Element | null): void;
  }
}
