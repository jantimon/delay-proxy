# Delay Proxy

## Overview

Delay Proxy is an experimental HTTPS proxy server designed for performance testing. It allows you to introduce configurable delays in the response stream to simulate different network conditions and analyze page load performance.


https://github.com/user-attachments/assets/2a0225ee-aee7-4fb3-b0b6-95c1858a7fda


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
   pnpm install
   ```

3. Generate SSL certificates:
   ```bash
   pnpm run cert
   ```

## Usage

1. Start the proxy server:
   ```bash
   pnpm start
   ```

2. Visit the proxy server:
   ```
   https://localhost:3000
   ```

## Configuration

You can configure the delay and split points by editing the `config.json` file or via the `/help` page provided by the server.

### Experiment Ideas

Here are some examples of interesting experiments you can try:

- **Streaming only until `<body>`:**
  Configure the split point to stop streaming at the `<body>` tag.
  ```json
  {
    "splitPoints": ["<body"]
  }
  ```

- **Streaming after header:**
  Configure the split point to start streaming after the header.
  ```json
  {
    "splitPoints": ["</header>"]
  }
  ```

- **Pausing after the LCP element (e.g., the first image):**
  Configure the split point to pause after the LCP element.
  ```json
  {
    "splitPoints": ["<img"]
  }
  ```

### Split Chunks Configuration

You can configure split chunks using regular expressions in the `config.json` file. This allows you to define more flexible split points.

Example:
```json
{
  "splitPoints": ["/<div class=\"layout_Page__uf51q\"/i", "/<body/i"]
}
```

### User Research Simulations

This setup can be useful for simulating different network conditions and delays for user research. By introducing controlled delays, you can observe how users interact with your website under various scenarios.

## License

This project is licensed under the MIT License.
