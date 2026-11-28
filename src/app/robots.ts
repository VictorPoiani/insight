import { publicSiteUrl } from '@/lib/publicSiteUrl';
import type { MetadataRoute } from 'next';

const SITE = publicSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // áreas pessoais, administrativas e a API não interessam a buscadores
        disallow: ['/api/', '/config', '/notificacoes', '/moderacao', '/notebook', '/login', '/redefinir-senha', '/verificar-email'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
