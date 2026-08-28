import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(user: any): Promise<any>;
    getUserById(id: string, currentUser: any): Promise<import("./entities/user.entity").User>;
}
