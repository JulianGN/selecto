"use client";

import { useState, useEffect } from "react";
import { 
  Play, 
  Plus, 
  Trash2, 
  Edit2, 
  Settings, 
  Layers, 
  BarChart3, 
  CheckCircle, 
  X, 
  ArrowUp, 
  ArrowDown, 
  ChevronRight, 
  BookOpen, 
  HelpCircle,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { deleteFlowAction, toggleFlowAction, saveFlowAction } from "./actions";
import { translations } from "./translations";

export interface Step {
  id?: string;
  title: string;
  content: string;
  targetSelector?: string | null;
  placement: string;
  stepIndex: number;
}

export interface Flow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  steps: Step[];
  createdAt: string;
  updatedAt: string;
}

interface ImportedItem {
  name?: string;
  tag?: string;
  text?: string;
  css?: string;
  activeLocator?: string;
}

interface Stats {
  totalFlows: number;
  activeFlows: number;
  totalSteps: number;
  totalEvents: number;
}

function parseInlineMarkdown(text: string): string {
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

function parseRichContent(content: string): string {
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
      const inlineParsed = parseInlineMarkdown(itemContent);
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
      const inlineParsed = parseInlineMarkdown(itemContent);
      return `<div style="display: flex; gap: 8px; margin: 4px 0; align-items: flex-start;">
        <span style="color: #818cf8; font-weight: bold; font-size: 0.9em; line-height: 1.25;">${num}.</span>
        <span style="flex: 1;">${inlineParsed}</span>
      </div>`;
    }

    // Paragraph spacer
    if (trimmed === "") {
      return `<div style="height: 8px;"></div>`;
    }

    return parseInlineMarkdown(line);
  });

  return parsedLines.join('\n');
}

function displayDescription(desc: string | null): string {
  if (!desc) return "";
  if (desc.startsWith("{")) {
    try {
      const parsed = JSON.parse(desc);
      return parsed.text || "";
    } catch {
      return desc;
    }
  }
  return desc;
}

interface DashboardClientProps {
  initialFlows: Flow[];
  initialStats: Stats;
}

