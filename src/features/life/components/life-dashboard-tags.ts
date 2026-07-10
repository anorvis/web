"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchLifeTags,
  hideLifeTag,
  saveLifeTag,
  updateLifeTag,
} from "@/features/life/api/life";
import { tagIdFromName } from "@/features/life/components/life-dashboard-calculations";
import type { Tag } from "@/lib/life-intelligence/model";
import { tagColorForName } from "@/lib/life-intelligence/tag-color";
import { queryKeys } from "@/lib/query/keys";

function normalizeTagName(name: string) {
  return name.trim().toLowerCase();
}

export function useLifeTagCatalog() {
  const queryClient = useQueryClient();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [draftTag, setDraftTag] = useState("");
  const [tagEdit, setTagEdit] = useState<{
    id: string;
    name: string;
    color: string;
  } | null>(null);
  const tagsQuery = useQuery({
    queryKey: queryKeys.life.tags(),
    queryFn: fetchLifeTags,
    staleTime: 5 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
  const catalog = tagsQuery.data ?? [];
  const catalogByName = useMemo(
    () =>
      new Map(catalog.map((record) => [normalizeTagName(record.name), record])),
    [catalog],
  );
  const tags = useMemo(
    () =>
      catalog.flatMap((record): Tag[] =>
        record.hidden
          ? []
          : [
              {
                id: tagIdFromName(record.name),
                name: record.name,
                color: record.color ?? tagColorForName(record.name),
                system: record.system,
              },
            ],
      ),
    [catalog],
  );
  const tagById = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  );
  const invalidateTags = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.life.tags() });
  const addMutation = useMutation({
    mutationFn: (name: string) => saveLifeTag({ name }),
    onSuccess: () => {
      setDraftTag("");
      void invalidateTags();
    },
  });
  const saveMutation = useMutation({
    mutationFn: (input: {
      originalName: string;
      name: string;
      color: string;
    }) => {
      const record = catalogByName.get(normalizeTagName(input.originalName));
      return record
        ? updateLifeTag(
            record.id,
            record.system
              ? { color: input.color }
              : { name: input.name, color: input.color },
          )
        : saveLifeTag({ name: input.name, color: input.color });
    },
    onSuccess: () => {
      setTagEdit(null);
      void invalidateTags();
    },
  });
  const removeMutation = useMutation({
    mutationFn: async (selected: Tag[]) => {
      for (const tag of selected) {
        if (tag.system) continue;
        const record = catalogByName.get(normalizeTagName(tag.name));
        if (record) {
          await hideLifeTag(record.id);
        } else {
          const created = await saveLifeTag({ name: tag.name });
          await hideLifeTag(created.id);
        }
      }
    },
    onSuccess: () => {
      setSelectedTagIds([]);
      void invalidateTags();
    },
  });
  const addTag = () => {
    const name = draftTag.trim();
    if (name) addMutation.mutate(name);
  };
  const saveTagEdit = () => {
    if (!tagEdit) return;
    const name = tagEdit.name.trim();
    if (!name) return;
    const originalName = tagById.get(tagEdit.id)?.name ?? name;
    saveMutation.mutate({ originalName, name, color: tagEdit.color });
  };
  const removeSelectedTags = () => {
    const selected = selectedTagIds
      .map((id) => tagById.get(id))
      .filter((tag): tag is Tag => Boolean(tag));
    if (selected.length > 0) removeMutation.mutate(selected);
  };
  const mutationError =
    addMutation.error ?? saveMutation.error ?? removeMutation.error;

  return {
    tags,
    loading: tagsQuery.isLoading,
    tagById,
    selectedTagIds,
    setSelectedTagIds,
    draftTag,
    setDraftTag,
    addTag,
    tagEdit,
    setTagEdit,
    saveTagEdit,
    removeSelectedTags,
    busy:
      addMutation.isPending ||
      saveMutation.isPending ||
      removeMutation.isPending,
    error: mutationError
      ? mutationError instanceof Error
        ? mutationError.message
        : "tag action failed"
      : null,
  };
}
