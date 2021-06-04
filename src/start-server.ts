import express from "express";
import http from "http";
import ConnectionServer from "./server/connection-server";
import fs from "fs";

const port = normalizePort(process.env.PORT || process.env.npm_package_config_port || '3000');
const host = '0.0.0.0';

const template = getConfig();
const app = createAppServer(port);
const httpServer = createHttpServer(host, port, app);
(async () => {
    const routes = await import('./routes/index');
    routes.use(app, new ConnectionServer(httpServer, template));
})();

function getConfig() {
    const filepath = process.env.CONFIG || process.env.npm_package_config_file || './src/server/config/defaults.json';
    console.log("Starting server using ", filepath);
    const file = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(file);
}

function createAppServer(port: number): express.Express {
    const app = express();
    app.set('port', port);
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
    return app;
}

function createHttpServer(host: string, port: number, app: express.Express): http.Server {
    const httpServer = http.createServer(app);
    httpServer.listen(port, host);
    httpServer.on('listening', onListen);
    httpServer.on('error', onError);
    return httpServer;
}

function normalizePort(val: string): number {
    const port = parseInt(val, 10);
    if (isNaN(port) || port < 0) {
        throw new Error(`Invalid port: ${val}`);
    }

    return port;
}

function onListen(): void {
    const addr = httpServer.address() ?? '';
    const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    console.log('Listening on ', bind);
}

function onError(error: any): void {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
        default:
            throw error;
    }
}