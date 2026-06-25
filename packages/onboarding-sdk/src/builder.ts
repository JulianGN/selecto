import { ElementInspector } from 'selecto-sdk';
import { OnboardingTour, TourStep } from './index';

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
    aiPromptPlaceholder: 'Describe what you want to guide the user through... (e.g., "Fill the input and click save")',
    aiGenerateBtn: 'Generate with AI',
    aiGenerating: 'Processing...',
    aiSuccess: 'Steps generated successfully!',
    aiError: 'Error generating steps: ',
    aiTitle: 'AI Co-Builder Assistant',
    previewTour: 'Preview Tour',
    fieldThemeColor: 'Accent Color',
    fieldThemeBg: 'Modal Background',
    fieldThemeText: 'Text Color'
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
    aiPromptPlaceholder: 'Descreva o que deseja guiar... (ex: "Preencha o campo de texto e clique em salvar")',
    aiGenerateBtn: 'Gerar com IA',
    aiGenerating: 'Processando...',
    aiSuccess: 'Passos gerados com sucesso!',
    aiError: 'Erro ao gerar passos: ',
    aiTitle: 'Assistente de IA Co-Builder',
    previewTour: 'Visualizar Tour',
    fieldThemeColor: 'Cor de Destaque',
    fieldThemeBg: 'Fundo da Modal',
    fieldThemeText: 'Cor do Texto'
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
    aiPromptPlaceholder: 'Describa lo que desea guiar... (ej: "Complete el campo y haga clic en guardar")',
    aiGenerateBtn: 'Generar con IA',
    aiGenerating: 'Procesando...',
    aiSuccess: '¡Pasos generados con éxito!',
    aiError: 'Error al generar pasos: ',
    aiTitle: 'Asistente de IA Co-Builder',
    previewTour: 'Vista Previa',
    fieldThemeColor: 'Color de Acento',
    fieldThemeBg: 'Fundo del Modal',
    fieldThemeText: 'Color del Texto'
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

  private aiPromptText: string = '';
  private isAiGenerating: boolean = false;
  private aiErrorText: string = '';

  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dockLeft: number = -1;
  private dockTop: number = -1;

  private themePrimaryColor: string = '#6366f1';
  private themeBackgroundColor: string = '#0f172a';
  private themeTextColor: string = '#ffffff';
  private tourDescriptionText: string = '';

  constructor(options: BuilderOptions) {
    this.options = options;
    this.steps = options.initialSteps ? [...options.initialSteps] : [];
    this.tourId = options.flowId || this.generateSlug(options.flowName || '');
    this.tourName = options.flowName || '';
    this.tourDescription = options.flowDescription || '';

    try {
      if (this.tourDescription && this.tourDescription.startsWith('{')) {
        const json = JSON.parse(this.tourDescription);
        this.tourDescriptionText = json.text || '';
        this.themePrimaryColor = json.primaryColor || '#6366f1';
        this.themeBackgroundColor = json.backgroundColor || '#0f172a';
        this.themeTextColor = json.textColor || '#ffffff';
      } else {
        this.tourDescriptionText = this.tourDescription || '';
        this.themePrimaryColor = '#6366f1';
        this.themeBackgroundColor = '#0f172a';
        this.themeTextColor = '#ffffff';
      }
    } catch {
      this.tourDescriptionText = this.tourDescription || '';
      this.themePrimaryColor = '#6366f1';
      this.themeBackgroundColor = '#0f172a';
      this.themeTextColor = '#ffffff';
    }
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

    // 4. Listen for ESC key and resize globally
    window.addEventListener('keydown', this.handleGlobalKeyDown);
    window.addEventListener('resize', this.handleWindowResize);
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
    window.removeEventListener('resize', this.handleWindowResize);
  }

  private handleGlobalKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isInspecting) {
      this.cancelInspection();
    }
  };

  private handleWindowResize = (): void => {
    if (!this.shadowRoot) return;
    const dock = this.shadowRoot.querySelector('.selecto-builder-dock') as HTMLElement;
    if (!dock) return;
    
    const rect = dock.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dockWidth = dock.offsetWidth;
    const dockHeight = dock.offsetHeight;
    
    const padding = 10;
    
    if (dock.style.left && dock.style.left !== '50%') {
      let currentLeft = parseFloat(dock.style.left);
      let currentTop = parseFloat(dock.style.top);
      
      if (currentLeft < padding) currentLeft = padding;
      if (currentLeft > viewportWidth - dockWidth - padding) currentLeft = viewportWidth - dockWidth - padding;
      
      if (currentTop < padding) currentTop = padding;
      if (currentTop > viewportHeight - dockHeight - padding) currentTop = viewportHeight - dockHeight - padding;
      
      dock.style.left = `${currentLeft}px`;
      dock.style.top = `${currentTop}px`;
    }
  };

  private setupDragAndDrop(): void {
    if (!this.shadowRoot) return;
    
    const dock = this.shadowRoot.querySelector('.selecto-builder-dock') as HTMLElement;
    const header = this.shadowRoot.querySelector('.dock-header') as HTMLElement;
    if (!dock || !header) return;

    header.style.cursor = 'move';
    header.style.userSelect = 'none';

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.close-dock-btn') || target.tagName === 'BUTTON' || target.closest('button')) {
        return;
      }

      e.preventDefault();
      
      const rect = dock.getBoundingClientRect();
      this.dockLeft = rect.left;
      this.dockTop = rect.top;
      
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      
      dock.style.transform = 'none';
      dock.style.bottom = 'auto';
      dock.style.left = `${this.dockLeft}px`;
      dock.style.top = `${this.dockTop}px`;
      
      const onMouseMove = (moveEv: MouseEvent) => {
        const dx = moveEv.clientX - this.dragStartX;
        const dy = moveEv.clientY - this.dragStartY;
        
        let newLeft = this.dockLeft + dx;
        let newTop = this.dockTop + dy;
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const dockWidth = dock.offsetWidth;
        const dockHeight = dock.offsetHeight;
        
        const padding = 10;
        if (newLeft < padding) newLeft = padding;
        if (newLeft > viewportWidth - dockWidth - padding) newLeft = viewportWidth - dockWidth - padding;
        
        if (newTop < padding) newTop = padding;
        if (newTop > viewportHeight - dockHeight - padding) newTop = viewportHeight - dockHeight - padding;
        
        dock.style.left = `${newLeft}px`;
        dock.style.top = `${newTop}px`;
      };

      const onMouseUp = () => {
        const finalRect = dock.getBoundingClientRect();
        this.dockLeft = finalRect.left;
        this.dockTop = finalRect.top;
        
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    header.addEventListener('mousedown', onMouseDown);
  }

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
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 40px);
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
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
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

      /* AI Assistant Styles */
      .ai-assistant-section {
        background: rgba(99, 102, 241, 0.08);
        border: 1px dashed rgba(99, 102, 241, 0.3);
        border-radius: 12px;
        padding: 10px 12px;
        margin-top: 4px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .ai-assistant-header {
        font-size: 11px;
        font-weight: 700;
        color: #a5b4fc;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .ai-assistant-body {
        display: flex;
        gap: 8px;
      }

      .ai-assistant-body textarea {
        flex: 1;
        background: #090d16;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 6px 10px;
        color: #f1f5f9;
        font-size: 11px;
        outline: none;
        resize: none;
        height: 38px;
        font-family: inherit;
        transition: border-color 0.2s;
      }

      .ai-assistant-body textarea:focus {
        border-color: #818cf8;
      }

      .ai-assistant-body button {
        align-self: flex-end;
        height: 38px;
        white-space: nowrap;
      }

      .ai-assistant-error {
        font-size: 10px;
        color: #f87171;
        background: rgba(239, 68, 68, 0.1);
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid rgba(239, 68, 68, 0.2);
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
            <input type="text" id="flow-desc-input" value="${this.tourDescriptionText}" placeholder="Brief introduction...">
          </div>
          
          <div class="form-grid" style="margin-top: 4px; grid-template-cols: 1fr 1fr 1fr; gap: 8px;">
            <div class="form-row">
              <label>${this.getTranslation('fieldThemeColor')}</label>
              <input type="color" id="flow-theme-primary-input" value="${this.themePrimaryColor}" style="height: 30px; padding: 2px; cursor: pointer; width: 100%; border-radius: 6px; background: #090d16; border: 1px solid rgba(255,255,255,0.1);">
            </div>
            <div class="form-row">
              <label>${this.getTranslation('fieldThemeBg')}</label>
              <input type="color" id="flow-theme-bg-input" value="${this.themeBackgroundColor}" style="height: 30px; padding: 2px; cursor: pointer; width: 100%; border-radius: 6px; background: #090d16; border: 1px solid rgba(255,255,255,0.1);">
            </div>
            <div class="form-row">
              <label>${this.getTranslation('fieldThemeText')}</label>
              <input type="color" id="flow-theme-text-input" value="${this.themeTextColor}" style="height: 30px; padding: 2px; cursor: pointer; width: 100%; border-radius: 6px; background: #090d16; border: 1px solid rgba(255,255,255,0.1);">
            </div>
          </div>
          
          <div class="ai-assistant-section">
            <div class="ai-assistant-header">✨ ${this.getTranslation('aiTitle')}</div>
            <div class="ai-assistant-body">
              <textarea id="ai-prompt-input" placeholder="${this.getTranslation('aiPromptPlaceholder')}">${this.aiPromptText}</textarea>
              <button class="btn btn-primary btn-sm" id="ai-generate-btn" ${this.isAiGenerating ? 'disabled' : ''}>
                ${this.isAiGenerating ? this.getTranslation('aiGenerating') : this.getTranslation('aiGenerateBtn')}
              </button>
            </div>
            ${this.aiErrorText ? `<div class="ai-assistant-error">${this.aiErrorText}</div>` : ''}
          </div>
          
          <div class="steps-section-header">Steps Layout</div>
          ${stepsHtml}
        </div>
        <div class="dock-footer">
          <button class="btn btn-secondary btn-sm" id="preview-tour-btn">${this.getTranslation('previewTour')}</button>
          <button class="btn btn-secondary btn-sm" id="add-modal-step-btn">+ Add Modal</button>
          <button class="btn btn-secondary btn-sm" id="add-element-step-btn">${this.getTranslation('addStep')}</button>
          <button class="btn btn-primary btn-sm" id="save-flow-btn" ${this.isSaving ? 'disabled' : ''}>
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

      this.shadowRoot.getElementById('preview-tour-btn')?.addEventListener('click', () => {
        this.previewTour();
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
      const themePrimaryInput = this.shadowRoot.getElementById('flow-theme-primary-input') as HTMLInputElement;
      const themeBgInput = this.shadowRoot.getElementById('flow-theme-bg-input') as HTMLInputElement;
      const themeTextInput = this.shadowRoot.getElementById('flow-theme-text-input') as HTMLInputElement;

      slugInput?.addEventListener('input', () => this.tourId = slugInput.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'));
      nameInput?.addEventListener('input', () => this.tourName = nameInput.value);
      descInput?.addEventListener('input', () => this.tourDescriptionText = descInput.value);
      themePrimaryInput?.addEventListener('input', () => {
        this.themePrimaryColor = themePrimaryInput.value;
        if (this.inspector) {
          this.inspector.setHighlightColor(this.themePrimaryColor);
        }
      });
      themeBgInput?.addEventListener('input', () => this.themeBackgroundColor = themeBgInput.value);
      themeTextInput?.addEventListener('input', () => this.themeTextColor = themeTextInput.value);

      // AI assistant listeners
      const aiPromptInput = this.shadowRoot.getElementById('ai-prompt-input') as HTMLTextAreaElement;
      const aiGenerateBtn = this.shadowRoot.getElementById('ai-generate-btn') as HTMLButtonElement;

      aiPromptInput?.addEventListener('input', () => {
        this.aiPromptText = aiPromptInput.value;
      });

      aiGenerateBtn?.addEventListener('click', () => {
        this.handleAiGeneration();
      });

      // Setup drag and drop for the dock
      this.setupDragAndDrop();
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
        highlightColor: this.themePrimaryColor,
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
    } else {
      this.inspector.setHighlightColor(this.themePrimaryColor);
    }
    
    // Start highlighting elements
    this.inspector.start();
  }

  private previewTour(): void {
    if (this.steps.length === 0) {
      alert(this.getTranslation('noSteps'));
      return;
    }

    // Hide visual builder dock
    const dock = this.shadowRoot?.querySelector('.selecto-builder-dock') as HTMLElement;
    if (dock) {
      dock.style.display = 'none';
    }

    // Instantiate and start tour
    const tour = new OnboardingTour({
      locale: this.options.locale,
      theme: {
        primaryColor: this.themePrimaryColor,
        backgroundColor: this.themeBackgroundColor,
        textColor: this.themeTextColor
      },
      steps: this.steps.map((step, idx) => ({
        ...step,
        stepIndex: idx
      })),
      onComplete: () => {
        if (dock) dock.style.display = 'flex';
      },
      onSkip: () => {
        if (dock) dock.style.display = 'flex';
      }
    });

    tour.start();
  }

  private cancelInspection(): void {
    if (this.inspector) {
      this.inspector.stop();
    }
    this.isInspecting = false;
    this.render();
  }

  private getSemanticDOMMap(): any[] {
    const map: any[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node: Node) => {
          const el = node as HTMLElement;
          // Skip the builder's own elements and system scripts
          if (
            el.id === 'selecto-onboarding-builder-container' ||
            el.id === 'selecto-onboarding-container' ||
            el.closest('#selecto-onboarding-builder-container') ||
            el.closest('#selecto-onboarding-container') ||
            ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'TEMPLATE'].includes(el.tagName)
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Accept elements that are interactive or have semantic attributes
          const isInteractive = 
            ['BUTTON', 'INPUT', 'A', 'SELECT', 'TEXTAREA'].includes(el.tagName) ||
            el.hasAttribute('onclick') ||
            el.hasAttribute('role') ||
            el.hasAttribute('data-testid') ||
            el.hasAttribute('data-onboarding-id') ||
            el.hasAttribute('data-tour-step') ||
            el.style.cursor === 'pointer';
            
          return isInteractive ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );

    let currentNode = walker.nextNode();
    let index = 0;
    while (currentNode) {
      const el = currentNode as HTMLElement;
      
      let selector = '';
      if (el.getAttribute('data-onboarding-id')) {
        selector = `[data-onboarding-id="${el.getAttribute('data-onboarding-id')}"]`;
      } else if (el.getAttribute('data-testid')) {
        selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
      } else if (el.getAttribute('data-qa')) {
        selector = `[data-qa="${el.getAttribute('data-qa')}"]`;
      } else if (el.id) {
        selector = `#${el.id}`;
      } else {
        const tagName = el.tagName.toLowerCase();
        if (el.className && typeof el.className === 'string') {
          const firstClass = el.className.split(/\s+/)[0];
          if (firstClass && !firstClass.startsWith('hover:') && !firstClass.startsWith('focus:')) {
            selector = `${tagName}.${firstClass}`;
          }
        }
        if (!selector) {
          selector = tagName;
        }
      }

      const ariaLabel = el.getAttribute('aria-label') || '';
      const text = el.innerText ? el.innerText.trim().substring(0, 100) : '';
      const placeholder = el.getAttribute('placeholder') || '';
      const testid = el.getAttribute('data-testid') || el.getAttribute('data-onboarding-id') || '';
      const role = el.getAttribute('role') || '';
      const name = el.getAttribute('name') || '';

      map.push({
        id: index++,
        tag: el.tagName,
        selector,
        text,
        placeholder,
        ariaLabel,
        testid,
        role,
        name
      });

      currentNode = walker.nextNode();
    }

    return map;
  }

  private generateHeuristicSteps(prompt: string, map: any[]): TourStep[] {
    const steps: TourStep[] = [];
    
    // Split prompt by step connectors/transition words (PT, EN, ES)
    const splitRegex = /\b(?:then|afterwards|next|depois|então|em seguida|después|luego|entonces|e depois|y después|e em seguida|a continuación)\b/i;
    const segments = prompt.split(splitRegex).map(s => s.trim()).filter(Boolean);
    
    // Multilingual dictionary of action synonyms
    const actionSynonyms: Record<string, string[]> = {
      create: [
        'criar', 'cadastrar', 'adicionar', 'novo', 'new', 'create', 'add', 'crear', 'añadir', 'nuevo', 'registrar',
        '+', 'plus', 'add-btn', 'create-btn', 'novo-btn'
      ],
      save: [
        'salvar', 'enviar', 'confirmar', 'guardar', 'save', 'submit', 'confirm', 'registrar', 'ok', 'concluir',
        'salvar-btn', 'save-btn', 'submit-btn'
      ],
      input: [
        'digitar', 'escrever', 'inserir', 'campo', 'texto', 'nome', 'descrição', 'email', 'senha',
        'type', 'write', 'enter', 'input', 'text', 'name', 'description', 'password',
        'escribir', 'insertar', 'nombre', 'correo', 'contraseña'
      ]
    };

    segments.forEach((segment, segmentIdx) => {
      const segmentLower = segment.toLowerCase();
      let bestElement: any = null;
      let highestScore = -1;

      const segmentWords = segmentLower.split(/\s+/).filter(w => w.length > 2);

      map.forEach(el => {
        let score = 0;
        const elText = (el.text || '').toLowerCase();
        const elPlaceholder = (el.placeholder || '').toLowerCase();
        const elAria = (el.ariaLabel || '').toLowerCase();
        const elTestid = (el.testid || '').toLowerCase();
        const elName = (el.name || '').toLowerCase();
        const elSelector = el.selector.toLowerCase();

        // 1. Direct text matches
        segmentWords.forEach(word => {
          if (elTestid.includes(word)) score += 10;
          if (elAria.includes(word)) score += 8;
          if (elText.includes(word)) score += 6;
          if (elPlaceholder.includes(word)) score += 5;
          if (elName.includes(word)) score += 4;
          if (elSelector.includes(word)) score += 2;
        });

        // 2. Classify intent
        let segmentIntent: 'create' | 'save' | 'input' | null = null;
        if (actionSynonyms.create.some(syn => segmentLower.includes(syn))) {
          segmentIntent = 'create';
        } else if (actionSynonyms.save.some(syn => segmentLower.includes(syn))) {
          segmentIntent = 'save';
        } else if (actionSynonyms.input.some(syn => segmentLower.includes(syn))) {
          segmentIntent = 'input';
        }

        // 3. Match synonyms
        if (segmentIntent) {
          const synonyms = actionSynonyms[segmentIntent];
          const matchesSynonym = synonyms.some(syn => 
            elText.includes(syn) || 
            elTestid.includes(syn) || 
            elAria.includes(syn) || 
            elPlaceholder.includes(syn) ||
            elSelector.includes(syn)
          );

          if (matchesSynonym) {
            score += 15;
            if (segmentIntent === 'input' && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tag)) {
              score += 10;
            } else if ((segmentIntent === 'create' || segmentIntent === 'save') && ['BUTTON', 'A'].includes(el.tag)) {
              score += 10;
            }
          }
        }

        // Penalty for empty links
        if (score > 0 && el.tag === 'A' && !elText && !elAria && !elTestid) {
          score -= 10;
        }

        if (score > highestScore) {
          highestScore = score;
          bestElement = el;
        }
      });

      const hasGoodMatch = highestScore > 5 && bestElement;
      
      let stepTitle = '';
      if (hasGoodMatch) {
        if (bestElement.tag === 'INPUT' || bestElement.tag === 'TEXTAREA') {
          stepTitle = bestElement.text || bestElement.placeholder || 'Fill field';
        } else {
          stepTitle = bestElement.text || 'Click element';
        }
      } else {
        stepTitle = `Step ${segmentIdx + 1}`;
      }
      
      if (stepTitle.length > 25) {
        stepTitle = stepTitle.substring(0, 22) + '...';
      }
        
      const stepContent = segment.charAt(0).toUpperCase() + segment.slice(1);
      const uniqueId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : `step-${Math.random().toString(36).substring(2, 9)}`;

      const step: TourStep = {
        id: uniqueId,
        title: stepTitle,
        content: stepContent,
        targetSelector: hasGoodMatch ? bestElement.selector : undefined,
        placement: hasGoodMatch ? 'bottom' : 'center'
      };

      steps.push(step);
    });

    return steps;
  }

  private async generateWithGeminiNano(prompt: string, map: any[]): Promise<TourStep[]> {
    const ai = (window as any).ai;
    if (!ai || !ai.languageModel) {
      throw new Error('Chrome Built-in AI is not supported in this browser.');
    }

    const capabilities = await ai.languageModel.capabilities();
    if (capabilities.available === 'no') {
      throw new Error('Gemini Nano is not ready or disabled.');
    }

    // Limit context length
    const compactMap = map.slice(0, 40).map(el => ({
      tag: el.tag,
      text: el.text,
      placeholder: el.placeholder,
      testid: el.testid,
      selector: el.selector
    }));

    const systemPrompt = `You are a product onboarding helper. Given a user prompt and a list of active page elements, you must construct a step-by-step onboarding walkthrough tour.
For each step, choose the most appropriate target element from the list. If no element matches, use a center-aligned modal (do not specify a targetSelector).
Respond ONLY with a valid JSON array of TourStep objects matching this TypeScript interface:
interface TourStep {
  title: string; // Brief instruction title (max 4 words)
  content: string; // Instructive paragraph for the user
  targetSelector?: string; // CSS selector of the element, OR omit for central modal
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
}
Do not wrap your response in markdown code blocks. Return only the raw JSON string. Ensure the JSON is valid.`;

    const userInstructions = `User Prompt: "${prompt}"

Active Page Elements:
${JSON.stringify(compactMap)}`;

    const session = await ai.languageModel.create({
      systemPrompt: systemPrompt,
      temperature: 0.1,
      topK: 3
    });

    try {
      const response = await session.prompt(userInstructions);
      
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
      }
      
      const steps = JSON.parse(cleanResponse);
      if (!Array.isArray(steps)) {
        throw new Error('AI response is not an array.');
      }
      
      return steps.map((step: any) => {
        const uniqueId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
          ? crypto.randomUUID() 
          : `step-${Math.random().toString(36).substring(2, 9)}`;

        return {
          id: uniqueId,
          title: step.title || 'Step',
          content: step.content || '',
          targetSelector: step.targetSelector,
          placement: step.placement || 'bottom'
        };
      });
    } finally {
      session.destroy();
    }
  }

  private async handleAiGeneration(): Promise<void> {
    if (!this.aiPromptText.trim()) return;

    this.isAiGenerating = true;
    this.aiErrorText = '';
    this.render();

    try {
      const domMap = this.getSemanticDOMMap();
      let steps: TourStep[] = [];

      try {
        steps = await this.generateWithGeminiNano(this.aiPromptText, domMap);
      } catch (nanoError) {
        console.warn('Gemini Nano failed, falling back to heuristics:', nanoError);
        steps = this.generateHeuristicSteps(this.aiPromptText, domMap);
      }

      if (steps.length > 0) {
        this.steps = [...this.steps, ...steps];
        this.aiPromptText = '';
      } else {
        throw new Error('No steps could be generated.');
      }
    } catch (e: any) {
      this.aiErrorText = this.getTranslation('aiError') + e.message;
    } finally {
      this.isAiGenerating = false;
      this.render();
    }
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

    const descriptionJson = JSON.stringify({
      text: this.tourDescriptionText,
      primaryColor: this.themePrimaryColor,
      backgroundColor: this.themeBackgroundColor,
      textColor: this.themeTextColor
    });

    const payload = {
      id: this.tourId,
      name: this.tourName,
      description: descriptionJson,
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
