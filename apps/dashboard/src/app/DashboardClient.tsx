"use client";

import { useState } from "react";
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

interface Step {
  id?: string;
  title: string;
  content: string;
  targetSelector?: string;
  placement: string;
  stepIndex: number;
}

interface Flow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  steps: Step[];
  createdAt: string;
  updatedAt: string;
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

  // 1. Toggle Flow Active State
  const handleToggleStatus = async (flowId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    // Update local state instantly (Optimistic UI)
    setFlows(prev => prev.map(f => f.id === flowId ? { ...f, isActive: nextStatus } : f));
    setStats(prev => ({
      ...prev,
      activeFlows: prev.activeFlows + (nextStatus ? 1 : -1)
    }));

    const result = await toggleFlowAction(flowId, nextStatus);
    if (!result.success) {
      alert("Failed to update status: " + result.error);
      // Revert state on error
      setFlows(prev => prev.map(f => f.id === flowId ? { ...f, isActive: currentStatus } : f));
      setStats(prev => ({
        ...prev,
        activeFlows: prev.activeFlows + (currentStatus ? 1 : -1)
      }));
    }
  };

  // 2. Delete Flow
  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm("Are you sure you want to delete this flow? All steps and analytics will be lost.")) return;

    const originalFlows = [...flows];
    const flowToDelete = flows.find(f => f.id === flowId);
    
    // Update local state instantly
    setFlows(prev => prev.filter(f => f.id !== flowId));
    if (flowToDelete) {
      setStats(prev => ({
        ...prev,
        totalFlows: prev.totalFlows - 1,
        activeFlows: prev.activeFlows - (flowToDelete.isActive ? 1 : 0),
        totalSteps: prev.totalSteps - flowToDelete.steps.length
      }));
    }

    const result = await deleteFlowAction(flowId);
    if (!result.success) {
      alert("Failed to delete flow: " + result.error);
      setFlows(originalFlows);
      // Recalculate stats would be too complex, just let next refresh fix it or revert to original
      window.location.reload();
    }
  };

  // 3. Open Create Flow Modal
  const openCreateModal = () => {
    setIsEditMode(false);
    setEditorMode("visual");
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
    // Deep clone to avoid direct state mutation
    setEditingFlow(JSON.parse(JSON.stringify(flow)));
    setIsModalOpen(true);
  };

  // 5. Save Flow Mutation
  const handleSaveFlow = async () => {
    if (!editingFlow || !editingFlow.name?.trim()) {
      alert("Flow Name is required.");
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

    const flowToSave = {
      ...editingFlow,
      name: editingFlow.name,
      description: editingFlow.description || "",
      isActive: !!editingFlow.isActive,
      steps: formattedSteps
    };

    const result = await saveFlowAction(flowToSave as any);
    setIsSaving(false);

    if (result.success) {
      // Reload page to get fresh server props and stats cleanly
      window.location.reload();
    } else {
      alert("Error saving flow: " + result.error);
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
          return json.map((item: any, idx: number) => {
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
      } catch (e) {
        // Fall back to plain text parser
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

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:py-12">
      {/* 🚀 Hero Section */}
      <header className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-border pb-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-primary/10 text-primary rounded-xl ring-1 ring-primary/20">
              <Layers className="w-8 h-8" />
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-300 via-indigo-200 to-purple-400 bg-clip-text text-transparent">
              Selecto Onboarding
            </h1>
          </div>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Create, manage and distribute interactive product tours for your application.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-foreground/90 text-primary-foreground font-semibold rounded-xl transition duration-200 cursor-pointer shadow-lg shadow-primary/20 hover:scale-[1.02]"
        >
          <Plus className="w-5 h-5" />
          Create New Tour
        </button>
      </header>

      {/* 📊 Stats Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
        <div className="bg-card/40 border border-border p-6 rounded-2xl backdrop-blur-md">
          <div className="flex justify-between items-center text-muted-foreground mb-4">
            <span className="text-sm font-semibold">Total Tours</span>
            <BookOpen className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold">{stats.totalFlows}</div>
        </div>

        <div className="bg-card/40 border border-border p-6 rounded-2xl backdrop-blur-md">
          <div className="flex justify-between items-center text-muted-foreground mb-4">
            <span className="text-sm font-semibold">Active Tours</span>
            <Play className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400">{stats.activeFlows}</div>
        </div>

        <div className="bg-card/40 border border-border p-6 rounded-2xl backdrop-blur-md">
          <div className="flex justify-between items-center text-muted-foreground mb-4">
            <span className="text-sm font-semibold">Total Steps</span>
            <Layers className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-3xl font-bold">{stats.totalSteps}</div>
        </div>

        <div className="bg-card/40 border border-border p-6 rounded-2xl backdrop-blur-md">
          <div className="flex justify-between items-center text-muted-foreground mb-4">
            <span className="text-sm font-semibold">SDK Events</span>
            <BarChart3 className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold text-cyan-400">{stats.totalEvents}</div>
        </div>
      </section>

      {/* 📋 Flows Management Table */}
      <section className="bg-card/25 border border-border rounded-3xl overflow-hidden backdrop-blur-md">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            Product Tours
          </h2>
          <span className="text-xs bg-secondary/80 text-muted-foreground px-3 py-1 rounded-full border border-border font-semibold">
            {flows.length} flow(s) available
          </span>
        </div>

        {flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <HelpCircle className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-muted-foreground">No onboarding tours created yet</h3>
            <p className="text-muted-foreground/60 text-sm max-w-sm mt-1 mb-6">
              Create your first tour to define tooltips and modals that will guide your users through your application.
            </p>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-secondary hover:bg-secondary/70 border border-border rounded-xl transition cursor-pointer text-sm font-semibold"
            >
              Get Started
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-card/50 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  <th className="p-6">Tour Name</th>
                  <th className="p-6">Description</th>
                  <th className="p-6">Steps</th>
                  <th className="p-6">Status</th>
                  <th className="p-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {flows.map(flow => (
                  <tr key={flow.id} className="hover:bg-card/20 transition group">
                    <td className="p-6">
                      <div className="font-bold text-slate-100 group-hover:text-primary transition flex items-center gap-2">
                        {flow.name}
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition text-muted-foreground" />
                      </div>
                      <span className="text-xs text-muted-foreground/50 block font-mono mt-1">ID: {flow.id}</span>
                    </td>
                    <td className="p-6 text-muted-foreground text-sm max-w-xs truncate">
                      {flow.description || <span className="italic opacity-40">No description</span>}
                    </td>
                    <td className="p-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {flow.steps.length} step(s)
                      </span>
                    </td>
                    <td className="p-6">
                      <button
                        onClick={() => handleToggleStatus(flow.id, flow.isActive)}
                        className="text-muted-foreground hover:text-foreground transition cursor-pointer flex items-center"
                        title={flow.isActive ? "Deactivate" : "Activate"}
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
                          title="Edit Tour"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFlow(flow.id)}
                          className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg border border-transparent hover:border-destructive/20 transition cursor-pointer"
                          title="Delete Tour"
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

      {/* ✍️ Flow Builder Modal */}
      {isModalOpen && editingFlow && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex items-center justify-between bg-card/50">
              <div>
                <h3 className="text-xl font-bold">
                  {isEditMode ? "Edit Tour Settings" : "Create Onboarding Tour"}
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
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-300">Tour Name</label>
                  <input
                    type="text"
                    value={editingFlow.name}
                    onChange={e => setEditingFlow({ ...editingFlow, name: e.target.value })}
                    placeholder="e.g. Welcome Tour"
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-300">Description</label>
                  <input
                    type="text"
                    value={editingFlow.description || ""}
                    onChange={e => setEditingFlow({ ...editingFlow, description: e.target.value })}
                    placeholder="Short description of the goal..."
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition text-sm"
                  />
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
                    className="flex items-center text-slate-300 font-semibold text-sm cursor-pointer"
                  >
                    {editingFlow.isActive ? (
                      <ToggleRight className="w-9 h-9 text-emerald-400 mr-2" />
                    ) : (
                      <ToggleLeft className="w-9 h-9 text-muted-foreground/40 mr-2" />
                    )}
                    Publish Tour Automatically
                  </button>
                </div>
              </div>

                 <div className="flex justify-between items-center border-b border-border/80 pb-2">
                   <h4 className="font-extrabold text-lg flex items-center gap-2">
                     <Settings className="w-5 h-5 text-indigo-400" />
                     Steps Layout
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
                       Visual Cards
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
                       Raw Text (Comments)
                     </button>
                   </div>

                   {editorMode === "visual" && (
                     <button
                       type="button"
                       onClick={handleAddStep}
                       className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-foreground/90 text-primary-foreground rounded-xl text-xs font-bold transition cursor-pointer"
                     >
                       <Plus className="w-4 h-4" />
                       Add Step
                     </button>
                   )}
                 </div>

                 {editorMode === "raw" ? (
                   <div className="space-y-3 border border-border p-5 rounded-3xl bg-card/40">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-300">Raw Steps Editor</span>
                        <span className="text-[10px] text-muted-foreground italic">Use comments to edit Title, Content, and Placement. One blank line separates steps. Paste Extension JSON to import.</span>
                      </div>
                      <textarea 
                        placeholder="/* Step: Welcome Step */&#10;/* Content: Welcome to Selecto! */&#10;/* Placement: center */&#10;&#10;/* Step: Click Button */&#10;/* Content: Click the submit button to save. */&#10;/* Placement: bottom */&#10;#btn-submit"
                        rows={12}
                        value={rawImportText}
                        onChange={e => setRawImportText(e.target.value)}
                        className="w-full px-4 py-3 bg-background border border-border rounded-2xl focus:ring-1 focus:ring-primary outline-none transition text-xs font-mono text-indigo-300"
                      />
                    </div>
                  ) : (editingFlow.steps || []).length === 0 ? (
                  <div className="border border-dashed border-border py-12 rounded-2xl text-center text-muted-foreground text-sm bg-card/10">
                    No steps added to this tour. Click "Add Step" above to configure your onboarding guidelines.
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
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStep(idx, "down")}
                              disabled={idx === (editingFlow.steps || []).length - 1}
                              className="p-1.5 hover:bg-secondary disabled:opacity-30 rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(idx)}
                              className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition ml-2 cursor-pointer"
                              title="Delete Step"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Step Card Inputs */}
                        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-4 md:col-span-2">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-muted-foreground">Step Title</label>
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
                                Step Content / Description
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
                                Target Element Selector
                                <span className="text-[10px] text-indigo-400 font-normal italic">Shadow DOM selector</span>
                              </label>
                              <input
                                type="text"
                                value={step.targetSelector || ""}
                                onChange={e => handleStepChange(idx, "targetSelector", e.target.value)}
                                placeholder="e.g. #dashboard-btn (leave blank for Modal)"
                                className="w-full px-3.5 py-2 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary outline-none transition text-xs font-mono text-indigo-300"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-muted-foreground">Placement Direction</label>
                              <select
                                value={step.placement}
                                onChange={e => handleStepChange(idx, "placement", e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl focus:ring-1 focus:ring-primary outline-none transition text-xs"
                              >
                                <option value="bottom">Bottom (Below Target)</option>
                                <option value="top">Top (Above Target)</option>
                                <option value="left">Left (Left of Target)</option>
                                <option value="right">Right (Right of Target)</option>
                                <option value="center">Center Modal (No target needed)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}`
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
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveFlow}
                className="px-5 py-2 bg-primary hover:bg-primary-foreground/90 text-primary-foreground font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 shadow-md shadow-primary/10 flex items-center gap-2"
              >
                {isSaving ? "Saving..." : "Save Tour Settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
