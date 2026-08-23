import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupEmployerDto } from './dto/signup-employer.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
export declare class AuthController {
    private readonly authService;
    private readonly configService;
    constructor(authService: AuthService, configService: ConfigService);
    login(loginDto: LoginDto): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            role: any;
            fullName: any;
            companyName: any;
        };
    }>;
    signup(signupDto: SignupEmployerDto): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            role: any;
            fullName: any;
            companyName: any;
        };
    }>;
    registerEmployer(signupDto: SignupEmployerDto): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            role: any;
            fullName: any;
            companyName: any;
        };
    }>;
    registerCandidate(body: any): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            role: any;
            fullName: any;
            companyName: any;
        };
    }>;
    requestPasswordReset(dto: RequestPasswordResetDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    verifyEmail(token: string, res: Response): Promise<void>;
    googleAuth(): void;
    googleCallback(user: any, res: Response): Promise<void>;
    getProfile(user: any): {
        user: any;
    };
}
