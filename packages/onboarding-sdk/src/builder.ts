import { ElementInspector } from 'selecto-sdk';
import { TourStep } from './index';

export interface BuilderOptions {
  dashboardUrl: string;
  flowId?: string;
  flowName?: string;
  flowDescription?: string;
  initialSteps?: TourStep[];
  locale?: 'en' | 'pt-BR' | 'es' | string;
  onSave?: (flowId: string) => void;
  onClose?: () => void;
}

const LOCALES: Record<string, any> = {
  en: {
    title: 'Selecto Visual Builder',
    tourId: 'Tour ID (Slug)',
    tourName: 'Tour Name',
    tourDescription: 'Description',
    addStep: '+ Add Step',
    saveTour: 'Save Tour',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    stepTitle: 'Step Title',
    stepContent: 'Step Content / Description',
    stepPlacement: 'Placement',
    confirm: 'Confirm',
    inspecting: 'Click on any element to select it (Press ESC to cancel)',
    savedSuccess: 'Tour saved successfully!',
    saveError: 'Error saving tour: ',
    noSteps: 'No steps added yet. Click "+ Add Step" below.',
    placementBottom: 'Bottom',
    placementTop: 'Top',
    placementLeft: 'Left',
    placementRight: 'Right',
    placementCenter: 'Center Modal',
    saving: 'Saving...',
  },
  'pt-BR': {
    title: 'Criador de Tour Selecto',
    tourId: 'ID do Tour (Slug)',
    tourName: 'Nome do Tour',
    tourDescription: 'Descrição',
    addStep: '+ Adicionar Passo',
    saveTour: 'Salvar Tour',
    cancel: 'Cancelar',
    edit: 'Editar',
    delete: 'Excluir',
    stepTitle: 'Título do Passo',
    stepContent: 'Conteúdo / Descrição',
    stepPlacement: 'Posicionamento',
    confirm: 'Confirmar',
    inspecting: 'Clique em qualquer elemento para selecionar (Pressione ESC para cancelar)',
    savedSuccess: 'Tour salvo com sucesso!',
    saveError: 'Erro ao salvar o tour: ',
    noSteps: 'Nenhum passo adicionado. Clique em "+ Adicionar Passo".',
    placementBottom: 'Abaixo (Bottom)',
    placementTop: 'Acima (Top)',
    placementLeft: 'Esquerda (Left)',
    placementRight: 'Direita (Right)',
    placementCenter: 'Centralizado (Center Modal)',
    saving: 'Salvando...',
  },
  es: {
    title: 'Creador de Tour Selecto',
    tourId: 'ID del Tour (Slug)',
    tourName: 'Nombre del Tour',
    tourDescription: 'Descripción',
    addStep: '+ Agregar Paso',
    saveTour: 'Guardar Tour',
    cancel: 'Cancelar',
    edit: 'Editar',
    delete: 'Eliminar',
    stepTitle: 'Título del Paso',
    stepContent: 'Contenido / Descripción',
    stepPlacement: 'Posición',
    confirm: 'Confirmar',
    inspecting: 'Haga clic en cualquier elemento para seleccionar (Presione ESC para cancelar)',
    savedSuccess: '¡Tour guardado con éxito!',
    saveError: 'Error al guardar el tour: ',
    noSteps: 'No se han agregado pasos. Haga clic en "+ Agregar Paso".',
    placementBottom: 'Abajo (Bottom)',
    placementTop: 'Arriba (Top)',
    placementLeft: 'Izquierda (Left)',
    placementRight: 'Derecha (Right)',
    placementCenter: 'Centro (Center Modal)',
    saving: 'Guardando...',
  }
};

export class OnboardingBuilder {
  private options: BuilderOptions;
  private steps: TourStep[] = [];
  private tourId: string = '';
  private tourName: string = '';
  private tourDescription: string = '';
  private active: boolean = false;
  
  private containerElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private inspector: any = null;
  
