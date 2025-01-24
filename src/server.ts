import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import https from 'https';
import fs from 'fs';
import zlib from 'zlib';
import { Readable } from 'stream';

interface Config {
    target: string;
    bodyDelay: number;
    splitPoints: string[];
}

interface CacheEntry {
    headers: Record<string, string | string[] | undefined>;
    content: Buffer;
    encoding: string | undefined;
}

const app = express();
const pageCache: Map<string, CacheEntry> = new Map();
let config: Config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
let introCompleted: boolean = false;

const sslConfig = {
    key: fs.readFileSync('./certificate/key.pem'),
    cert: fs.readFileSync('./certificate/cert.pem')
};

async function handleCompressedResponse(proxyRes: any): Promise<Buffer> {
    const encoding = proxyRes.headers['content-encoding'];
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
        if (encoding === 'gzip') {
            const gunzip = zlib.createGunzip();
            proxyRes.pipe(gunzip);
            
            gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
            gunzip.on('end', () => resolve(Buffer.concat(chunks)));
            gunzip.on('error', reject);
        } else if (encoding === 'br') {
            const brotli = zlib.createBrotliDecompress();
            proxyRes.pipe(brotli);
            
            brotli.on('data', (chunk: Buffer) => chunks.push(chunk));
            brotli.on('end', () => resolve(Buffer.concat(chunks)));
            brotli.on('error', reject);
        } else {
            proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
            proxyRes.on('end', () => resolve(Buffer.concat(chunks)));
        }
    });
};

// Help routes
app.get('/help', (req: Request, res: Response) => {
    introCompleted = true;
    res.sendFile(__dirname + '/help.html');
});

app.get('/help/config', (req: Request, res: Response) => {
    res.json(config);
});

app.post('/help/config', express.json(), (req: Request, res: Response) => {
    const isValid = 
        typeof req.body.delay === 'number' && 
        req.body.delay >= 0 &&
        Array.isArray(req.body.splitPoints);
    
    if (isValid) {
        config.bodyDelay = req.body.delay;
        config.splitPoints = req.body.splitPoints;
        config.target = req.body.target || config.target;
        fs.writeFileSync('config.json', JSON.stringify(config, null, 4));
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Invalid configuration' });
    }
});

// Proxy middleware setup
const proxyMiddleware: RequestHandler = createProxyMiddleware({
    target: config.target,
    changeOrigin: true,
    secure: true,
    selfHandleResponse: true,
    onProxyRes: async (proxyRes, req, res) => {
        if (!proxyRes.headers['content-type']?.includes('text/html') || 
            req.path.includes('.') || 
            req.path.includes('/_ops/')) {
            
            Object.entries(proxyRes.headers).forEach(([key, value]) => {
                if (value) res.setHeader(key, value);
            });
            proxyRes.pipe(res);
            return;
        }

        const targetUrl = new URL(req.url, config.target).toString();

        try {
            const responseBuffer = await handleCompressedResponse(proxyRes);
            
            pageCache.set(targetUrl, {
                headers: proxyRes.headers,
                content: responseBuffer,
                encoding: proxyRes.headers['content-encoding']
            });
            
            if (!introCompleted) {
                introCompleted = true;
                res.sendFile(__dirname + '/help.html');
            } else {
                res.sendFile(__dirname + '/info.html');
            }
        } catch (error) {
            console.error('Error handling response:', error);
            res.status(500).send('Error processing request');
        }
    }
});

// Mount middleware
app.use('/', async (req: Request, res: Response, next: NextFunction) => {
    const targetUrl = new URL(req.url, config.target).toString();
    const startTime = Date.now();
    
    if (req.query['no-cache']) {
        pageCache.delete(targetUrl);
        return next();
    }

    if (!req.path.includes('.') && 
        !req.path.includes('/_ops/') && 
        pageCache.has(targetUrl)) {
        
        console.log("\n🚀 Serving cached page", targetUrl);
        const cached = pageCache.get(targetUrl);
        
        if (cached) {
            try {
                const log = (...msg: unknown[]) => console.log(`[+${Date.now() - startTime}ms]`, ...msg);
                
                log("Start streaming", req.url);
                
                // Set essential headers
                const excludedHeaders = new Set([
                    'content-encoding',
                    'content-length',
                    'transfer-encoding',
                    'connection',
                    'cache-control',
                    'pragma'
                ]);

                // Set response headers
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Transfer-Encoding', 'chunked');
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');

                // Copy other headers from cache
                for (const [key, value] of Object.entries(cached.headers)) {
                    if (!excludedHeaders.has(key.toLowerCase()) && value !== undefined) {
                        res.setHeader(key, value);
                    }
                }

                const contentStr = cached.content.toString('utf-8');

                let splitPosition: number = contentStr.length;
                for (const point of config.splitPoints) {
                    if (point.startsWith('/') && point.endsWith('/')) {
                        const regex = new RegExp(point.slice(1, -1), 'gi');
                        if (regex.test(contentStr)) {
                            splitPosition = contentStr.search(regex);
                            log("Splitting at regex", regex);
                            break;
                        }
                    }
                    if (contentStr.includes(point)) {
                        splitPosition = contentStr.indexOf(point);
                        log("Splitting at", point);
                        break;
                    }
                }
                const [firstPart, secondPart] = [
                    contentStr.slice(0, splitPosition),
                    contentStr.slice(splitPosition)
                ];

                // Create streams
                const firstStream = Readable.from(firstPart);
                const secondStream = secondPart ? Readable.from(secondPart) : null;

                // Stream first part
                await new Promise<void>((resolve, reject) => {
                    firstStream.pipe(res, { end: !secondPart });
                    firstStream.on('end', resolve);
                    firstStream.on('error', reject);
                });

                // Handle second part if it exists
                if (secondPart && secondStream) {
                    log("Delaying response by", config.bodyDelay, "ms");
                    await new Promise(resolve => setTimeout(resolve, config.bodyDelay));
                    
                    log("Streaming second part");
                    await new Promise<void>((resolve, reject) => {
                        secondStream.pipe(res, { end: true });
                        secondStream.on('end', () => {
                            log("Finished streaming");
                            resolve();
                        });
                        secondStream.on('error', reject);
                    });
                } else {
                    log("Finished streaming");
                    res.end();
                }
            } catch (error) {
                console.error('Error streaming from cache:', error);
            }
        }
    }
    next();
});
app.use('/', proxyMiddleware);

// Start server
const httpsServer = https.createServer(sslConfig, app);
const PORT: number = process.env.PORT ? parseInt(process.env.PORT) : 3000;

httpsServer.listen(PORT, () => {
    console.log(`✅ HTTPS proxy server running on port ${PORT}`);
    console.log(`🚀 Visit https://localhost:${PORT}`);
});