# SSL Certificates

This folder contains SSL certificate files required for running the application in HTTPS mode.

## Required Files
- `cert.pem` - The SSL certificate file
- `key.pem` - The private key file

## Creating Certificates
You have to generate self-signed certificates using the following methods:

### Using npm Script
The easiest way is to use the provided npm script:
```bash
npm run cert
```

### Manual Creation
Alternatively, you can create the certificates manually using OpenSSL:
```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes
```

**Note:** Self-signed certificates will trigger browser security warnings.