  private isInspecting: boolean = false;
  private isSaving: boolean = false;
  private editingStepIndex: number | null = null;

  constructor(options: BuilderOptions) {
    this.options = options;
    this.steps = options.initialSteps ? [...options.initialSteps] : [];
    this.tourId = options.flowId || this.generateSlug(options.flowName || '');
    this.tourName = options.flowName || '';
    this.tourDescription = options.flowDescription || '';
  }

  private generateSlug(text: string): string {
    if (!text) return `tour-${Math.random().toString(36).substring(2, 9)}`;
    return text.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  }

  private getTranslation(key: string): string {
    const locale = this.options.locale || 'en';
    const dict = LOCALES[locale] || LOCALES.en;
    return dict[key] || LOCALES.en[key] || key;
  }

  public start(): void {
    if (this.active) return;
    this.active = true;
    
    // 1. Create main container on body
    this.containerElement = document.createElement('div');
    this.containerElement.id = 'selecto-onboarding-builder-container';
    this.containerElement.style.position = 'fixed';
    this.containerElement.style.zIndex = '2147483647';
    document.body.appendChild(this.containerElement);

    // 2. Attach Shadow DOM
    this.shadowRoot = this.containerElement.attachShadow({ mode: 'open' });

    // 3. Inject styles and initial markup
    this.injectStyles();
    this.render();

    // 4. Listen for ESC key globally for cancellation during inspection
    window.addEventListener('keydown', this.handleGlobalKeyDown);
  }

  public stop(): void {
    if (!this.active) return;
    this.active = false;
    
    if (this.inspector) {
      this.inspector.stop();
      this.inspector = null;
    }
    
    if (this.containerElement) {
      this.containerElement.remove();
      this.containerElement = null;
      this.shadowRoot = null;
    }

    window.removeEventListener('keydown', this.handleGlobalKeyDown);
  }

