import type {
  AdminProfile,
  EmployerProfile,
  JobSeekerProfile,
} from '../../db/schema';

type AnyProfile = JobSeekerProfile | EmployerProfile | AdminProfile;

/** The candidate-only profile fields the frontend reads off the signed-in user. Empty for any
 *  other role's profile (or none), so it can be spread into a user payload unconditionally. */
export function jobSeekerProfileFields(profile: AnyProfile | null | undefined) {
  if (!profile || !('isProfileComplete' in profile)) {
    return {};
  }
  return {
    gender: profile.gender,
    pronouns: profile.pronouns,
    brief: profile.brief,
    isProfileComplete: profile.isProfileComplete,
  };
}
