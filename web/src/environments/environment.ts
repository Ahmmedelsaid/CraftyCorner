export const environment = {
  production: true,
  // في الـ production الـ API بيتخدم من نفس الدومين (reverse proxy)
  apiUrl: '/api',
  // روابط بين الموقعين. هتتظبط لما نقرر شكل النشر (دومين / subdomain / مسار)
  storeUrl: '/',
  adminUrl: '/admin/',
};
