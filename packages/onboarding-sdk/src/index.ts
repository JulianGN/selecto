import { ElementInspector } from 'selecto-sdk';

export interface TourStep {
  id: string;
  title: string;
  content: string;
  targetSelector?: string; // CSS selector of target element. If omitted, it's a central modal step
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  triggerType?: 'click' | 'input' | 'next_button';
  triggerValue?: string;
}

export interface TourOptions {
  steps: TourStep[];
  locale?: 'en' | 'pt-BR' | 'es' | string;
  labels?: {
    next?: string;
    back?: string;
    finish?: string;
  };
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
  };
  onStart?: () => void;
  onStepChange?: (stepIndex: number, step: TourStep) => void;
  onComplete?: () => void;
  onSkip?: () => void;
}

const DEFAULT_LABELS: Record<string, { next: string; back: string; finish: string }> = {
  en: { next: 'Next', back: 'Back', finish: 'Finish' },
  'pt-BR': { next: 'Avançar', back: 'Voltar', finish: 'Concluir' },
  es: { next: 'Siguiente', back: 'Atrás', finish: 'Finalizar' }
};

export class OnboardingTour {
  private steps: TourStep[];
  private currentStepIndex: number = -1;
  private options: TourOptions;
  private active: boolean = false;
  private tooltipElement: HTMLElement | null = null;
  private overlayInspector: any = null; // ElementInspector instance for spotlight

  public static discoverFromDOM(options?: Omit<TourOptions, 'steps'>): OnboardingTour {
    const steps: TourStep[] = [];
    
    // Find all elements with tour step attributes
    const elements = Array.from(document.querySelectorAll('[data-tour-step], [data-onboarding-step]'));
    
    elements.forEach((el) => {
      const stepAttr = el.getAttribute('data-tour-step') || el.getAttribute('data-onboarding-step');
      if (!stepAttr) return;
      
      const stepIndex = parseInt(stepAttr, 10);
      if (isNaN(stepIndex)) return;
      
      const title = el.getAttribute('data-tour-title') || 
                    el.getAttribute('data-onboarding-title') || 
                    `Step ${stepIndex}`;
                    
      const content = el.getAttribute('data-tour-content') || 
                      el.getAttribute('data-onboarding-content') || 
                      '';
                      
      const placementVal = el.getAttribute('data-tour-placement') || 
                           el.getAttribute('data-onboarding-placement') || 
                           'bottom';
                           
      const placement = ['top', 'bottom', 'left', 'right', 'center'].includes(placementVal)
        ? (placementVal as any)
        : 'bottom';

      // Use the attribute selector itself as a guaranteed unique path for the step
      const targetSelector = el.hasAttribute('data-tour-step')
        ? `[data-tour-step="${stepAttr}"]`
        : `[data-onboarding-step="${stepAttr}"]`;

      steps.push({
        id: `discovered-step-${stepIndex}-${Math.random().toString(36).substring(2, 6)}`,
        title,
        content,
        targetSelector,
        placement
      });
    });

    // Sort steps numerically
    steps.sort((a, b) => {
      const aNum = parseInt(a.targetSelector?.match(/\d+/)?.[0] || '0', 10);
      const bNum = parseInt(b.targetSelector?.match(/\d+/)?.[0] || '0', 10);
      return aNum - bNum;
    });

    return new OnboardingTour({
      ...options || {},
      steps
    });
  }

  public static async loadAndStart(tourId: string, options: Omit<TourOptions, 'steps'> & { dashboardUrl: string }): Promise<OnboardingTour> {
    const { dashboardUrl, ...tourOptions } = options;
    const cleanUrl = dashboardUrl.endsWith('/') ? dashboardUrl.slice(0, -1) : dashboardUrl;
    
    const response = await fetch(`${cleanUrl}/api/v1/flows`);
    const data = await response.json();
    if (!data.success || !data.flows) {
      throw new Error(data.error || 'Failed to load flows from Selecto Dashboard');
    }
    
    const flow = data.flows.find((f: any) => f.id === tourId);
    if (!flow) {
      throw new Error(`Selecto flow not found: ${tourId}`);
    }
    
    const theme = (() => {
      try {
        if (flow.description && flow.description.startsWith('{')) {
          const json = JSON.parse(flow.description);
          return {
            primaryColor: json.primaryColor,
            backgroundColor: json.backgroundColor,
            textColor: json.textColor
          };
        }
      } catch {}
      return undefined;
    })();

    const tour = new OnboardingTour({
      ...tourOptions,
      theme: theme || tourOptions.theme,
      steps: flow.steps.map((step: any) => ({
        id: step.id,
        title: step.title,
        content: step.content,
        targetSelector: step.targetSelector || undefined,
        placement: step.placement
      }))
    });
    
    tour.start();
    return tour;
  }

