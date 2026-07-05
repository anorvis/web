"use client";

import { Button } from "@anorvis/ui/button";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMemo, useState } from "react";
import { IntegrationCard } from "@/features/integrations/components/card";
import { useIntegrations } from "@/features/overview/components/overview-provider";

const PAGE_SIZE = 6;
export function IntegrationsCatalog() {
  const integrations = useIntegrations();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return integrations;
    return integrations.filter((integration) => {
      const haystack = [
        integration.displayName,
        integration.category,
        integration.description,
        integration.authType,
        integration.status,
        ...integration.capabilities,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [integrations, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE,
  );

  if (integrations.length === 0) return null;

  return (
    <section className={workspacePageStyles.section}>
      <div className={workspacePageStyles.catalogHeader}>
        <div>
          <p className={workspacePageStyles.cardLabel}>{"// integrations"}</p>
          <h2 className="text-sm uppercase tracking-[0.25em]">
            connected surfaces
          </h2>
        </div>
        <p className={workspacePageStyles.catalogMeta}>
          sourced from anorvis-os
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          placeholder="search integrations"
          className={workspacePageStyles.searchInput}
        />
        <p className={workspacePageStyles.metricLabel}>
          {filtered.length} of {integrations.length}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {visible.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className={workspacePageStyles.metricLabel}>
          No integrations match your search.
        </p>
      )}
      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            className={workspacePageStyles.actionButton}
          >
            previous
          </Button>
          <span className={workspacePageStyles.metricLabel}>
            {currentPage + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={currentPage >= pageCount - 1}
            onClick={() =>
              setPage((value) => Math.min(pageCount - 1, value + 1))
            }
            className={workspacePageStyles.actionButton}
          >
            next
          </Button>
        </div>
      )}
    </section>
  );
}
