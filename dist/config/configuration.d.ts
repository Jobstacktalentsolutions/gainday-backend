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
};
export default _default;
