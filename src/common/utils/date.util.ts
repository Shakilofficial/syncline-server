import { BadRequestException } from '@nestjs/common';

export class DateUtil {
  static validateFutureDate(date: Date | string, fieldName = 'Due date'): Date {
    const d = date instanceof Date ? date : new Date(date);

    if (isNaN(d.getTime())) {
      throw new BadRequestException({
        message: `${fieldName} is not a valid date`,
        code: 'VALIDATION_ERROR',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (d < today) {
      throw new BadRequestException({
        message: 'Please select a valid deadline',
        code: 'TASK_PAST_DEADLINE',
      });
    }

    return d;
  }

  static isOverdue(date: Date | null | undefined): boolean {
    if (!date) return false;
    return new Date(date) < new Date();
  }
}
