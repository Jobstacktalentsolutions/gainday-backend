import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(req: any): Promise<any>;
    getUserById(id: string): Promise<import("./entities/user.entity").User | null>;
}
