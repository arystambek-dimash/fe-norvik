import { useState } from "react";
import { usePlannerStore } from "@/stores/planner-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Plus, Trash2, RotateCcw, Bug } from "lucide-react";
import type { GoldenRule, SegmentContext } from "@/algorithm/types";

const DEFAULT_GOLDEN_RULES: GoldenRule[] = [
  { context: "sink", width: 600, moduleArticles: ["SINK-60"] },
  { context: "standard", width: 600, moduleArticles: ["BASE-60"] },
  { context: "standard", width: 400, moduleArticles: ["BASE-40"] },
  { context: "standard", width: 300, moduleArticles: ["BASE-30"] },
  { context: "standard", width: 800, moduleArticles: ["BASE-80"] },
];

interface EditingState {
  index: number;
  context: SegmentContext;
  width: string;
  articles: string;
}

function RuleRow({
  rule,
  index,
  editing,
  onEdit,
  onSave,
  onCancel,
  onChange,
  onRemove,
}: {
  rule: GoldenRule;
  index: number;
  editing: EditingState | null;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onChange: (patch: Partial<EditingState>) => void;
  onRemove: () => void;
}) {
  const isEditing = editing?.index === index;

  if (isEditing && editing) {
    return (
      <tr className="border-b border-dashed border-border/40">
        <td className="px-2 py-1.5">
          <Select
            value={editing.context}
            onValueChange={(v) => onChange({ context: v as SegmentContext })}
          >
            <SelectTrigger size="sm" className="h-7 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sink">sink</SelectItem>
              <SelectItem value="standard">standard</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-2 py-1.5">
          <Input
            type="number"
            value={editing.width}
            onChange={(e) => onChange({ width: e.target.value })}
            className="h-7 w-20 text-xs font-mono"
          />
        </td>
        <td className="px-2 py-1.5">
          <Input
            type="text"
            value={editing.articles}
            onChange={(e) => onChange({ articles: e.target.value })}
            className="h-7 text-xs font-mono"
            placeholder="ART-1, ART-2"
          />
        </td>
        <td className="px-2 py-1.5">
          <div className="flex gap-1">
            <Button variant="ghost" size="xs" onClick={onSave}>
              Сохранить
            </Button>
            <Button variant="ghost" size="xs" onClick={onCancel}>
              Отмена
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className="cursor-pointer border-b border-dashed border-border/40 transition-colors hover:bg-accent/30"
      onClick={onEdit}
    >
      <td className="px-2 py-1.5 text-xs">{rule.context}</td>
      <td className="px-2 py-1.5 text-xs font-mono">{rule.width}</td>
      <td className="px-2 py-1.5 text-xs font-mono">{rule.moduleArticles.join(", ")}</td>
      <td className="px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="size-3" />
        </Button>
      </td>
    </tr>
  );
}

export default function GoldenTablePanel() {
  const [expanded, setExpanded] = useState(false);
  const goldenRules = usePlannerStore((s) => s.goldenRules);
  const setGoldenRules = usePlannerStore((s) => s.setGoldenRules);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [adding, setAdding] = useState(false);
  const [newRule, setNewRule] = useState<{ context: SegmentContext; width: string; articles: string }>({
    context: "standard",
    width: "",
    articles: "",
  });

  const startEdit = (index: number) => {
    const rule = goldenRules[index];
    setEditing({
      index,
      context: rule.context,
      width: String(rule.width),
      articles: rule.moduleArticles.join(", "),
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    const width = parseInt(editing.width, 10);
    if (isNaN(width) || width <= 0) return;

    const articles = editing.articles
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (articles.length === 0) return;

    const updated = [...goldenRules];
    updated[editing.index] = {
      context: editing.context,
      width,
      moduleArticles: articles,
    };
    setGoldenRules(updated);
    setEditing(null);
  };

  const removeRule = (index: number) => {
    setGoldenRules(goldenRules.filter((_, i) => i !== index));
  };

  const addRule = () => {
    const width = parseInt(newRule.width, 10);
    if (isNaN(width) || width <= 0) return;

    const articles = newRule.articles
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (articles.length === 0) return;

    setGoldenRules([
      ...goldenRules,
      { context: newRule.context, width, moduleArticles: articles },
    ]);
    setNewRule({ context: "standard", width: "", articles: "" });
    setAdding(false);
  };

  const resetToDefaults = () => {
    setGoldenRules(DEFAULT_GOLDEN_RULES);
    setEditing(null);
    setAdding(false);
  };

  return (
    <div className="rounded-xl border border-dashed border-border/50 bg-muted/20">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/40 rounded-xl"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Bug className="size-3.5" />
          Отладка: Золотая таблица
        </span>
        {expanded ? (
          <ChevronUp className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-dashed border-border/40 px-3 pb-3 pt-2">
          {goldenRules.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Золотые правила не заданы.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="px-2 py-1 text-xs font-medium text-muted-foreground">Контекст</th>
                    <th className="px-2 py-1 text-xs font-medium text-muted-foreground">Ширина (мм)</th>
                    <th className="px-2 py-1 text-xs font-medium text-muted-foreground">Артикулы</th>
                    <th className="px-2 py-1 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {goldenRules.map((rule, index) => (
                    <RuleRow
                      key={index}
                      rule={rule}
                      index={index}
                      editing={editing}
                      onEdit={() => startEdit(index)}
                      onSave={saveEdit}
                      onCancel={() => setEditing(null)}
                      onChange={(patch) =>
                        setEditing((prev) => (prev ? { ...prev, ...patch } : null))
                      }
                      onRemove={() => removeRule(index)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adding ? (
            <div className="mt-2 flex items-end gap-2 rounded-lg border border-dashed border-border/40 p-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Контекст</label>
                <Select
                  value={newRule.context}
                  onValueChange={(v) => setNewRule((prev) => ({ ...prev, context: v as SegmentContext }))}
                >
                  <SelectTrigger size="sm" className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sink">sink</SelectItem>
                    <SelectItem value="standard">standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Ширина (мм)</label>
                <Input
                  type="number"
                  value={newRule.width}
                  onChange={(e) => setNewRule((prev) => ({ ...prev, width: e.target.value }))}
                  className="h-7 w-20 text-xs font-mono"
                  placeholder="600"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Артикулы</label>
                <Input
                  type="text"
                  value={newRule.articles}
                  onChange={(e) => setNewRule((prev) => ({ ...prev, articles: e.target.value }))}
                  className="h-7 text-xs font-mono"
                  placeholder="ART-1, ART-2"
                />
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="xs" onClick={addRule}>
                  Добавить
                </Button>
                <Button variant="ghost" size="xs" onClick={() => setAdding(false)}>
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <Button
                variant="outline"
                size="xs"
                className="rounded-lg"
                onClick={() => setAdding(true)}
              >
                <Plus className="mr-1 size-3" />
                Добавить правило
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="rounded-lg text-muted-foreground"
                onClick={resetToDefaults}
              >
                <RotateCcw className="mr-1 size-3" />
                Сбросить по умолчанию
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