  private static activeTourInstance: OnboardingTour | null = null;

  constructor(options: TourOptions) {
    this.options = options;
    this.steps = options.steps;
  }

  private handleResizeOrScroll = (): void => {
    if (!this.active || !this.tooltipElement) return;
    const step = this.steps[this.currentStepIndex];
    if (step.targetSelector) {
      const target = document.querySelector(step.targetSelector);
      if (target) {
        this.positionTooltip(target as HTMLElement, this.tooltipElement, step.placement);
        if (this.overlayInspector) {
          this.overlayInspector.highlightElement(target as HTMLElement);
        }
      }
    }
  };

  private positionTooltip(target: HTMLElement, tooltip: HTMLElement, placement?: string): void {
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = rect.left + (rect.width - tooltipRect.width) / 2;
    let top = rect.bottom + 8;

    if (placement === 'top') {
      left = rect.left + (rect.width - tooltipRect.width) / 2;
      top = rect.top - tooltipRect.height - 8;
    } else if (placement === 'left') {
      left = rect.left - tooltipRect.width - 8;
      top = rect.top + (rect.height - tooltipRect.height) / 2;
    } else if (placement === 'right') {
      left = rect.right + 8;
      top = rect.top + (rect.height - tooltipRect.height) / 2;
    }

    // Viewport bounds checking (excluding scrollbars)
    const viewportPadding = 16;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    const maxLeft = viewportWidth - tooltipRect.width - viewportPadding;
    const minLeft = viewportPadding;

    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    const maxTop = viewportHeight - tooltipRect.height - viewportPadding;
    const minTop = viewportPadding;

    if (top < minTop) top = minTop;
    if (top > maxTop) top = maxTop;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  private hexToRgba(hex: string, alpha: number): string {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const r = parseInt(cleanHex.substring(0, 2), 16) || 99;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 102;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 241;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  public start(): void {
    if (this.active || this.steps.length === 0) return;

    // Terminate any currently running tour
    if (OnboardingTour.activeTourInstance) {
      OnboardingTour.activeTourInstance.cleanup();
    }
    OnboardingTour.activeTourInstance = this;

    this.active = true;
    this.currentStepIndex = 0;
    this.options.onStart?.();

    // Listen for resize and scroll events to dynamically position the tooltip
    window.addEventListener('resize', this.handleResizeOrScroll);
    window.addEventListener('scroll', this.handleResizeOrScroll, { capture: true });

    this.renderStep();
  }

  public next(): void {
    if (!this.active) return;
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      this.renderStep();
    } else {
      this.complete();
    }
  }

  public prev(): void {
    if (!this.active) return;
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.renderStep();
    }
  }

  public skip(): void {
    this.cleanup();
    this.options.onSkip?.();
  }

  public complete(): void {
    this.cleanup();
    this.options.onComplete?.();
  }

  private renderStep(): void {
    const step = this.steps[this.currentStepIndex];
    this.options.onStepChange?.(this.currentStepIndex, step);
    
    // Cleanup previous overlays/tooltips
    this.cleanupUI();

    if (step.targetSelector) {
      const target = document.querySelector(step.targetSelector);
      if (target) {
        this.renderTooltip(target as HTMLElement, step);
        this.applySpotlight(target as HTMLElement);
      } else {
        // Fallback: render as central modal if target not found
        this.renderCentralModal(step);
      }
    } else {
      this.renderCentralModal(step);
    }
  }

