import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SignupEmployerDto } from './dto/signup-employer.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
export declare class AuthService {
    private readonly usersService;
    private readonly jwtService;
    private readonly notificationsService;
    constructor(usersService: UsersService, jwtService: JwtService, notificationsService: NotificationsService);
    validateUser(email: string, password: string): Promise<any>;
    login(user: any): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            role: any;
            fullName: any;
            companyName: any;
        };
    }>;
    registerEmployer(dto: SignupEmployerDto): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            role: any;
            fullName: any;
            companyName: any;
        };
    }>;
    registerJobSeeker(email: string, password: string, fullName: string): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            role: any;
            fullName: any;
            companyName: any;
        };
    }>;
    requestPasswordReset(email: string): Promise<void>;
    resetPassword(dto: ResetPasswordDto): Promise<void>;
    verifyEmail(token: string): Promise<boolean>;
    validateGoogleUser(googleUserData: any): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            role: any;
            fullName: any;
            companyName: any;
        };
    }>;
}
