/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Vercel 서버리스 함수에 폰트·PDF 템플릿 파일을 번들에 포함
  // (public/ 파일은 CDN에만 올라가고 fs로 접근 불가 → 명시적으로 추가)
  experimental: {
    outputFileTracingIncludes: {
      '/api/funding-plan/pdf': [
        './public/fonts/NotoSansKR-Regular.otf',
        './public/forms/housing-form.pdf',
      ],
      '/api/agreements': [
        './public/fonts/NotoSansKR-Regular.otf',
      ],
    },
  },
};

export default nextConfig;