  private renderTooltip(target: HTMLElement, step: TourStep): void {
    const tooltip = document.createElement('div');
    tooltip.id = 'selecto-onboarding-tooltip';
    
    const textColor = this.options.theme?.textColor || '#ffffff';
    const mutedTextColor = this.hexToRgba(textColor, 0.7);
    const borderColor = this.hexToRgba(textColor, 0.15);

    // Apply premium styling
    Object.assign(tooltip.style, {
      position: 'fixed',
      backgroundColor: this.options.theme?.backgroundColor ? this.hexToRgba(this.options.theme.backgroundColor, 0.95) : 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(8px)',
      webkitBackdropFilter: 'blur(8px)',
      border: `1px solid ${borderColor}`,
      color: textColor,
      padding: '16px',
      borderRadius: '12px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
      zIndex: '2147483647', // Above the highlight overlay (2147483646)
      maxWidth: '320px',
      width: '280px',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });

    const locale = this.options.locale || 'en';
    const labels = {
      ...(DEFAULT_LABELS[locale] || DEFAULT_LABELS.en),
      ...this.options.labels
    };

    const primaryColor = this.options.theme?.primaryColor || '#6366f1';
    const nextShadow = this.options.theme?.primaryColor 
      ? this.hexToRgba(this.options.theme.primaryColor, 0.4) 
      : 'rgba(99, 102, 241, 0.4)';

    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; font-size: 15px; color: ${textColor}; display: flex; justify-content: space-between; align-items: center;">
        <span>${step.title}</span>
        <button id="btn-skip" style="background: none; border: none; color: ${mutedTextColor}; cursor: pointer; font-size: 16px; padding: 4px; line-height: 1; transition: color 0.2s;">✕</button>
      </div>
      <div style="margin-bottom: 16px; font-size: 13.5px; color: ${mutedTextColor}; line-height: 1.4;">${this.parseRichContent(step.content)}</div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 12px; color: ${mutedTextColor}; font-weight: 500;">${this.currentStepIndex + 1} / ${this.steps.length}</span>
        <div style="display: flex; align-items: center;">
          ${this.currentStepIndex > 0 ? `
            <button id="btn-prev" style="margin-right: 8px; background: ${this.hexToRgba(textColor, 0.08)}; border: 1px solid ${borderColor}; color: ${textColor}; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; font-family: inherit;">
              ${labels.back}
            </button>
          ` : ''}
          <button id="btn-next" style="background: ${primaryColor}; border: none; color: #ffffff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; box-shadow: 0 4px 6px -1px ${nextShadow}; font-family: inherit;">
            ${this.currentStepIndex === this.steps.length - 1 ? labels.finish : labels.next}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(tooltip);
    this.tooltipElement = tooltip;

    // Calculate position
    this.positionTooltip(target, tooltip, step.placement);

    // Hover effect styles dynamically
    const skipBtn = tooltip.querySelector('#btn-skip') as HTMLElement;
    if (skipBtn) {
      skipBtn.addEventListener('mouseenter', () => skipBtn.style.color = textColor);
      skipBtn.addEventListener('mouseleave', () => skipBtn.style.color = mutedTextColor);
      skipBtn.addEventListener('click', () => this.skip());
    }

    const prevBtn = tooltip.querySelector('#btn-prev') as HTMLElement;
    if (prevBtn) {
      prevBtn.addEventListener('mouseenter', () => prevBtn.style.background = this.hexToRgba(textColor, 0.15));
      prevBtn.addEventListener('mouseleave', () => prevBtn.style.background = this.hexToRgba(textColor, 0.08));
      prevBtn.addEventListener('click', () => this.prev());
    }

    const nextBtn = tooltip.querySelector('#btn-next') as HTMLElement;
    if (nextBtn) {
      nextBtn.addEventListener('mouseenter', () => nextBtn.style.filter = 'brightness(0.85)');
      nextBtn.addEventListener('mouseleave', () => nextBtn.style.filter = 'none');
      nextBtn.addEventListener('click', () => this.next());
    }
  }

