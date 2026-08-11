import { rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SnapshotSchema, type Snapshot } from "@millead/video-contracts";

/**
 * Pacote parcial nunca existe: escreve no temporário, valida, e só então
 * renomeia. Falhou a validação, o temporário é apagado inteiro.
 */
export async function writePackage(
  snapshot: Snapshot,
  tmpDir: string,
  capturesRoot: string,
): Promise<string> {
  const parsed = SnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    await rm(tmpDir, { recursive: true, force: true });
    const detail = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`snapshot inválido -- nada foi gravado:\n${detail}`);
  }

  await writeFile(
    join(tmpDir, "snapshot.json"),
    `${JSON.stringify(parsed.data, null, 2)}\n`,
    "utf8",
  );

  const finalDir = join(capturesRoot, parsed.data.id);

  // Promoção com rede de proteção. O Windows não deixa renomear sobre um
  // diretório existente, então o antigo precisa sair da frente -- mas ele só é
  // APAGADO depois que o novo estiver no lugar. Se o rename falhar no meio, o
  // antigo volta.
  const anteriorDir = `${finalDir}.anterior`;
  await rm(anteriorDir, { recursive: true, force: true });

  let tinhaAnterior = false;
  try {
    await rename(finalDir, anteriorDir);
    tinhaAnterior = true;
  } catch {
    // Não existia captura anterior -- caminho normal da primeira vez.
  }

  try {
    await rename(tmpDir, finalDir);
  } catch (err) {
    if (tinhaAnterior) await rename(anteriorDir, finalDir);
    throw err;
  }

  await rm(anteriorDir, { recursive: true, force: true });
  return finalDir;
}
