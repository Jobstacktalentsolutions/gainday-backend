import { dropUnspecifiedFields } from './drop-unspecified-fields';
import type { ParsedJobDescription } from './schemas/parsed-job-description.schema';

const empty: ParsedJobDescription = {
  title: null,
  role: null,
  skillLevel: null,
  skillCategory: null,
  location: null,
  employmentType: null,
  deadline: null,
  isRemoteFriendly: null,
  salaryFrom: null,
  salaryTo: null,
  companyDescription: null,
  skills: null,
  formattedDescription: 'Full description.',
  businessProblem: null,
};

describe('dropUnspecifiedFields', () => {
  it('drops nulls and keeps the fields the posting specified', () => {
    expect(
      dropUnspecifiedFields({ ...empty, title: 'Analyst', salaryFrom: 40000 }),
    ).toEqual({
      title: 'Analyst',
      salaryFrom: 40000,
      formattedDescription: 'Full description.',
    });
  });

  it.each(['null', 'NULL', ' N/A ', 'None', 'not stated', ''])(
    'drops the placeholder text "%s" from a text field',
    (placeholder) => {
      expect(
        dropUnspecifiedFields({ ...empty, companyDescription: placeholder }),
      ).not.toHaveProperty('companyDescription');
    },
  );

  it('keeps real text that merely contains a placeholder word', () => {
    expect(
      dropUnspecifiedFields({
        ...empty,
        companyDescription: 'We sell null-free water.',
      }),
    ).toHaveProperty('companyDescription', 'We sell null-free water.');
  });

  it('drops non-positive salaries', () => {
    const cleaned = dropUnspecifiedFields({
      ...empty,
      salaryFrom: -1,
      salaryTo: 0,
    });
    expect(cleaned).not.toHaveProperty('salaryFrom');
    expect(cleaned).not.toHaveProperty('salaryTo');
  });

  it('drops the upper bound of a salary range that is below the lower bound', () => {
    expect(
      dropUnspecifiedFields({ ...empty, salaryFrom: 50000, salaryTo: 40000 }),
    ).toEqual({
      salaryFrom: 50000,
      formattedDescription: 'Full description.',
    });
  });

  it('keeps false for isRemoteFriendly, since it is a real answer', () => {
    expect(
      dropUnspecifiedFields({ ...empty, isRemoteFriendly: false }),
    ).toHaveProperty('isRemoteFriendly', false);
  });

  it('removes placeholder items from the skills list and drops it when nothing real remains', () => {
    expect(
      dropUnspecifiedFields({ ...empty, skills: ['null', 'Excel'] }),
    ).toHaveProperty('skills', ['Excel']);
    expect(
      dropUnspecifiedFields({ ...empty, skills: ['null'] }),
    ).not.toHaveProperty('skills');
  });
});
