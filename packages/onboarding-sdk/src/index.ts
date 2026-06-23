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

  constructor(options: TourOptions) {
    this.options = options;
    this.steps = options.steps;
  }

  public start(): void {
    if (this.active || this.steps.length === 0) return;
    this.active = true;
    this.currentStepIndex = 0;
    this.options.onStart?.();
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
    // Basic tooltip UI creation in Shadow DOM or direct injection
    // (For skeleton, just inject basic element)
    const tooltip = document.createElement('div');
    tooltip.id = 'selecto-onboarding-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = '#1e293b';
    tooltip.style.color = '#ffffff';
    tooltip.style.padding = '16px';
    tooltip.style.borderRadius = '8px';
    tooltip.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)';
    tooltip.style.zIndex = '999999';
    tooltip.style.maxWidth = '300px';

    const locale = this.options.locale || 'en';
    const labels = {
      ...(DEFAULT_LABELS[locale] || DEFAULT_LABELS.en),
      ...this.options.labels
    };

    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px;">${step.title}</div>
      <div style="margin-bottom: 12px; font-size: 14px; color: #cbd5e1;">${this.parseRichContent(step.content)}</div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 12px; color: #94a3b8;">${this.currentStepIndex + 1}/${this.steps.length}</span>
        <div>
          ${this.currentStepIndex > 0 ? `<button id="btn-prev" style="margin-right: 8px;">${labels.back}</button>` : ''}
          <button id="btn-next">${this.currentStepIndex === this.steps.length - 1 ? labels.finish : labels.next}</button>
        </div>
      </div>
    `;

    document.body.appendChild(tooltip);
    this.tooltipElement = tooltip;

    // Position tooltip near target
    const rect = target.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    const tooltipRect = tooltip.getBoundingClientRect();

    // Default placement: bottom
    let left = rect.left + scrollX + (rect.width - tooltipRect.width) / 2;
    let top = rect.bottom + scrollY + 8;

    if (step.placement === 'top') {
      left = rect.left + scrollX + (rect.width - tooltipRect.width) / 2;
      top = rect.top + scrollY - tooltipRect.height - 8;
    } else if (step.placement === 'left') {
      left = rect.left + scrollX - tooltipRect.width - 8;
      top = rect.top + scrollY + (rect.height - tooltipRect.height) / 2;
    } else if (step.placement === 'right') {
      left = rect.right + scrollX + 8;
      top = rect.top + scrollY + (rect.height - tooltipRect.height) / 2;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    // Listeners
    tooltip.querySelector('#btn-next')?.addEventListener('click', () => this.next());
    tooltip.querySelector('#btn-prev')?.addEventListener('click', () => this.prev());
  }

  private renderCentralModal(step: TourStep): void {
    // Render central modal
    const modal = document.createElement('div');
    modal.id = 'selecto-onboarding-modal';
    modal.style.position = 'fixed';
    modal.style.left = '50%';
    modal.style.top = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = '#1e293b';
    modal.style.color = '#ffffff';
    modal.style.padding = '24px';
    modal.style.borderRadius = '12px';
    modal.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5)';
    modal.style.zIndex = '999999';
    modal.style.maxWidth = '400px';
    modal.style.width = '90%';

    const locale = this.options.locale || 'en';
    const labels = {
      ...(DEFAULT_LABELS[locale] || DEFAULT_LABELS.en),
      ...this.options.labels
    };

    modal.innerHTML = `
      <div style="font-weight: bold; font-size: 18px; margin-bottom: 12px;">${step.title}</div>
      <div style="margin-bottom: 20px; font-size: 14px; color: #cbd5e1; line-height: 1.5;">${this.parseRichContent(step.content)}</div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 12px; color: #94a3b8;">${this.currentStepIndex + 1}/${this.steps.length}</span>
        <div>
          ${this.currentStepIndex > 0 ? `<button id="btn-prev" style="margin-right: 8px;">${labels.back}</button>` : ''}
          <button id="btn-next">${this.currentStepIndex === this.steps.length - 1 ? labels.finish : labels.next}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.tooltipElement = modal;

    modal.querySelector('#btn-next')?.addEventListener('click', () => this.next());
    modal.querySelector('#btn-prev')?.addEventListener('click', () => this.prev());
  }

  private applySpotlight(target: HTMLElement): void {
    // Instantiate ElementInspector to apply backdrop dimming spotlight
    if (!this.overlayInspector) {
      this.overlayInspector = new ElementInspector({
        enableFade: true,
        fadeOpacity: 0.6,
        showLabel: false
      });
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
  }
}

export { OnboardingBuilder, BuilderOptions } from './builder';
