"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { sceneLabel, zoomTargetsFor } from "../scenes";
import type { FormScene } from "../types";

interface SceneRowProps {
  scene: FormScene;
  onChange: (patch: Partial<FormScene>) => void;
}

function SceneRow({ scene, onChange }: SceneRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: scene.id,
  });
  const alvos = zoomTargetsFor(scene);

  function alternarAlvo(id: string) {
    const marcados = scene.zoomTargets.includes(id)
      ? scene.zoomTargets.filter((t) => t !== id)
      : [...scene.zoomTargets, id];
    onChange({ zoomTargets: marcados });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="space-y-2 p-3"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="cursor-grab text-muted-foreground"
          aria-label={`Reordenar a cena ${sceneLabel(scene)}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <Checkbox
          checked={scene.enabled}
          onCheckedChange={(checked) => onChange({ enabled: checked === true })}
          aria-label={`Incluir a cena ${sceneLabel(scene)}`}
        />
        <span className={scene.enabled ? "flex-1" : "flex-1 text-muted-foreground"}>
          {sceneLabel(scene)}
        </span>
        <Input
          type="number"
          min={1}
          value={scene.durationSec}
          disabled={!scene.enabled}
          onChange={(event) =>
            // durationSec é inteiro por schema (z.number().int().positive() em
            // VideoBrief) -- Math.round evita que "2,5" quebre a validação do
            // buildBrief (o brief original usava só Math.max(1, Number(...))).
            onChange({ durationSec: Math.max(1, Math.round(Number(event.target.value) || 1)) })
          }
          className="w-20"
          aria-label={`Duração da cena ${sceneLabel(scene)} em segundos`}
        />
        <span className="text-sm text-muted-foreground">s</span>
      </div>

      {/* Cena sem alvo de zoom (notebook, logo) não mostra o campo. */}
      {scene.enabled && alvos.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-10">
          {alvos.map((alvo) => {
            const marcado = scene.zoomTargets.includes(alvo.id);
            return (
              <button key={alvo.id} type="button" onClick={() => alternarAlvo(alvo.id)}>
                <Badge variant={marcado ? "default" : "outline"}>{alvo.label}</Badge>
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}

interface SceneListProps {
  scenes: FormScene[];
  onChange: (scenes: FormScene[]) => void;
}

export function SceneList({ scenes, onChange }: SceneListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const de = scenes.findIndex((s) => s.id === active.id);
    const para = scenes.findIndex((s) => s.id === over.id);
    if (de === -1 || para === -1) return;
    const reordenadas = [...scenes];
    const [movida] = reordenadas.splice(de, 1);
    reordenadas.splice(para, 0, movida!);
    onChange(reordenadas);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ul className="divide-y rounded-md border">
          {scenes.map((scene) => (
            <SceneRow
              key={scene.id}
              scene={scene}
              onChange={(patch) =>
                onChange(scenes.map((s) => (s.id === scene.id ? { ...s, ...patch } : s)))
              }
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