export default function DashboardClient({ initialFlows, initialStats }: DashboardClientProps) {
  const [flows, setFlows] = useState<Flow[]>(initialFlows);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<Partial<Flow> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "raw">("visual");
  const [rawImportText, setRawImportText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [flowDescriptionText, setFlowDescriptionText] = useState("");
  const [flowThemeColor, setFlowThemeColor] = useState("#6366f1");
  const [flowThemeBg, setFlowThemeBg] = useState("#0f172a");
  const [flowThemeText, setFlowThemeText] = useState("#ffffff");

  const [locale, setLocale] = useState<"en" | "pt-br" | "es">("en");
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  useEffect(() => {
    const savedLocale = localStorage.getItem("selecto_dashboard_locale");
    const targetLocale = (savedLocale === "en" || savedLocale === "pt-br" || savedLocale === "es")
      ? savedLocale
      : (() => {
          const browserLang = navigator.language.toLowerCase();
          if (browserLang.startsWith("pt")) return "pt-br";
          if (browserLang.startsWith("es")) return "es";
          return "en";
        })();

    if (targetLocale !== "en") {
      setTimeout(() => {
        setLocale(targetLocale);
      }, 0);
    }
  }, []);

  const t = (key: keyof typeof translations["en"]) => {
    return translations[locale][key] || translations["en"][key];
  };

  const changeLocale = (newLocale: "en" | "pt-br" | "es") => {
    setLocale(newLocale);
    localStorage.setItem("selecto_dashboard_locale", newLocale);
    setIsLangMenuOpen(false);
  };

  // 1. Toggle Active/Inactive state of flow
  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const result = await toggleFlowAction(id, !currentStatus);
    if (result.success) {
      setFlows(prev => prev.map(flow => 
        flow.id === id ? { ...flow, isActive: !currentStatus } : flow
      ));
      setStats(prev => ({
        ...prev,
        activeFlows: currentStatus ? prev.activeFlows - 1 : prev.activeFlows + 1
      }));
    }
  };

  // 2. Delete Flow Mutation
  const handleDeleteFlow = async (id: string) => {
    if (confirm(t("deleteConfirm"))) {
      const result = await deleteFlowAction(id);
      if (result.success) {
        setFlows(prev => prev.filter(f => f.id !== id));
        // Recalculate stats offline
        const deletedFlow = flows.find(f => f.id === id);
        const stepsCount = deletedFlow?.steps.length || 0;
        setStats(prev => ({
          ...prev,
          totalFlows: prev.totalFlows - 1,
          activeFlows: deletedFlow?.isActive ? prev.activeFlows - 1 : prev.activeFlows,
          totalSteps: prev.totalSteps - stepsCount
        }));
      }
    }
  };

  // 3. Open Create Flow Modal
  const openCreateModal = () => {
    setIsEditMode(false);
    setEditorMode("visual");
    setFlowDescriptionText("");
    setFlowThemeColor("#6366f1");
    setFlowThemeBg("#0f172a");
    setFlowThemeText("#ffffff");
    setEditingFlow({
      name: "",
      description: "",
      isActive: true,
      steps: []
    });
    setIsModalOpen(true);
  };

  // 4. Open Edit Flow Modal
  const openEditModal = (flow: Flow) => {
    setIsEditMode(true);
    setEditorMode("visual");

    let text = flow.description || "";
    let primaryColor = "#6366f1";
    let backgroundColor = "#0f172a";
    let textColor = "#ffffff";
    try {
      if (flow.description && flow.description.startsWith("{")) {
        const parsed = JSON.parse(flow.description);
        text = parsed.text || "";
        primaryColor = parsed.primaryColor || "#6366f1";
        backgroundColor = parsed.backgroundColor || "#0f172a";
        textColor = parsed.textColor || "#ffffff";
      }
    } catch (e) {
      console.error("Error parsing flow description json:", e);
    }

    setFlowDescriptionText(text);
    setFlowThemeColor(primaryColor);
    setFlowThemeBg(backgroundColor);
    setFlowThemeText(textColor);

    // Deep clone to avoid direct state mutation
    setEditingFlow(JSON.parse(JSON.stringify(flow)));
    setIsModalOpen(true);
  };

  const startVisualBuilder = () => {
    import("selecto-onboarding-sdk").then(({ OnboardingBuilder }) => {
      const builder = new OnboardingBuilder({
        dashboardUrl: window.location.origin,
        locale: locale === "pt-br" ? "pt-BR" : locale,
        onSave: () => {
          window.location.reload();
        }
      });
      builder.start();
    });
  };

  // 5. Save Flow Mutation
  const handleSaveFlow = async () => {
    if (!editingFlow || !editingFlow.name?.trim()) {
      alert(t("errorFlowNameRequired"));
      return;
    }

    setIsSaving(true);
    
    let stepsToSave = editingFlow.steps || [];
    if (editorMode === "raw") {
      stepsToSave = deserializeSteps(rawImportText, editingFlow.steps || []);
    }

    // Set index on steps sequentially
    const formattedSteps = stepsToSave.map((step, idx) => ({
      ...step,
      stepIndex: idx
    }));

    const descriptionJson = JSON.stringify({
      text: flowDescriptionText,
      primaryColor: flowThemeColor,
      backgroundColor: flowThemeBg,
      textColor: flowThemeText
    });

    const flowToSave = {
      ...editingFlow,
      name: editingFlow.name,
      description: descriptionJson,
      isActive: !!editingFlow.isActive,
      steps: formattedSteps
    };

    const result = await saveFlowAction(flowToSave as unknown as Parameters<typeof saveFlowAction>[0]);
    setIsSaving(false);

    if (result.success) {
      // Reload page to get fresh server props and stats cleanly
      window.location.reload();
    } else {
      alert(t("errorSavingFlow") + result.error);
    }
  };

  // 6. Manage Steps Inside Modal
  const handleAddStep = () => {
    if (!editingFlow) return;
    const newStep: Step = {
      title: "New Step",
      content: "Describe the action for this step...",
      targetSelector: "",
      placement: "bottom",
      stepIndex: (editingFlow.steps || []).length
    };
    setEditingFlow({
      ...editingFlow,
      steps: [...(editingFlow.steps || []), newStep]
    });
  };

  const handleRemoveStep = (index: number) => {
    if (!editingFlow || !editingFlow.steps) return;
    const updatedSteps = editingFlow.steps.filter((_, idx) => idx !== index);
    setEditingFlow({
      ...editingFlow,
      steps: updatedSteps
    });
  };

  const handleMoveStep = (index: number, direction: "up" | "down") => {
    if (!editingFlow || !editingFlow.steps) return;
    const steps = [...editingFlow.steps];
    
    if (direction === "up" && index > 0) {
      const temp = steps[index];
      steps[index] = steps[index - 1];
      steps[index - 1] = temp;
    } else if (direction === "down" && index < steps.length - 1) {
      const temp = steps[index];
      steps[index] = steps[index + 1];
      steps[index + 1] = temp;
    }

    setEditingFlow({
      ...editingFlow,
      steps
    });
  };

  const handleStepChange = (index: number, field: keyof Step, value: string) => {
    if (!editingFlow || !editingFlow.steps) return;
    const updatedSteps = editingFlow.steps.map((step, idx) => 
      idx === index ? { ...step, [field]: value } : step
    );
    setEditingFlow({
      ...editingFlow,
      steps: updatedSteps
    });
  };

  const serializeSteps = (steps: Step[]): string => {
    return (steps || [])
      .map(step => {
        const title = step.title || "Step";
        const content = (step.content || "").replace(/\n/g, " ");
        const placement = step.placement || "bottom";
        const selector = step.targetSelector || "";
        
        const lines = [
          `/* Step: ${title} */`,
          content ? `/* Content: ${content} */` : null,
          `/* Placement: ${placement} */`,
          selector
        ].filter(Boolean);
        
        return lines.join("\n").trim();
      })
      .join("\n\n");
  };

  const deserializeSteps = (text: string, existingSteps: Step[]): Step[] => {
    if (!text.trim()) return [];

    // Check if it starts with JSON array
    if (text.trim().startsWith("[")) {
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          return json.map((item: ImportedItem, idx: number) => {
            const existing = existingSteps[idx];
            return {
              id: existing?.id || crypto.randomUUID(),
              title: item.name || item.tag || existing?.title || `Step ${idx + 1}`,
              content: item.text ? `Action on: ${item.text}` : (existing?.content || "Describe the action for this step..."),
              targetSelector: item.css || item.activeLocator || "",
              placement: existing?.placement || "bottom",
              stepIndex: idx
            };
          });
        }
      } catch {
      }
    }

    const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    return blocks.map((block, idx) => {
      const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
      
      let title = "";
      let content = "";
      let placement = "";
      const selectorLines: string[] = [];
      
      lines.forEach(line => {
        const cssCommentMatch = line.match(/^\/\*\s*(.*?)\s*\*\/$/);
        const slashCommentMatch = line.match(/^\/\/\s*(.*)$/);
        const commentContent = cssCommentMatch ? cssCommentMatch[1].trim() : (slashCommentMatch ? slashCommentMatch[1].trim() : null);
        
        if (commentContent !== null) {
          const stepMatch = commentContent.match(/^Step:\s*(.*)$/i);
          const titleMatch = commentContent.match(/^Title:\s*(.*)$/i);
          const contentMatch = commentContent.match(/^Content:\s*(.*)$/i);
          const descMatch = commentContent.match(/^Description:\s*(.*)$/i);
          const placementMatch = commentContent.match(/^Placement:\s*(.*)$/i);
          
          if (stepMatch) {
            title = stepMatch[1].trim();
          } else if (titleMatch) {
            title = titleMatch[1].trim();
          } else if (contentMatch) {
            content = contentMatch[1].trim();
          } else if (descMatch) {
            content = descMatch[1].trim();
          } else if (placementMatch) {
            placement = placementMatch[1].trim().toLowerCase();
          } else if (["top", "bottom", "left", "right", "center"].includes(commentContent.toLowerCase())) {
            placement = commentContent.toLowerCase();
          } else {
            if (!title) {
              title = commentContent;
            } else if (!content) {
              content = commentContent;
            }
          }
        } else {
          selectorLines.push(line);
        }
      });
      
      const targetSelector = selectorLines.join("\n").trim();
      const existing = existingSteps[idx];
      
      return {
        id: existing?.id || crypto.randomUUID(),
        title: title || existing?.title || `Step ${idx + 1}`,
        content: content || existing?.content || "Describe the action for this step...",
        targetSelector: targetSelector,
        placement: placement || existing?.placement || "bottom",
        stepIndex: idx
      };
    });
  };

  const handleToggleEditorMode = (newMode: "visual" | "raw") => {
    if (newMode === "raw") {
      const text = serializeSteps(editingFlow?.steps || []);
      setRawImportText(text);
    } else {
      const parsed = deserializeSteps(rawImportText, editingFlow?.steps || []);
      setEditingFlow(prev => prev ? { ...prev, steps: parsed } : null);
    }
    setEditorMode(newMode);
  };

  const filteredFlows = flows.filter(flow => {
    const descText = displayDescription(flow.description);
    return (
      flow.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      descText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flow.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 🚀 Main Navigation Bar */}
      <nav className="bg-card/20 border-b border-border backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20">
              <Layers className="w-5 h-5" />
            </span>
            <span className="font-bold tracking-tight text-slate-100">
              {t("navTitle")}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/45 text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <span>{locale === "en" ? "🇺🇸 EN" : locale === "pt-br" ? "🇧🇷 PT" : "🇪🇸 ES"}</span>
                <span className="text-[10px] opacity-60">▼</span>
              </button>
              {isLangMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsLangMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-28 rounded-lg border border-border bg-card shadow-xl z-20 py-1 overflow-hidden">
                    <button
                      onClick={() => changeLocale("en")}
                      className={`flex w-full items-center px-3 py-2 text-xs hover:bg-secondary/40 transition-colors text-left cursor-pointer ${
                        locale === "en" ? "text-indigo-400 font-bold" : "text-slate-300"
                      }`}
                    >
                      🇺🇸 English
                    </button>
                    <button
                      onClick={() => changeLocale("pt-br")}
                      className={`flex w-full items-center px-3 py-2 text-xs hover:bg-secondary/40 transition-colors text-left cursor-pointer ${
                        locale === "pt-br" ? "text-indigo-400 font-bold" : "text-slate-300"
                      }`}
                    >
                      🇧🇷 Português
                    </button>
                    <button
                      onClick={() => changeLocale("es")}
                      className={`flex w-full items-center px-3 py-2 text-xs hover:bg-secondary/40 transition-colors text-left cursor-pointer ${
                        locale === "es" ? "text-indigo-400 font-bold" : "text-slate-300"
                      }`}
                    >
                      🇪🇸 Español
                    </button>
                  </div>
                </>
              )}
            </div>

            <span className="flex items-center gap-1.5 bg-secondary/60 border border-border px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {t("apiOnline")}
            </span>
            <span className="opacity-45">v1.0.3</span>
          </div>
        </div>
      </nav>

      {/* 💻 Dashboard Content */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:py-12">
          {/* 🚀 Hero Section */}
          <header className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-border pb-8">
            <div>
              <div className="flex items-center gap-3">
                <span className="p-2 bg-primary/10 text-primary rounded-xl ring-1 ring-primary/20">
                  <Layers className="w-8 h-8" />
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight bg-linear-to-r from-indigo-300 via-indigo-200 to-purple-400 bg-clip-text text-transparent">
                  {t("headerTitle")}
                </h1>
              </div>
              <p className="text-muted-foreground mt-2 text-sm md:text-base">
                {t("headerSub")}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={startVisualBuilder}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-secondary hover:bg-secondary/70 border border-border text-slate-200 font-semibold rounded-xl transition duration-200 cursor-pointer hover:scale-[1.02] shadow-md shadow-black/10"
              >
                <Settings className="w-5 h-5 text-indigo-400" />
                {t("visualBuilderSandbox")}
              </button>
              <button
                onClick={openCreateModal}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-foreground/90 text-primary-foreground font-semibold rounded-xl transition duration-200 cursor-pointer shadow-lg shadow-primary/20 hover:scale-[1.02]"
              >
                <Plus className="w-5 h-5" />
                {t("createFlow")}
              </button>
            </div>
          </header>

          {/* 📊 Stats Grid */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
            <div className="bg-card/40 border border-border p-6 rounded-2xl backdrop-blur-md">
              <div className="flex justify-between items-center text-muted-foreground mb-4">
                <span className="text-sm font-semibold">{t("statTotalFlows")}</span>
                <BookOpen className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-3xl font-bold">{stats.totalFlows}</div>
            </div>

            <div className="bg-card/40 border border-border p-6 rounded-2xl backdrop-blur-md">
              <div className="flex justify-between items-center text-muted-foreground mb-4">
                <span className="text-sm font-semibold">{t("statActiveFlows")}</span>
                <Play className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold text-emerald-400">{stats.activeFlows}</div>
            </div>

            <div className="bg-card/40 border border-border p-6 rounded-2xl backdrop-blur-md">
              <div className="flex justify-between items-center text-muted-foreground mb-4">
                <span className="text-sm font-semibold">{t("statTotalSteps")}</span>
                <Layers className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-3xl font-bold">{stats.totalSteps}</div>
            </div>

            <div className="bg-card/40 border border-border p-6 rounded-2xl backdrop-blur-md">
              <div className="flex justify-between items-center text-muted-foreground mb-4">
                <span className="text-sm font-semibold">{t("statTotalEvents")}</span>
                <BarChart3 className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="text-3xl font-bold text-cyan-400">{stats.totalEvents}</div>
            </div>
          </section>

          {/* 📋 Flows Management Section */}
          <section className="bg-card/25 border border-border rounded-3xl overflow-hidden backdrop-blur-md">
            <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                {t("headerTitle")}
              </h2>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="px-3.5 py-1.5 bg-background border border-border rounded-xl text-xs outline-none focus:ring-1 focus:ring-primary w-full md:w-48 text-slate-200"
                />
                <span className="text-xs bg-secondary/80 text-muted-foreground px-3 py-1 rounded-full border border-border font-semibold whitespace-nowrap">
                  {filteredFlows.length} / {flows.length}
                </span>
              </div>
            </div>

            {filteredFlows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <HelpCircle className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold text-muted-foreground">{t("noFlows")}</h3>
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/70 border border-border rounded-xl transition cursor-pointer text-sm font-semibold mt-4"
                >
                  {t("createFlow")}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-card/50 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                      <th className="p-6">{t("fieldFlowName")}</th>
                      <th className="p-6">{t("fieldDescription")}</th>
                      <th className="p-6">{t("statTotalSteps")}</th>
                      <th className="p-6">Status</th>
                      <th className="p-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredFlows.map(flow => (
                      <tr key={flow.id} className="hover:bg-card/20 transition group">
                        <td className="p-6">
                          <div className="font-bold text-slate-100 group-hover:text-primary transition flex items-center gap-2">
                            {flow.name}
                            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition text-muted-foreground" />
                          </div>
                          <span className="text-xs text-muted-foreground/50 block font-mono mt-1">ID: {flow.id}</span>
                        </td>
                        <td className="p-6 text-muted-foreground text-sm max-w-xs truncate">
                          {displayDescription(flow.description) || <span className="italic opacity-40">No description</span>}
                        </td>
                        <td className="p-6">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {flow.steps.length} {t("cardSteps")}
                          </span>
                        </td>
                        <td className="p-6">
                          <button
                            onClick={() => handleToggleStatus(flow.id, flow.isActive)}
                            className="text-muted-foreground hover:text-foreground transition cursor-pointer flex items-center"
                            title={flow.isActive ? t("cardInactive") : t("cardActive")}
                          >
                            {flow.isActive ? (
                              <ToggleRight className="w-9 h-9 text-emerald-400 transition" />
                            ) : (
                              <ToggleLeft className="w-9 h-9 text-muted-foreground/40 transition" />
                            )}
                          </button>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => openEditModal(flow)}
                              className="p-2 hover:bg-secondary text-muted-foreground hover:text-indigo-400 rounded-lg border border-transparent hover:border-border transition cursor-pointer"
                              title={t("cardEdit")}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteFlow(flow.id)}
                              className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg border border-transparent hover:border-destructive/20 transition cursor-pointer"
                              title={t("cardDelete")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ✍️ Flow Builder Modal */}
      {isModalOpen && editingFlow && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex items-center justify-between bg-card/50">
              <div>
                <h3 className="text-xl font-bold">
                  {isEditMode ? t("modalEditTitle") : t("modalCreateTitle")}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure tour details and build step-by-step elements below.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Core Flow Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-secondary/30 p-6 rounded-2xl border border-border/60">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-300">{t("fieldFlowName")}</label>
                  <input
                    type="text"
                    value={editingFlow.name}
                    onChange={e => setEditingFlow({ ...editingFlow, name: e.target.value })}
                    placeholder={t("fieldFlowNamePlaceholder")}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition text-sm"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-300">{t("fieldDescription")}</label>
                  <input
                    type="text"
                    value={flowDescriptionText}
                    onChange={e => setFlowDescriptionText(e.target.value)}
                    placeholder={t("fieldDescriptionPlaceholder")}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition text-sm"
                  />
                </div>

                {/* Theme Customization Colors */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:col-span-2 border-t border-border/40 pt-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-300">{t("fieldThemeColor")}</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={flowThemeColor}
                        onChange={e => setFlowThemeColor(e.target.value)}
                        className="w-12 h-10 p-1 bg-background border border-border rounded-xl cursor-pointer"
                      />
                      <input
                        type="text"
                        value={flowThemeColor}
                        onChange={e => {
                          const val = e.target.value;
                          if (val.startsWith("#") && val.length <= 7) {
                            setFlowThemeColor(val);
                          }
                        }}
                        placeholder="#6366f1"
                        className="flex-1 px-4 py-2 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-300">{t("fieldThemeBg")}</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={flowThemeBg}
                        onChange={e => setFlowThemeBg(e.target.value)}
                        className="w-12 h-10 p-1 bg-background border border-border rounded-xl cursor-pointer"
                      />
                      <input
                        type="text"
                        value={flowThemeBg}
                        onChange={e => {
                          const val = e.target.value;
                          if (val.startsWith("#") && val.length <= 7) {
                            setFlowThemeBg(val);
                          }
                        }}
                        placeholder="#0f172a"
                        className="flex-1 px-4 py-2 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-300">{t("fieldThemeText")}</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={flowThemeText}
                        onChange={e => setFlowThemeText(e.target.value)}
                        className="w-12 h-10 p-1 bg-background border border-border rounded-xl cursor-pointer"
                      />
                      <input
                        type="text"
                        value={flowThemeText}
                        onChange={e => {
                          const val = e.target.value;
                          if (val.startsWith("#") && val.length <= 7) {
                            setFlowThemeText(val);
                          }
                        }}
                        placeholder="#ffffff"
                        className="flex-1 px-4 py-2 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                {!isEditMode && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-300">Tour ID (Slug/Unique Code)</label>
                    <input
                      type="text"
                      value={editingFlow.id || ""}
                      onChange={e => setEditingFlow({ ...editingFlow, id: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-') })}
                      placeholder="e.g. welcome-tour (leave blank to auto-generate)"
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition text-sm font-mono text-indigo-300"
                    />
                  </div>
                )}

                <div className="flex items-center md:pt-8 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingFlow({ ...editingFlow, isActive: !editingFlow.isActive })}
                    className="flex items-center text-slate-300 font-semibold text-sm cursor-pointer text-left"
                  >
                    {editingFlow.isActive ? (
                      <ToggleRight className="w-9 h-9 text-emerald-400 mr-2 shrink-0" />
                    ) : (
                      <ToggleLeft className="w-9 h-9 text-muted-foreground/40 mr-2 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold">{t("fieldIsActive")}</div>
                      <div className="text-xs text-muted-foreground font-normal">{t("fieldIsActiveDesc")}</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center border-b border-border/80 pb-2">
                <h4 className="font-extrabold text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-400" />
                  {t("stepListTitle")}
                </h4>
                
                {/* 🎛️ Editor Mode Tabs */}
                <div className="flex items-center gap-4 bg-secondary/40 p-1.5 rounded-2xl border border-border">
                  <button
                    type="button"
                    onClick={() => handleToggleEditorMode("visual")}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      editorMode === "visual"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("visualEditor")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleEditorMode("raw")}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      editorMode === "raw"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("rawImportExport")}
                  </button>
                </div>

                {editorMode === "visual" && (
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-foreground/90 text-primary-foreground rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    {t("btnAddStep")}
                  </button>
                )}
              </div>

              {editorMode === "raw" ? (
                <div className="space-y-3 border border-border p-5 rounded-3xl bg-card/40">
                  <div className="flex flex-col mb-1 gap-1">
                    <span className="text-xs font-bold text-slate-300">{t("rawImportExport")}</span>
                    <span className="text-[10px] text-muted-foreground leading-relaxed">{t("rawEditorTip")}</span>
                  </div>
                  <textarea 
                    placeholder={t("rawEditorPlaceholder")}
                    rows={12}
                    value={rawImportText}
                    onChange={e => setRawImportText(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-2xl focus:ring-1 focus:ring-primary outline-none transition text-xs font-mono text-indigo-300 animate-in"
                  />
                </div>
              ) : (editingFlow.steps || []).length === 0 ? (
                <div className="border border-dashed border-border py-12 rounded-2xl text-center text-muted-foreground text-sm bg-card/10">
                  No steps added to this tour. Click &quot;Add Step&quot; above to configure your onboarding guidelines.
                </div>
              ) : (
                <div className="space-y-4">
                  {(editingFlow.steps || []).map((step, idx) => (
                    <div key={idx} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm relative group/step">
                      {/* Step Card Header */}
                      <div className="p-4 bg-secondary/20 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center justify-center ring-1 ring-primary/20">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-sm text-slate-200">Step Settings</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleMoveStep(idx, "up")}
                            disabled={idx === 0}
                            className="p-1.5 hover:bg-secondary disabled:opacity-30 rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
                            title={t("moveUp")}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveStep(idx, "down")}
                            disabled={idx === (editingFlow.steps || []).length - 1}
                            className="p-1.5 hover:bg-secondary disabled:opacity-30 rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
                            title={t("moveDown")}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveStep(idx)}
                            className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition ml-2 cursor-pointer"
                            title={t("removeStep")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Step Card Inputs */}
                      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-4 md:col-span-2">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground">{t("stepTitleLabel")}</label>
                            <input
                              type="text"
                              value={step.title}
                              onChange={e => handleStepChange(idx, "title", e.target.value)}
                              placeholder="e.g. Click here to begin"
                              className="w-full px-3.5 py-2 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary outline-none transition text-xs"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                              {t("stepContentLabel")}
                              <span className="relative group/info inline-block">
                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-indigo-400 transition cursor-help" />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3.5 bg-slate-950 border border-border rounded-xl shadow-xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-opacity duration-200 z-50 text-[10px] text-slate-300 space-y-1 font-normal normal-case leading-relaxed">
                                  <span className="font-bold text-slate-100 border-b border-border/60 pb-1 mb-1.5 flex items-center justify-between">
                                    <span>Supported Formatting</span>
                                    <span className="text-[9px] text-indigo-400 font-mono font-bold">Markdown</span>
                                  </span>
                                  <span className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                                    <span><strong>**Bold**</strong> / <strong>__Bold__</strong></span>
                                    <span><em>*Italic*</em> / <em>_Italic_</em></span>
                                    <span><code className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] font-mono text-rose-400">`code`</code> Inline Code</span>
                                    <span><span className="text-indigo-300 underline">[Text](url)</span> Link</span>
                                    <span><span className="text-indigo-300 font-mono">- item</span> Bullet List</span>
                                    <span><span className="text-indigo-300 font-mono">1. item</span> Number List</span>
                                  </span>
                                  <span className="border-t border-border/40 pt-1.5 mt-1.5 text-[9px] text-muted-foreground leading-normal block">
                                    Paste a YouTube link or image URL on its own line to auto-embed video players and images.
                                  </span>
                                </span>
                              </span>
                            </label>
                            <textarea
                              value={step.content}
                              onChange={e => handleStepChange(idx, "content", e.target.value)}
                              placeholder="Explain what the user needs to do in this step..."
                              rows={3}
                              className="w-full px-3.5 py-2 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary outline-none transition text-xs"
                            />
                            {step.content && (
                              <div className="mt-2 p-3 bg-secondary/20 border border-border/40 rounded-xl text-xs space-y-1">
                                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Live Preview</div>
                                <div 
                                  className="text-slate-300 selecto-preview-content prose prose-invert max-w-none"
                                  dangerouslySetInnerHTML={{ __html: parseRichContent(step.content) }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                              {t("stepSelectorLabel")}
                              <span className="text-[10px] text-indigo-400 font-normal italic">Shadow DOM selector</span>
                            </label>
                            <input
                              type="text"
                              value={step.targetSelector || ""}
                              onChange={e => handleStepChange(idx, "targetSelector", e.target.value)}
                              placeholder={t("stepSelectorPlaceholder")}
                              className="w-full px-3.5 py-2 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary outline-none transition text-xs font-mono text-indigo-300"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground">{t("stepPlacementLabel")}</label>
                            <select
                              value={step.placement}
                              onChange={e => handleStepChange(idx, "placement", e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary outline-none transition text-xs"
                            >
                              <option value="bottom">{t("placementBottom")}</option>
                              <option value="top">{t("placementTop")}</option>
                              <option value="left">{t("placementLeft")}</option>
                              <option value="right">{t("placementRight")}</option>
                              <option value="center">{t("placementCenter")}</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-border flex items-center justify-end gap-3 bg-card/50">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-secondary hover:bg-secondary/70 border border-border text-slate-100 rounded-xl text-sm font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {t("btnCancel")}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveFlow}
                className="px-5 py-2 bg-primary hover:bg-primary-foreground/90 text-primary-foreground font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 shadow-md shadow-primary/10 flex items-center gap-2"
              >
                {isSaving ? t("btnSaving") : t("btnSaveFlow")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📝 Global Footer */}
      <footer className="bg-card/10 border-t border-border/40 py-6 text-center text-xs text-muted-foreground/60 mt-auto">
        <p>© {new Date().getFullYear()} {t("footerText")}</p>
      </footer>
    </div>
  );
}
