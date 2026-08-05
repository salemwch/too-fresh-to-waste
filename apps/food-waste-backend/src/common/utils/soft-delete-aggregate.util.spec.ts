import { applySoftDeleteFilter } from './soft-delete-aggregate.util';

import type { PipelineStage } from 'mongoose';

function makeFakeAggregate(pipeline: PipelineStage[]) {
  return { pipeline: () => pipeline } as unknown as import('mongoose').Aggregate<unknown[]>;
}

describe('applySoftDeleteFilter', () => {
  it('prepends $match when pipeline starts with a non-$geoNear stage', () => {
    const pipeline: PipelineStage[] = [{ $match: { status: 'active' } }, { $limit: 10 }];
    applySoftDeleteFilter(makeFakeAggregate(pipeline));

    expect(pipeline[0]).toEqual({ $match: { isDeleted: { $ne: true } } });
    expect(pipeline).toHaveLength(3);
  });

  it('prepends $match when pipeline is empty', () => {
    const pipeline: PipelineStage[] = [];
    applySoftDeleteFilter(makeFakeAggregate(pipeline));

    expect(pipeline[0]).toEqual({ $match: { isDeleted: { $ne: true } } });
    expect(pipeline).toHaveLength(1);
  });

  it('merges into $geoNear.query when pipeline starts with $geoNear', () => {
    const pipeline: PipelineStage[] = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [10, 36] },
          distanceField: 'distance',
          maxDistance: 5000,
          spherical: true,
          query: { isActive: true },
        },
      },
      { $limit: 20 },
    ];

    applySoftDeleteFilter(makeFakeAggregate(pipeline));

    expect(pipeline).toHaveLength(2);
    const geoNear = (pipeline[0] as unknown as Record<string, Record<string, unknown>>)['$geoNear'];
    expect(geoNear?.['query']).toEqual({
      isActive: true,
      isDeleted: { $ne: true },
    });
  });

  it('creates query object on $geoNear when none exists', () => {
    const pipeline: PipelineStage[] = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [10, 36] },
          distanceField: 'distance',
          spherical: true,
        },
      },
    ];

    applySoftDeleteFilter(makeFakeAggregate(pipeline));

    const geoNear = (pipeline[0] as unknown as Record<string, Record<string, unknown>>)['$geoNear'];
    expect(geoNear?.['query']).toEqual({ isDeleted: { $ne: true } });
  });

  it('does not move $geoNear from the first position', () => {
    const pipeline: PipelineStage[] = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [10, 36] },
          distanceField: 'distance',
          spherical: true,
        },
      },
      { $limit: 10 },
    ];

    applySoftDeleteFilter(makeFakeAggregate(pipeline));

    expect(Object.keys(pipeline[0] as unknown as Record<string, unknown>)[0]).toBe('$geoNear');
    expect(pipeline).toHaveLength(2);
  });
});
