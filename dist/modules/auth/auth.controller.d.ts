import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(body: any): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            role: any;
        };
    }>;
    registerEmployer(body: any): Promise<import("../users/entities/user.entity").User>;
    registerCandidate(body: any): Promise<import("../users/entities/user.entity").User>;
}