  private handleGlobalKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isInspecting) {
      this.cancelInspection();
    }
  };

  private injectStyles(): void {
    if (!this.shadowRoot) return;
    
    const style = document.createElement('style');
    style.textContent = `
      .selecto-builder-dock {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: 440px;
        max-height: 480px;
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
        color: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .dock-header {
        padding: 14px 16px;
        background: rgba(30, 41, 59, 0.5);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .dock-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        background: linear-gradient(90deg, #a5b4fc, #c084fc);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .close-dock-btn {
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 16px;
        padding: 4px;
        line-height: 1;
        transition: color 0.2s;
      }
      .close-dock-btn:hover {
        color: #f1f5f9;
      }

      .dock-body {
        padding: 16px;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .form-row {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .form-row label {
        font-size: 11px;
        font-weight: 700;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .form-row input, .form-row select, .form-row textarea {
        background: #090d16;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 8px 12px;
        color: #f1f5f9;
        font-size: 12px;
        outline: none;
        transition: border-color 0.2s;
      }

      .form-row input:focus, .form-row select:focus, .form-row textarea:focus {
        border-color: #6366f1;
      }

      .form-grid {
        display: grid;
        grid-template-cols: 1fr 1fr;
        gap: 12px;
      }

      .steps-section-header {
        font-size: 11px;
        font-weight: 700;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-top: 8px;
      }

      .steps-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 180px;
        overflow-y: auto;
        padding-right: 4px;
      }

      .no-steps-placeholder {
        padding: 20px;
        text-align: center;
        color: #64748b;
        font-size: 12px;
        border: 1px dashed rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        background: rgba(255,255,255,0.01);
      }

      .step-item {
        background: rgba(30, 41, 59, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 8px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }

      .step-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }

      .step-badge {
        background: rgba(99, 102, 241, 0.15);
        color: #a5b4fc;
        border: 1px solid rgba(99, 102, 241, 0.3);
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        font-weight: 700;
      }

      .step-title-text {
        font-weight: 600;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .step-actions {
        display: flex;
        gap: 4px;
      }

      .btn {
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 600;
        border: none;
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .btn-primary {
        background: #6366f1;
        color: #fff;
      }
      .btn-primary:hover {
        background: #4f46e5;
      }
      .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-secondary {
        background: rgba(255, 255, 255, 0.08);
        color: #f1f5f9;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.12);
      }

      .btn-danger {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
      }
      .btn-danger:hover {
        background: rgba(239, 68, 68, 0.25);
      }

      .btn-sm {
        padding: 4px 8px;
        font-size: 10px;
        border-radius: 6px;
      }

      .dock-footer {
        padding: 12px 16px;
        background: rgba(30, 41, 59, 0.3);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }

      .selecto-inspecting-banner {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #6366f1;
        color: #fff;
        padding: 10px 24px;
        border-radius: 30px;
        font-size: 12px;
        font-weight: 700;
        box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.5);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .selecto-step-editor-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 380px;
        background: #1e293b;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        color: #f8fafc;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }

      .editor-header {
        padding: 14px 16px;
        background: rgba(15, 23, 42, 0.4);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        font-weight: 700;
        font-size: 13px;
        text-transform: uppercase;
        color: #94a3b8;
        letter-spacing: 0.05em;
      }

      .editor-body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .editor-footer {
        padding: 12px 16px;
        background: rgba(15, 23, 42, 0.4);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      /* Scrollbar */
      ::-webkit-scrollbar {
        width: 6px;
      }
      ::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.02);
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 3px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.25);
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  private render(): void {
    if (!this.shadowRoot) return;
    
    // Clear old elements if rendering updates
    const existingDock = this.shadowRoot.querySelector('.selecto-builder-dock');
    const existingBanner = this.shadowRoot.querySelector('.selecto-inspecting-banner');
    const existingModal = this.shadowRoot.querySelector('.selecto-step-editor-modal');

    if (existingDock) existingDock.remove();
    if (existingBanner) existingBanner.remove();
    if (existingModal) existingModal.remove();

    if (this.isInspecting) {
      // 1. Render element picking banner
      const banner = document.createElement('div');
      banner.className = 'selecto-inspecting-banner';
      banner.innerHTML = `
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#fff; animate:pulse 1s infinite;"></span>
        <span>${this.getTranslation('inspecting')}</span>
      `;
      this.shadowRoot.appendChild(banner);
    } else if (this.editingStepIndex !== null) {
      // 2. Render Step Editor Modal
      const step = this.steps[this.editingStepIndex];
      const modal = document.createElement('div');
      modal.className = 'selecto-step-editor-modal';
      modal.innerHTML = `
        <div class="editor-header">
          ${step.targetSelector ? 'Inspect Element Step' : 'Modal Dialog Step'}
        </div>
        <div class="editor-body">
          <div class="form-row">
            <label>${this.getTranslation('stepTitle')}</label>
            <input type="text" id="step-title-input" value="${step.title}" placeholder="Step name">
          </div>
          <div class="form-row">
            <label>${this.getTranslation('stepContent')}</label>
            <textarea id="step-content-input" rows="3" placeholder="Description of the action...">${step.content}</textarea>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label>${this.getTranslation('stepPlacement')}</label>
              <select id="step-placement-input">
                <option value="bottom" ${step.placement === 'bottom' ? 'selected' : ''}>${this.getTranslation('placementBottom')}</option>
                <option value="top" ${step.placement === 'top' ? 'selected' : ''}>${this.getTranslation('placementTop')}</option>
                <option value="left" ${step.placement === 'left' ? 'selected' : ''}>${this.getTranslation('placementLeft')}</option>
                <option value="right" ${step.placement === 'right' ? 'selected' : ''}>${this.getTranslation('placementRight')}</option>
                <option value="center" ${step.placement === 'center' ? 'selected' : ''}>${this.getTranslation('placementCenter')}</option>
              </select>
            </div>
            ${step.targetSelector ? `
              <div class="form-row">
                <label>Selector</label>
                <input type="text" id="step-selector-input" value="${step.targetSelector}" readonly style="background: rgba(255,255,255,0.05); color: #cbd5e1; font-family: monospace; font-size: 10px;">
              </div>
            ` : ''}
          </div>
        </div>
        <div class="editor-footer">
          <button class="btn btn-secondary btn-sm" id="editor-cancel-btn">${this.getTranslation('cancel')}</button>
          <button class="btn btn-primary btn-sm" id="editor-save-btn">${this.getTranslation('confirm')}</button>
        </div>
      `;

      this.shadowRoot.appendChild(modal);

      // Bind events
      this.shadowRoot.getElementById('editor-cancel-btn')?.addEventListener('click', () => {
        // If we were adding a new step and cancelled, remove it
        if (this.steps[this.editingStepIndex!] && !this.steps[this.editingStepIndex!].title && !this.steps[this.editingStepIndex!].content) {
          this.steps.splice(this.editingStepIndex!, 1);
        }
        this.editingStepIndex = null;
        this.render();
      });

      this.shadowRoot.getElementById('editor-save-btn')?.addEventListener('click', () => {
        const titleInput = this.shadowRoot!.getElementById('step-title-input') as HTMLInputElement;
        const contentInput = this.shadowRoot!.getElementById('step-content-input') as HTMLTextAreaElement;
        const placementInput = this.shadowRoot!.getElementById('step-placement-input') as HTMLSelectElement;

        if (this.editingStepIndex !== null) {
          this.steps[this.editingStepIndex] = {
            ...this.steps[this.editingStepIndex],
            title: titleInput.value.trim() || `Step ${this.editingStepIndex + 1}`,
            content: contentInput.value.trim(),
            placement: placementInput.value as any
          };
        }

        this.editingStepIndex = null;
        this.render();
      });

    } else {
      // 3. Render Main Floating Dock
      const dock = document.createElement('div');
      dock.className = 'selecto-builder-dock';
      
      const stepsHtml = this.steps.length === 0 
        ? `<div class="no-steps-placeholder">${this.getTranslation('noSteps')}</div>`
        : `<div class="steps-list">
            ${this.steps.map((step, idx) => `
              <div class="step-item">
                <div class="step-meta">
                  <span class="step-badge">${idx + 1}</span>
                  <span class="step-title-text" title="${step.title}">${step.title}</span>
                </div>
                <div class="step-actions">
                  <button class="btn btn-secondary btn-sm edit-step-btn" data-index="${idx}">${this.getTranslation('edit')}</button>
                  <button class="btn btn-danger btn-sm delete-step-btn" data-index="${idx}">${this.getTranslation('delete')}</button>
                </div>
              </div>
            `).join('')}
          </div>`;

      dock.innerHTML = `
        <div class="dock-header">
          <h3>${this.getTranslation('title')}</h3>
          <button class="close-dock-btn" id="close-dock-x-btn">✕</button>
        </div>
        <div class="dock-body">
          <div class="form-grid">
            <div class="form-row">
              <label>${this.getTranslation('tourId')}</label>
              <input type="text" id="flow-slug-input" value="${this.tourId}" placeholder="slug-code" ${this.options.flowId ? 'readonly' : ''}>
            </div>
            <div class="form-row">
              <label>${this.getTranslation('tourName')}</label>
              <input type="text" id="flow-name-input" value="${this.tourName}" placeholder="e.g. Dashboard Tour">
            </div>
          </div>
          <div class="form-row">
            <label>${this.getTranslation('tourDescription')}</label>
            <input type="text" id="flow-desc-input" value="${this.tourDescription}" placeholder="Brief introduction...">
          </div>
          
          <div class="steps-section-header">Steps Layout</div>
          ${stepsHtml}
        </div>
        <div class="dock-footer">
          <button class="btn btn-secondary" id="add-modal-step-btn">+ Add Modal</button>
          <button class="btn btn-secondary" id="add-element-step-btn">${this.getTranslation('addStep')}</button>
          <button class="btn btn-primary" id="save-flow-btn" ${this.isSaving ? 'disabled' : ''}>
            ${this.isSaving ? this.getTranslation('saving') : this.getTranslation('saveTour')}
          </button>
        </div>
      `;

      this.shadowRoot.appendChild(dock);

      // Bind events
      this.shadowRoot.getElementById('close-dock-x-btn')?.addEventListener('click', () => {
        this.stop();
        this.options.onClose?.();
      });

      this.shadowRoot.getElementById('add-modal-step-btn')?.addEventListener('click', () => {
        const newStep: TourStep = {
          id: crypto.randomUUID(),
          title: `Step ${this.steps.length + 1}`,
          content: '',
          placement: 'center'
        };
        this.steps.push(newStep);
        this.editingStepIndex = this.steps.length - 1;
        this.render();
      });

      this.shadowRoot.getElementById('add-element-step-btn')?.addEventListener('click', () => {
        this.startInspection();
      });

      this.shadowRoot.getElementById('save-flow-btn')?.addEventListener('click', () => {
        this.saveTour();
      });

      // Bind dynamic step actions
      this.shadowRoot.querySelectorAll('.edit-step-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt((e.target as HTMLElement).getAttribute('data-index') || '0');
          this.editingStepIndex = idx;
          this.render();
        });
      });

      this.shadowRoot.querySelectorAll('.delete-step-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt((e.target as HTMLElement).getAttribute('data-index') || '0');
          this.steps.splice(idx, 1);
          this.render();
        });
      });

      // Synchronize flow input metadata values on change
      const slugInput = this.shadowRoot.getElementById('flow-slug-input') as HTMLInputElement;
      const nameInput = this.shadowRoot.getElementById('flow-name-input') as HTMLInputElement;
      const descInput = this.shadowRoot.getElementById('flow-desc-input') as HTMLInputElement;

      slugInput?.addEventListener('input', () => this.tourId = slugInput.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'));
      nameInput?.addEventListener('input', () => this.tourName = nameInput.value);
      descInput?.addEventListener('input', () => this.tourDescription = descInput.value);
    }
  }

  private startInspection(): void {
    if (!this.shadowRoot) return;
    this.isInspecting = true;
    this.render();

    if (!this.inspector) {
      this.inspector = new ElementInspector({
        enableFade: true,
        fadeOpacity: 0.6,
        showLabel: true,
        onSelect: (el: Element, selectorData: { css: string }) => {
          this.inspector.stop();
          this.isInspecting = false;
          
          // Append new element step
          const newStep: TourStep = {
            id: crypto.randomUUID(),
            title: `Step ${this.steps.length + 1}`,
            content: '',
            targetSelector: selectorData.css,
            placement: 'bottom'
          };
          
          this.steps.push(newStep);
          this.editingStepIndex = this.steps.length - 1;
          this.render();
        }
      });
    }
    
    // Start highlighting elements
    this.inspector.start();
  }

  private cancelInspection(): void {
    if (this.inspector) {
      this.inspector.stop();
    }
    this.isInspecting = false;
    this.render();
  }

  private async saveTour(): Promise<void> {
    if (!this.tourId || !this.tourName.trim()) {
      alert('Tour Slug/ID and Tour Name are required.');
      return;
    }

    this.isSaving = true;
    this.render();

    const formattedSteps = this.steps.map((step, idx) => ({
      ...step,
      stepIndex: idx
    }));

    const payload = {
      id: this.tourId,
      name: this.tourName,
      description: this.tourDescription,
      isActive: true,
      steps: formattedSteps
    };

    try {
      const response = await fetch(`${this.options.dashboardUrl}/api/v1/flows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      this.isSaving = false;

      if (result.success) {
        alert(this.getTranslation('savedSuccess'));
        this.options.onSave?.(this.tourId);
      } else {
        alert(this.getTranslation('saveError') + result.error);
      }
    } catch (e: any) {
      this.isSaving = false;
      alert(this.getTranslation('saveError') + e.message);
    }
    
    this.render();
  }
}
