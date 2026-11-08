import { validate } from 'class-validator';
import { CreateJobDto } from './create-job.dto';

describe('IsAfterToday validator', () => {
  const getValidJob = () => {
    const dto = new CreateJobDto();
    dto.title = 'Software Engineer';
    dto.role = 'Engineering';
    dto.skillLevel = 'Mid';
    dto.location = 'London, UK';
    dto.employmentType = 'Full-time';
    return dto;
  };

  it('passes when deadline is not provided', async () => {
    const dto = getValidJob();
    const errors = await validate(dto);
    const deadlineErrors = errors.filter((e) => e.property === 'applicationDeadline');
    expect(deadlineErrors).toHaveLength(0);
  });

  it('passes when deadline is in the future', async () => {
    const dto = getValidJob();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    dto.applicationDeadline = futureDate.toISOString();

    const errors = await validate(dto);
    const deadlineErrors = errors.filter((e) => e.property === 'applicationDeadline');
    expect(deadlineErrors).toHaveLength(0);
  });

  it('fails when deadline is today', async () => {
    const dto = getValidJob();
    const today = new Date();
    dto.applicationDeadline = today.toISOString();

    const errors = await validate(dto);
    const deadlineErrors = errors.filter((e) => e.property === 'applicationDeadline');
    expect(deadlineErrors).toHaveLength(1);
    expect(deadlineErrors[0].constraints?.isAfterToday).toBe(
      'Deadline must be greater than current day',
    );
  });

  it('fails when deadline is in the past', async () => {
    const dto = getValidJob();
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    dto.applicationDeadline = pastDate.toISOString();

    const errors = await validate(dto);
    const deadlineErrors = errors.filter((e) => e.property === 'applicationDeadline');
    expect(deadlineErrors).toHaveLength(1);
    expect(deadlineErrors[0].constraints?.isAfterToday).toBe(
      'Deadline must be greater than current day',
    );
  });
});
