"use client";

import { ExternalLink, ImageOff, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FORMAT_LABELS, FORMAT_ORDER, fmtNum } from "@/features/milsocial/labels";
import { useSetFormatMutation } from "@/features/milsocial/hooks";
import { formatDate } from "@/utils/format";
import type { SocialMetricSnapshot, SocialPostWithMetrics } from "@/types/api";

/** Soma likes+comentários+salvos+compartilhamentos; null se tudo vier null. */
function sumInteractions(snapshot: SocialMetricSnapshot | null): number | null {
  if (!snapshot) return null;
  const values = [snapshot.likes, snapshot.comments, snapshot.saved, snapshot.shares];
  if (values.every((v) => v == null)) return null;
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

function PostThumbnail({ post }: { post: SocialPostWithMetrics }) {
  if (!post.thumbnailUrl) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
        <ImageOff className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- CDN do Instagram, hosts rotativos.
    <img
      src={post.thumbnailUrl}
      alt=""
      className="h-12 w-12 shrink-0 rounded-md object-cover"
      width={48}
      height={48}
    />
  );
}

function FormatBadge({ post }: { post: SocialPostWithMetrics }) {
  const setFormat = useSetFormatMutation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1">
          <Badge variant={post.format === "UNCLASSIFIED" ? "secondary" : "outline"}>
            {FORMAT_LABELS[post.format]}
          </Badge>
          {post.formatSource === "AI" && (
            <span title="Classificado pela IA — clique para corrigir">
              <Sparkles className="h-3 w-3 text-primary" />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {FORMAT_ORDER.map((format) => (
          <DropdownMenuItem
            key={format}
            disabled={setFormat.isPending}
            onSelect={() => {
              if (format !== post.format) {
                setFormat.mutate({ postId: post.id, format });
              }
            }}
          >
            {FORMAT_LABELS[format]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PostList({ posts }: { posts: SocialPostWithMetrics[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="pb-0">
        <CardTitle>Posts sincronizados</CardTitle>
      </CardHeader>
      {posts.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          title="Nenhum post sincronizado ainda"
          description="Clique em Sincronizar agora."
          className="border-none py-10"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Post</TableHead>
              <TableHead>Publicado em</TableHead>
              <TableHead>Formato</TableHead>
              <TableHead className="text-right">Alcance</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Interações</TableHead>
              <TableHead className="text-right">Visitas ao perfil</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => (
              <TableRow key={post.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <PostThumbnail post={post} />
                    <span className="max-w-56 truncate text-muted-foreground">
                      {post.caption ?? "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(post.publishedAt)}
                </TableCell>
                <TableCell>
                  <FormatBadge post={post} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtNum(post.latest?.reach ?? null)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtNum(post.latest?.views ?? null)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtNum(sumInteractions(post.latest))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtNum(post.latest?.profileVisits ?? null)}
                </TableCell>
                <TableCell>
                  <a
                    href={post.igPermalink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Ver no Instagram <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