  private renderCentralModal(step: TourStep): void {
    const modal = document.createElement('div');
    modal.id = 'selecto-onboarding-modal';
    
    const textColor = this.options.theme?.textColor || '#ffffff';
    const mutedTextColor = this.hexToRgba(textColor, 0.7);
    const borderColor = this.hexToRgba(textColor, 0.15);

    // Apply premium styling
    Object.assign(modal.style, {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: this.options.theme?.backgroundColor ? this.hexToRgba(this.options.theme.backgroundColor, 0.95) : 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(8px)',
      webkitBackdropFilter: 'blur(8px)',
      border: `1px solid ${borderColor}`,
      color: textColor,
      padding: '24px',
      borderRadius: '16px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      zIndex: '2147483647', // Above the highlight overlay (2147483646)
      maxWidth: '400px',
      width: '90%',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });

    const locale = this.options.locale || 'en';
    const labels = {
      ...(DEFAULT_LABELS[locale] || DEFAULT_LABELS.en),
      ...this.options.labels
    };

    const primaryColor = this.options.theme?.primaryColor || '#6366f1';
    const nextShadow = this.options.theme?.primaryColor 
      ? this.hexToRgba(this.options.theme.primaryColor, 0.4) 
      : 'rgba(99, 102, 241, 0.4)';

    modal.innerHTML = `
      <div style="font-weight: bold; font-size: 18px; margin-bottom: 12px; color: ${textColor}; display: flex; justify-content: space-between; align-items: center;">
        <span>${step.title}</span>
        <button id="btn-skip" style="background: none; border: none; color: ${mutedTextColor}; cursor: pointer; font-size: 16px; padding: 4px; line-height: 1; transition: color 0.2s;">✕</button>
      </div>
      <div style="margin-bottom: 20px; font-size: 14.5px; color: ${mutedTextColor}; line-height: 1.5;">${this.parseRichContent(step.content)}</div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 12px; color: ${mutedTextColor}; font-weight: 500;">${this.currentStepIndex + 1} / ${this.steps.length}</span>
        <div style="display: flex; align-items: center;">
          ${this.currentStepIndex > 0 ? `
            <button id="btn-prev" style="margin-right: 8px; background: ${this.hexToRgba(textColor, 0.08)}; border: 1px solid ${borderColor}; color: ${textColor}; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; font-family: inherit;">
              ${labels.back}
            </button>
          ` : ''}
          <button id="btn-next" style="background: ${primaryColor}; border: none; color: #ffffff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; box-shadow: 0 4px 6px -1px ${nextShadow}; font-family: inherit;">
            ${this.currentStepIndex === this.steps.length - 1 ? labels.finish : labels.next}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.tooltipElement = modal;

    // Hover effect styles dynamically
    const skipBtn = modal.querySelector('#btn-skip') as HTMLElement;
    if (skipBtn) {
      skipBtn.addEventListener('mouseenter', () => skipBtn.style.color = textColor);
      skipBtn.addEventListener('mouseleave', () => skipBtn.style.color = mutedTextColor);
      skipBtn.addEventListener('click', () => this.skip());
    }

    const prevBtn = modal.querySelector('#btn-prev') as HTMLElement;
    if (prevBtn) {
      prevBtn.addEventListener('mouseenter', () => prevBtn.style.background = this.hexToRgba(textColor, 0.15));
      prevBtn.addEventListener('mouseleave', () => prevBtn.style.background = this.hexToRgba(textColor, 0.08));
      prevBtn.addEventListener('click', () => this.prev());
    }

    const nextBtn = modal.querySelector('#btn-next') as HTMLElement;
    if (nextBtn) {
      nextBtn.addEventListener('mouseenter', () => nextBtn.style.filter = 'brightness(0.85)');
      nextBtn.addEventListener('mouseleave', () => nextBtn.style.filter = 'none');
      nextBtn.addEventListener('click', () => this.next());
    }
  }

  private applySpotlight(target: HTMLElement): void {
    // Instantiate ElementInspector to apply backdrop dimming spotlight
    if (!this.overlayInspector) {
      this.overlayInspector = new ElementInspector({
        enableFade: true,
        fadeOpacity: 0.6,
        showLabel: false,
        highlightColor: this.options.theme?.primaryColor || '#6366f1'
      });
    } else {
      this.overlayInspector.setHighlightColor(this.options.theme?.primaryColor || '#6366f1');
    }
    this.overlayInspector.highlightElement(target);
  }

  private parseInlineMarkdown(text: string): string {
    let html = text;

    // 1. Bold: **text** or __text__
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // 2. Italic: *text* or _text_
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');

    // 3. Inline Code: `code`
    html = html.replace(/`(.*?)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #f43f5e;">$1</code>');

    // 4. Markdown link [text](url)
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color:#38bdf8;text-decoration:underline;font-weight:600;">$1</a>');

    return html;
  }

