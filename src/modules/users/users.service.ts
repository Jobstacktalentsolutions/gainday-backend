import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .addSelect('user.password')
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { googleId } });
  }

  async createUser(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async setEmailVerificationToken(userId: string, token: string, expires: Date): Promise<void> {
    await this.userRepository.update(userId, {
      emailVerificationToken: token,
      emailVerificationExpires: expires,
    });
  }

  async verifyEmailByToken(token: string): Promise<User | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.emailVerificationToken = :token', { token })
      .addSelect('user.emailVerificationToken')
      .addSelect('user.emailVerificationExpires')
      .getOne();

    if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return null;
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    return this.userRepository.save(user);
  }

  async setPasswordResetToken(userId: string, token: string, expires: Date): Promise<void> {
    await this.userRepository.update(userId, {
      passwordResetToken: token,
      passwordResetExpires: expires,
    });
  }

  async findByValidPasswordResetToken(token: string): Promise<User | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.passwordResetToken = :token', { token })
      .addSelect('user.passwordResetToken')
      .addSelect('user.passwordResetExpires')
      .getOne();

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return null;
    }

    return user;
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.userRepository.update(userId, {
      password: hashedPassword,
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
    });
  }

  async updateUserCapabilityScores(userId: string, domain: string, scoreDetails: any): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const scores = user.capabilityScores || {};
    scores[domain] = {
      score: scoreDetails.score,
      updatedAt: new Date().toISOString(),
      categories: scoreDetails.categories,
    };

    user.capabilityScores = scores;
    return this.userRepository.save(user);
  }
}
