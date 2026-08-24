"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("./entities/user.entity");
let UsersService = class UsersService {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async findByEmail(email) {
        return this.userRepository.findOne({ where: { email } });
    }
    async findByEmailWithPassword(email) {
        return this.userRepository
            .createQueryBuilder('user')
            .where('user.email = :email', { email })
            .addSelect('user.password')
            .getOne();
    }
    async findById(id) {
        return this.userRepository.findOne({ where: { id } });
    }
    async findByGoogleId(googleId) {
        return this.userRepository.findOne({ where: { googleId } });
    }
    async createUser(data) {
        const user = this.userRepository.create(data);
        return this.userRepository.save(user);
    }
    async setEmailVerificationToken(userId, token, expires) {
        await this.userRepository.update(userId, {
            emailVerificationToken: token,
            emailVerificationExpires: expires,
        });
    }
    async updateVerificationToken(userId, token, expires) {
        await this.userRepository.update(userId, {
            emailVerificationToken: token,
            emailVerificationExpires: expires,
        });
    }
    async verifyEmailByToken(token) {
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
    async setPasswordResetToken(userId, token, expires) {
        await this.userRepository.update(userId, {
            passwordResetToken: token,
            passwordResetExpires: expires,
        });
    }
    async findByValidPasswordResetToken(token) {
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
    async updatePassword(userId, hashedPassword) {
        await this.userRepository.update(userId, {
            password: hashedPassword,
            passwordResetToken: undefined,
            passwordResetExpires: undefined,
        });
    }
    async updateUserCapabilityScores(userId, domain, scoreDetails) {
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
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map