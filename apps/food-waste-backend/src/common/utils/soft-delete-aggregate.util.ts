import type { Aggregate, PipelineStage } from 'mongoose';

const SOFT_DELETE_FILTER = { isDeleted: { $ne: true } } as const;

/**
 * Inject the soft-delete exclusion into an aggregation pipeline.
 *
 * When the pipeline starts with `$geoNear`, MongoDB requires it to stay
 * first — prepending a `$match` breaks the query (error 40603). In that
 * case the filter is merged into `$geoNear.query` instead.
 */
export function applySoftDeleteFilter(aggregate: Aggregate<unknown[]>): void {
  const pipeline = aggregate.pipeline() as PipelineStage[];
  const first = pipeline[0] as Record<string, Record<string, unknown>> | undefined;

  if (first && '$geoNear' in first) {
    const geoNear = first['$geoNear'];
    geoNear['query'] = {
      ...((geoNear['query'] as Record<string, unknown>) ?? {}),
      ...SOFT_DELETE_FILTER,
    };
  } else {
    pipeline.unshift({ $match: SOFT_DELETE_FILTER });
  }
}
