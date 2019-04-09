/*
The person who associated a work with this deed has dedicated the work to the
public domain by waiving all of his or her rights to the work worldwide under
copyright law, including all related and neighboring rights, to the extent
allowed by law.

You can copy, modify, distribute and perform the work, even for commercial
purposes, all without asking permission.

AFFIRMER OFFERS THE WORK AS-IS AND MAKES NO REPRESENTATIONS OR WARRANTIES OF
ANY KIND CONCERNING THE WORK, EXPRESS, IMPLIED, STATUTORY OR OTHERWISE,
INCLUDING WITHOUT LIMITATION WARRANTIES OF TITLE, MERCHANTABILITY, FITNESS FOR
A PARTICULAR PURPOSE, NON INFRINGEMENT, OR THE ABSENCE OF LATENT OR OTHER
DEFECTS, ACCURACY, OR THE PRESENT OR ABSENCE OF ERRORS, WHETHER OR NOT
DISCOVERABLE, ALL TO THE GREATEST EXTENT PERMISSIBLE UNDER APPLICABLE LAW.

For more information, please see
<http://creativecommons.org/publicdomain/zero/1.0/>
*/

let server = null;

const http = require('http');

const msgboi = require('./msgboi/main');
const logger = require('./msgboi/logger');
const config = require('./msgboi/config');

global.MsgboiError = require('./msgboi/error');

process.on('SIGINT',  exitGracefully);
process.on('SIGHUP',  exitGracefully);
process.on('SIGQUIT', exitGracefully);
process.on('SIGTERM', exitGracefully);

logger.info('msgboi has started');


/**
    --- TODO: docs ---
 */
async function exitGracefully()
{
    if (server) {
        logger.warn('got SIGNAL');
        logger.info('closing server');

        await server.close(() => {
            logger.info('exiting...');
            process.exit(0);
        });
    }
}


async function handle(c, d)
{
    try {
        return await msgboi.handle(c, d);
    }
    catch (e) {
        return e.content;
    }
}


/**
    --- TODO: docs ---
 */
async function loadService(setting)
{
    server = http.createServer((req, res) => {
        const r = req.connection.remoteAddress;
        let body = [];
        let code = 200;

        req.on('data', (d) => {
            body.push(d);

            if (body.length > 1e6) {
                req.connection.destroy();
            }
        });

        req.on('end', async () => {
            if (code === 200) {
                body = Buffer.concat(body).toString();
                if (body.length) {
                    const result = await handle(setting.config, body);

                    const log = `(${r}) ${result.message}`;
                    if (result.code < 400) {
                        logger.success(log);
                    }
                    else {
                        logger.error(log);
                    }

                    code = result.code;
                }
                else {
                    logger.error(`(${r}) send no content`);
                    code = 400;
                }
            }

            res.statusCode = code;
            res.end();
        });

        if (req.url !== '/') {
            logger.error(`(${r}) requested "${req.url}"`);
            code = 404;
        }

        else if (req.method !== 'POST') {
            logger.error(`(${r}) called with "${req.method}"`);
            code = 405;
        }

        else if (req.headers['content-type'] !== 'application/json') {
            logger.error(`(${r}) used type "${req.headers['content-type']}"`);
            code = 415;
        }
    });

    server.listen(setting.port, setting.host, () => {
        logger.info(`listening on port ${setting.port}`);
    });
}


/**
    --- TODO: docs ---
 */
(async () =>
{
    const port = process.env.MSGBOI_PORT || 8080;
    const host = process.env.MSGBOI_HOST || 'localhost';

    try {
        loadService({
            port: port,
            host: host,
            config: await config.load(),
        });
    }
    catch (e) {
        logger.error(e.content.message);
        logger.info('exiting...');
        process.exit(1);
    }
})();
