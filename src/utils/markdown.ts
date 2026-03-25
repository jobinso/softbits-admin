/**
 * Markdown to HTML Converter (ESM wrapper)
 *
 * Re-exports markdownToHtml from softbits-shared for browser compatibility.
 * The shared version uses CJS (module.exports) which Vite/Rollup cannot
 * transform when resolved via alias, so we re-implement here.
 *
 * Keep in sync with: softbits-shared/utils/markdown.js
 */

export function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Escape HTML entities first (except for our markdown syntax)
  html = html.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;');

  // Code blocks (must be done before inline code)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (_match, content) => {
    const cells = content.split('|').map((cell: string) => cell.trim());
    return `<tr>${cells.map((cell: string) => `<td>${cell}</td>`).join('')}</tr>`;
  });

  // Wrap table rows in table tags
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)\n(<tr>[\s\S]*?<\/tr>)/g, (_match, header, body) => {
    if (header.includes('---')) {
      return body;
    }
    return `${header}\n${body}`;
  });

  const tableRegex = /(<tr>.*<\/tr>\n?)+/g;
  html = html.replace(tableRegex, (tableRows) => {
    const rows = tableRows.trim().split('\n');
    if (rows.length >= 2) {
      const filteredRows = rows.filter((row: string) => !row.includes('---'));
      if (filteredRows.length > 0) {
        const headerRow = filteredRows[0].replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
        const bodyRows = filteredRows.slice(1).join('\n');
        return `<table>${headerRow}${bodyRows}</table>`;
      }
    }
    return `<table>${tableRows}</table>`;
  });

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs (lines that aren't already wrapped)
  html = html.replace(/^(?!<[houltpre]|$)(.+)$/gm, '<p>$1</p>');

  // Clean up empty paragraphs and extra whitespace
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/\n{3,}/g, '\n\n');

  return html;
}