  private parseRichContent(content: string): string {
    if (!content) return "";
    
    const lines = content.split('\n');
    const parsedLines = lines.map(line => {
      const trimmed = line.trim();
      
      // 1. YouTube link recognition
      const youtubeReg = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)$/i;
      const ytMatch = trimmed.match(youtubeReg);
      if (ytMatch) {
        const videoId = ytMatch[1];
        return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:8px 0;border-radius:6px;background:#000;">
          <iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;border-radius:6px;"></iframe>
        </div>`;
      }

      // 2. Image link recognition
      const mdImageReg = /!\[(.*?)\]\((.*?)\)/i;
      const mdImgMatch = trimmed.match(mdImageReg);
      if (mdImgMatch) {
        const src = mdImgMatch[2];
        const alt = mdImgMatch[1] || "Image";
        return `<img src="${src}" alt="${alt}" style="max-width:100%;height:auto;border-radius:6px;margin:8px 0;display:block;" />`;
      }

      const rawImageReg = /^(https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|svg|webp|bmp))$/i;
      const rawImgMatch = trimmed.match(rawImageReg);
      if (rawImgMatch) {
        const src = rawImgMatch[1];
        return `<img src="${src}" alt="Embedded Image" style="max-width:100%;height:auto;border-radius:6px;margin:8px 0;display:block;" />`;
      }

      // 3. Bullet points (starting with "- " or "* ")
      const bulletMatch = trimmed.match(/^[\-*]\s+(.*)$/);
      if (bulletMatch) {
        const itemContent = bulletMatch[1];
        const inlineParsed = this.parseInlineMarkdown(itemContent);
        return `<div style="display: flex; gap: 8px; margin: 4px 0; align-items: flex-start;">
          <span style="color: #818cf8; font-weight: bold; line-height: 1.25;">•</span>
          <span style="flex: 1;">${inlineParsed}</span>
        </div>`;
      }

      // 4. Numbered lists (starting with "1. ")
      const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numberMatch) {
        const num = numberMatch[1];
        const itemContent = numberMatch[2];
        const inlineParsed = this.parseInlineMarkdown(itemContent);
        return `<div style="display: flex; gap: 8px; margin: 4px 0; align-items: flex-start;">
          <span style="color: #818cf8; font-weight: bold; font-size: 0.9em; line-height: 1.25;">${num}.</span>
          <span style="flex: 1;">${inlineParsed}</span>
        </div>`;
      }

      // Paragraph spacer
      if (trimmed === "") {
        return `<div style="height: 8px;"></div>`;
      }

      return this.parseInlineMarkdown(line);
    });

    return parsedLines.join('\n');
  }

  private cleanupUI(): void {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }
    if (this.overlayInspector) {
      this.overlayInspector.highlightElement(null);
    }
  }

  private cleanup(): void {
    this.active = false;
    this.cleanupUI();
    if (this.overlayInspector) {
      this.overlayInspector.stop();
      this.overlayInspector = null;
    }

    // Remove window resize/scroll listeners
    window.removeEventListener('resize', this.handleResizeOrScroll);
    window.removeEventListener('scroll', this.handleResizeOrScroll, { capture: true });

    if (OnboardingTour.activeTourInstance === this) {
      OnboardingTour.activeTourInstance = null;
    }
  }
}

export { OnboardingBuilder, BuilderOptions } from './builder';
