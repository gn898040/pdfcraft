import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

function resolveAppVersion() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  if (process.env.NEXT_PUBLIC_APP_VERSION) return process.env.NEXT_PUBLIC_APP_VERSION;

  try {
    const gitHash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const commitDate = execSync('git log -1 --format=%cd --date=format:%Y.%m.%d', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (gitHash && commitDate) {
      return `v${commitDate}-${gitHash}`;
    }
  } catch {
    // Git not available or not a git repository
  }

  return process.env.npm_package_version || '0.1.0';
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export for deployment flexibility
  output: 'export',
  
  // 強制指定 GitHub Pages 的子路徑
  basePath: '/pdfcraft',
  assetPrefix: '/pdfcraft',

  env: {
    NEXT_PUBLIC_APP_VERSION: resolveAppVersion(),
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(),
    // 確保前端元件、Worker 與 iframe 都能正確讀取到子路徑
    BASE_PATH: '/pdfcraft',
    NEXT_PUBLIC_BASE_PATH: '/pdfcraft',
    NEXT_PUBLIC_ASSET_PREFIX: '/pdfcraft',
    NEXT_PUBLIC_DISABLE_UPDATE_CHECK:
      process.env.DISABLE_UPDATE_CHECK || process.env.NEXT_PUBLIC_DISABLE_UPDATE_CHECK || 'false',
  },

  // Webpack configuration for WASM modules
  webpack: (config, { isServer, webpack }) => {
    // Handle qpdf-wasm and other modules that use Node.js built-ins
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        module: false,
        url: false,
        worker_threads: false,
        canvas: false,  // Required for pdfjs-dist-legacy
      };
    } else {
      // Mark canvas as external for server-side builds
      config.externals = config.externals || [];
      config.externals.push({
        canvas: 'commonjs canvas',
      });
    }

    // Also add module and canvas to alias for some packages that use it
    config.resolve.alias = {
      ...config.resolve.alias,
      'module': false,
    };

    // Ignore problematic modules that are not needed in browser
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^module$/
      }),
      new webpack.IgnorePlugin({
        resourceRegExp: /^canvas$/,
        contextRegExp: /pdfjs-dist-legacy/
      })
    );

    // Enable WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },

  // Image optimization configuration
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  turbopack: {
    resolveAlias: {
      canvas: './src/lib/mocks/canvas.js',
    },
  },

  // 強制所有靜態路徑加上結尾斜線，確保 iframe 載入時能正確識別為目錄而不會 404
  trailingSlash: true,
  reactStrictMode: false,

  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
};

export default withNextIntl(nextConfig);
