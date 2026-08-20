"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url_1 = require("url");
exports.default = () => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    let redisConfig = { host: 'localhost', port: 6379 };
    try {
        const parsed = new url_1.URL(redisUrl);
        redisConfig = {
            host: parsed.hostname,
            port: parseInt(parsed.port || '6379', 10),
            username: parsed.username || undefined,
            password: parsed.password || undefined,
        };
    }
    catch (error) {
        console.error('Failed to parse REDIS_URL, using default localhost:', error);
    }
    return {
        port: parseInt(process.env.PORT || '3000', 10),
        database: {
            url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gainday',
        },
        redis: {
            url: redisUrl,
            host: redisConfig.host,
            port: redisConfig.port,
            username: redisConfig.username,
            password: redisConfig.password,
        },
        jwt: {
            secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        },
    };
};
//# sourceMappingURL=configuration.js.map