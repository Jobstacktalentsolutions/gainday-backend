import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
export declare class UsersService {
    private readonly userRepository;
    constructor(userRepository: Repository<User>);
    findByEmail(email: string): Promise<User | null>;
    findByEmailWithPassword(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    findByGoogleId(googleId: string): Promise<User | null>;
    createUser(data: Partial<User>): Promise<User>;
    setEmailVerificationToken(userId: string, token: string, expires: Date): Promise<void>;
    updateVerificationToken(userId: string, token: string, expires: Date): Promise<void>;
    verifyEmailByToken(token: string): Promise<User | null>;
    setPasswordResetToken(userId: string, token: string, expires: Date): Promise<void>;
    findByValidPasswordResetToken(token: string): Promise<User | null>;
    updatePassword(userId: string, hashedPassword: string): Promise<void>;
    updateUserCapabilityScores(userId: string, domain: string, scoreDetails: any): Promise<User>;
}
