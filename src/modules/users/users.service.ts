import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import { DrizzleDb } from '../../db/client';
import { users, User, NewUser, CapabilityScores } from '../../db/schema';

const publicColumns = {
  id: users.id,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  email: users.email,
  role: users.role,
  authProvider: users.authProvider,
  googleId: users.googleId,
  fullName: users.fullName,
  companyName: users.companyName,
  phoneNumber: users.phoneNumber,
  isEmailVerified: users.isEmailVerified,
  capabilityScores: users.capabilityScores,
  isActive: users.isActive,
};

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db.select(publicColumns).from(users).where(eq(users.email, email));
    return (user as User) ?? null;
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    return user ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const [user] = await this.db.select(publicColumns).from(users).where(eq(users.id, id));
    return (user as User) ?? null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const [user] = await this.db.select(publicColumns).from(users).where(eq(users.googleId, googleId));
    return (user as User) ?? null;
  }

  async createUser(data: Partial<NewUser>): Promise<User> {
    const [user] = await this.db.insert(users).values(data as NewUser).returning();
    return user;
  }

  async setEmailVerificationToken(userId: string, token: string, expires: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ emailVerificationToken: token, emailVerificationExpires: expires, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateVerificationToken(userId: string, token: string, expires: Date): Promise<void> {
    await this.setEmailVerificationToken(userId, token, expires);
  }

  async verifyEmailByToken(token: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.emailVerificationToken, token));

    if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return null;
    }

    const [updated] = await this.db
      .update(users)
      .set({
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning(publicColumns);

    return updated as User;
  }

  async setPasswordResetToken(userId: string, token: string, expires: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordResetToken: token, passwordResetExpires: expires, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async findByValidPasswordResetToken(token: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.passwordResetToken, token));

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return null;
    }

    return user;
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateUserCapabilityScores(userId: string, domain: string, scoreDetails: any): Promise<User> {
    const [existing] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!existing) {
      throw new Error('User not found');
    }

    const scores: CapabilityScores = existing.capabilityScores || {};
    scores[domain] = {
      score: scoreDetails.score,
      updatedAt: new Date().toISOString(),
      categories: scoreDetails.categories,
    };

    const [updated] = await this.db
      .update(users)
      .set({ capabilityScores: scores, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning(publicColumns);

    return updated as User;
  }
}
