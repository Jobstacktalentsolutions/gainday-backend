import {
  anchorGenerationSchema,
  findAnchorShapeProblem,
} from './anchor-generation.schema';

const points = [20, 40, 60, 80, 100];
const anchorsAt = (scores: number[]) => scores.map((score) => ({ score }));

describe('findAnchorShapeProblem', () => {
  it('accepts one anchor per score point, in order', () => {
    expect(findAnchorShapeProblem(anchorsAt(points), points)).toBeNull();
  });

  it('rejects a missing anchor', () => {
    expect(
      findAnchorShapeProblem(anchorsAt([20, 40, 60, 80]), points),
    ).toContain('expected exactly 5 anchors');
  });

  it('rejects the right scores in the wrong order', () => {
    expect(
      findAnchorShapeProblem(anchorsAt([40, 20, 60, 80, 100]), points),
    ).not.toBeNull();
  });

  it('rejects an invented score point', () => {
    expect(
      findAnchorShapeProblem(anchorsAt([20, 40, 60, 80, 90]), points),
    ).not.toBeNull();
  });

  it('rejects a set that still includes the removed 0 anchor', () => {
    expect(
      findAnchorShapeProblem(anchorsAt([0, 20, 40, 60, 80, 100]), points),
    ).not.toBeNull();
  });
});

describe('anchorGenerationSchema', () => {
  it('has no refinement, which strict Structured Outputs cannot represent', () => {
    // A refinement would make the anchors field a ZodEffects instead of a ZodArray.
    const anchors = anchorGenerationSchema(points).shape.anchors;
    expect(anchors._def.typeName).toBe('ZodArray');
  });
});
