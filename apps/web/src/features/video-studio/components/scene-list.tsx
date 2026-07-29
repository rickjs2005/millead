"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { sceneLabel } from "../scenes";
import type { FormScene } from "../types";

interface SceneListProps {
  scenes: FormScene[];
  onChange: (scenes: FormScene[]) => void;
}

export function SceneList({ scenes, onChange }: SceneListProps) {
  function update(id: string, patch: Partial<FormScene>) {
    onChange(scenes.map((scene) => (scene.id === id ? { ...scene, ...patch } : scene)));
  }

  return (
    <ul className="divide-y rounded-md border">
      {scenes.map((scene) => (
        <li key={scene.id} className="flex items-center gap-3 p-3">
          <Checkbox
            checked={scene.enabled}
            onCheckedChange={(checked) => update(scene.id, { enabled: checked === true })}
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
              update(scene.id, { durationSec: Math.max(1, Math.round(Number(event.target.value) || 1)) })
            }
            className="w-20"
            aria-label={`Duração da cena ${sceneLabel(scene)} em segundos`}
          />
          <span className="text-sm text-muted-foreground">s</span>
        </li>
      ))}
    </ul>
  );
}
