import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsAfterToday(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAfterToday',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (value === undefined || value === null || value === '') {
            return true;
          }
          if (typeof value === 'string') {
            const datePart = value.split('T')[0];
            const parts = datePart.split('-').map(Number);
            if (parts.length === 3 && !parts.some(isNaN)) {
              const [year, month, day] = parts;
              const selectedDate = new Date(year, month - 1, day);
              selectedDate.setHours(0, 0, 0, 0);

              const today = new Date();
              today.setHours(0, 0, 0, 0);

              return selectedDate.getTime() > today.getTime();
            }
          }
          const deadline = new Date(value as string | number | Date);
          if (isNaN(deadline.getTime())) {
            return false;
          }
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return deadline.getTime() > today.getTime();
        },
        defaultMessage(_args: ValidationArguments) {
          return 'Deadline must be greater than current day';
        },
      },
    });
  };
}
