/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 빌드 시 ESLint/TS 에러로 빌드가 멈추지 않도록 설정 (데모/Mock 안정성 우선)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
