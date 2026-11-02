import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_EMAIL_KEY = 'allowUnverifiedEmail';

/** Lets a signed-in, not-yet-verified employer or job seeker reach this route. Use only for the
 *  endpoints the verification screen and the app shell need, such as reading the current user. */
export const AllowUnverifiedEmail = () =>
  SetMetadata(ALLOW_UNVERIFIED_EMAIL_KEY, true);
