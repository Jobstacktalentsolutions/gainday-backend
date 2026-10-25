import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface VerifiedGoogleIdentity {
  email: string;
  emailVerified: boolean;
  googleId: string;
}

/** Checks a Google ID token's signature, expiry and audience. Kept apart from login so the
 *  token handling can be mocked in tests. */
@Injectable()
export class GoogleTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly configService: ConfigService) {}

  async verify(credential: string): Promise<VerifiedGoogleIdentity> {
    const clientId = this.configService.get<string>('google.clientId');
    if (!clientId) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google sign-in failed. Please try again.');
    }

    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('Google sign-in failed. Please try again.');
    }

    return {
      email: payload.email,
      emailVerified: payload.email_verified === true,
      googleId: payload.sub,
    };
  }
}
