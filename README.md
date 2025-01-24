# Delay Proxy

## Overview

Delay Proxy is an experimental HTTPS proxy server designed for performance testing. It allows you to introduce configurable delays in the response stream to simulate different network conditions and analyze page load performance.

## Features

- **Caching:** Caches the HTML content on the first visit.
- **Configurable Delay:** Streams content with a configurable delay at the `<body>` tag on subsequent visits.
- **Cache Control:** Add `?no-cache` to any URL to clear its cache.
- **Static Assets:** Proxies static files (images, CSS, JS) without caching or delays.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/jantimon/delay-proxy.git
   cd delay-proxy
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Generate SSL certificates:
   ```bash
   npm run cert
   ```

## Usage

1. Start the proxy server:
   ```bash
   npm start
   ```

2. Visit the proxy server:
   ```
   https://localhost:3000
   ```

## Configuration

You can configure the delay and split points by editing the `config.json` file or via the `/help` page provided by the server.

## License

This project is licensed under the MIT License.