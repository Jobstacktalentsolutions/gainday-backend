import { UsersService } from '../users/users.service';
export declare class AuthService {
    private readonly usersService;
    constructor(usersService: UsersService);
    validateUser(email: string, pass: string): Promise<any>;
    login(user: any): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            role: any;
        };
    }>;
    registerEmployer(email: string, pass: string, companyName: string, fullName: string): Promise<import("../users/entities/user.entity").User>;
    registerJobSeeker(email: string, pass: string, fullName: string): Promise<import("../users/entities/user.entity").User>;
}
