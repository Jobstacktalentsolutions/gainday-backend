"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const users_service_1 = require("../users/users.service");
const notifications_service_1 = require("../notifications/notifications.service");
const user_entity_1 = require("../users/entities/user.entity");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
let AuthService = class AuthService {
    usersService;
    jwtService;
    notificationsService;
    constructor(usersService, jwtService, notificationsService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.notificationsService = notificationsService;
    }
    async validateUser(email, password) {
        const user = await this.usersService.findByEmailWithPassword(email);
        if (!user) {
            return null;
        }
        if (!user.password) {
            return null;
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (isPasswordValid) {
            const { password, ...result } = user;
            return result;
        }
        return null;
    }
    async login(user) {
        const payload = { sub: user.id, email: user.email, role: user.role };
        const access_token = this.jwtService.sign(payload);
        return {
            access_token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                fullName: user.fullName,
                companyName: user.companyName,
            },
        };
    }
    async registerEmployer(dto) {
        const { email, password, fullName, companyName, agreedToTerms } = dto;
        const existingUser = await this.usersService.findByEmail(email);
        if (existingUser) {
            throw new common_1.ConflictException('Email already in use');
        }
        if (!agreedToTerms) {
            throw new common_1.BadRequestException('Must agree to terms to continue');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const user = await this.usersService.createUser({
            email,
            password: hashedPassword,
            fullName,
            companyName,
            role: user_entity_1.UserRole.EMPLOYER,
            authProvider: user_entity_1.AuthProvider.LOCAL,
            emailVerificationToken,
            emailVerificationExpires,
        });
        await this.notificationsService.sendVerificationEmail(email, emailVerificationToken);
        return this.login(user);
    }
    async registerJobSeeker(email, password, fullName) {
        const existingUser = await this.usersService.findByEmail(email);
        if (existingUser) {
            throw new common_1.ConflictException('Email already in use');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const user = await this.usersService.createUser({
            email,
            password: hashedPassword,
            fullName,
            role: user_entity_1.UserRole.JOB_SEEKER,
            authProvider: user_entity_1.AuthProvider.LOCAL,
            emailVerificationToken,
            emailVerificationExpires,
        });
        await this.notificationsService.sendVerificationEmail(email, emailVerificationToken);
        return this.login(user);
    }
    async requestPasswordReset(email) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            return;
        }
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000);
        await this.usersService.setPasswordResetToken(user.id, resetToken, resetExpires);
        await this.notificationsService.sendPasswordResetEmail(email, resetToken);
    }
    async resetPassword(dto) {
        const { password, confirmPassword, token } = dto;
        if (password !== confirmPassword) {
            throw new common_1.BadRequestException('Passwords do not match');
        }
        const user = await this.usersService.findByValidPasswordResetToken(token);
        if (!user) {
            throw new common_1.BadRequestException('Invalid or expired token');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await this.usersService.updatePassword(user.id, hashedPassword);
    }
    async verifyEmail(token) {
        const result = await this.usersService.verifyEmailByToken(token);
        return !!result;
    }
    async resendVerificationEmail(email) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            return;
        }
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await this.usersService.updateVerificationToken(user.id, emailVerificationToken, emailVerificationExpires);
        await this.notificationsService.sendVerificationEmail(email, emailVerificationToken);
    }
    async validateGoogleUser(googleUserData) {
        const { email, googleId, fullName } = googleUserData;
        let user = await this.usersService.findByGoogleId(googleId);
        if (!user) {
            user = await this.usersService.findByEmail(email);
            if (user) {
                await this.usersService.createUser({
                    ...user,
                    googleId,
                });
            }
            else {
                user = await this.usersService.createUser({
                    email,
                    googleId,
                    fullName,
                    role: user_entity_1.UserRole.EMPLOYER,
                    authProvider: user_entity_1.AuthProvider.GOOGLE,
                    isEmailVerified: true,
                });
            }
        }
        return this.login(user);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService,
        notifications_service_1.NotificationsService])
], AuthService);
//# sourceMappingURL=auth.service.js.map