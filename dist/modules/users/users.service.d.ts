import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
export declare class UsersService {
    private readonly userRepository;
    constructor(userRepository: Repository<User>);
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    createUser(data: Partial<User>): Promise<User>;
    updateUserCapabilityScores(userId: string, domain: string, scoreDetails: any): Promise<User>;
}
