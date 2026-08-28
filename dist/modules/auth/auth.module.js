"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const users_module_1 = require("../users/users.module");
const notifications_module_1 = require("../notifications/notifications.module");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const jwt_strategy_1 = require("./strategies/jwt.strategy");
const google_strategy_1 = require("./strategies/google.strategy");
const roles_guard_1 = require("./guards/roles.guard");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const optional_jwt_auth_guard_1 = require("./guards/optional-jwt-auth.guard");
const jwtModuleOptions = {
    imports: [config_1.ConfigModule],
    inject: [config_1.ConfigService],
    useFactory: (configService) => {
        const expiresIn = configService.get('jwt.expiresIn') || '7d';
        return {
            secret: configService.get('jwt.secret'),
            signOptions: { expiresIn: expiresIn },
        };
    },
};
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => users_module_1.UsersModule),
            notifications_module_1.NotificationsModule,
            passport_1.PassportModule,
            jwt_1.JwtModule.registerAsync(jwtModuleOptions),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService, jwt_strategy_1.JwtStrategy, google_strategy_1.GoogleStrategy, roles_guard_1.RolesGuard, jwt_auth_guard_1.JwtAuthGuard, optional_jwt_auth_guard_1.OptionalJwtAuthGuard],
        exports: [auth_service_1.AuthService, roles_guard_1.RolesGuard, jwt_auth_guard_1.JwtAuthGuard, optional_jwt_auth_guard_1.OptionalJwtAuthGuard, passport_1.PassportModule],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map