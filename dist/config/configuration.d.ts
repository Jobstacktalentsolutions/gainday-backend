declare const _default: () => {
    port: number;
    database: {
        url: string;
    };
    redis: {
        url: string;
        host: any;
        port: any;
        username: any;
        password: any;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    email: {
        brevoApiKey: string;
        fromEmail: string;
        fromName: string;
        appUrl: string;
    };
    google: {
        clientId: string | undefined;
        clientSecret: string | undefined;
        callbackUrl: string;
    };
    frontendUrl: string;
};
export default _default;
