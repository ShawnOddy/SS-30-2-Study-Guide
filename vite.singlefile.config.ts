import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function inlineSingleFileHtmlPlugin(outDirName: string, outputFileName: string): Plugin {
  return {
    name: 'inline-single-file-html',
    apply: 'build',
    closeBundle(error?: Error) {
      if (error) return;
      const outDir = path.resolve(__dirname, outDirName);
      const htmlPath = path.join(outDir, 'index.html');
      if (!fs.existsSync(htmlPath)) return;

      let html = fs.readFileSync(htmlPath, 'utf8');

      // Inline local stylesheet <link rel="stylesheet" href="..."> tags
      html = html.replace(
        /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
        (fullTag, href: string) => {
          if (/^https?:\/\//i.test(href)) return fullTag;
          const cleanHref = href.replace(/^\.?\/+/, '');
          const cssPath = path.join(outDir, cleanHref);
          if (!fs.existsSync(cssPath)) return fullTag;
          const css = fs.readFileSync(cssPath, 'utf8');
          const safeCss = css.replace(/<\/style/gi, '<\\/style');
          return `<style>\n${safeCss}\n</style>`;
        },
      );

      // Remove any modulepreload links for local chunks
      html = html.replace(
        /<link\b[^>]*rel=["']modulepreload["'][^>]*href=["'](?!https?:\/\/)[^"']+["'][^>]*>\s*/gi,
        '',
      );

      // Extract & inline local <script ... src="..."> tags (supports both classic and module scripts)
      const inlinedScripts: string[] = [];
      html = html.replace(
        /<script\b[^>]*src=["']([^"']+)["'][^>]*><\/script>\s*/gi,
        (fullTag, src: string) => {
          if (/^https?:\/\//i.test(src)) return fullTag;
          const cleanSrc = src.replace(/^\.?\/+/, '');
          const jsPath = path.join(outDir, cleanSrc);
          if (!fs.existsSync(jsPath)) return fullTag;
          const js = fs.readFileSync(jsPath, 'utf8');
          const safeJs = js.replace(/<\/script/gi, '<\\/script');
          inlinedScripts.push(safeJs);
          return '';
        },
      );

      if (inlinedScripts.length > 0) {
        const runtimeScriptBlock =
          `<script>window.__SINGLE_FILE_OFFLINE__ = true;</script>\n` +
          inlinedScripts
            .map((code) => `<script>\n${code}\n</script>`)
            .join('\n');

        html = html.replace('</body>', () => `${runtimeScriptBlock}\n</body>`);
      }

      const finalHtmlPath = path.join(outDir, outputFileName);
      fs.writeFileSync(finalHtmlPath, html, 'utf8');
      fs.writeFileSync(htmlPath, html, 'utf8');

      // Remove standalone assets folder since CSS, JS, and images are now inlined
      const assetsDir = path.join(outDir, 'assets');
      if (fs.existsSync(assetsDir)) {
        fs.rmSync(assetsDir, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    inlineSingleFileHtmlPlugin('dist-single', 'SS30-2-Theme6-Study-Guide.html'),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        name: 'Theme6StudyGuide',
      },
    },
  },
});
