let mermaid;
export async function mountMermaid(host, source, onError) {
  mermaid ||= (await import('mermaid')).default;
  const { default: DOMPurify } = await import('dompurify');
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', fontFamily: 'Vazirmatn, sans-serif', suppressErrorRendering: true, flowchart: { htmlLabels: false } });
  try {
    await mermaid.parse(source);
    const { svg } = await mermaid.render(`diagram-${crypto.randomUUID().replaceAll('-', '')}`, source);
    if (/@import\b|url\(\s*['"]?(?:https?:|\/\/|data:)/i.test(svg)) throw new Error('External or embedded resources are not allowed in Mermaid output');
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    for (const foreign of parsed.querySelectorAll('foreignObject')) {
      const label = foreign.textContent.trim();
      const textNode = parsed.createElementNS('http://www.w3.org/2000/svg', 'text');
      textNode.setAttribute('x', String(Number(foreign.getAttribute('x') || 0) + Number(foreign.getAttribute('width') || 0) / 2));
      textNode.setAttribute('y', String(Number(foreign.getAttribute('y') || 0) + Number(foreign.getAttribute('height') || 0) / 2));
      textNode.setAttribute('text-anchor', 'middle');
      textNode.setAttribute('dominant-baseline', 'middle');
      textNode.setAttribute('direction', 'auto');
      textNode.textContent = label;
      foreign.replaceWith(textNode);
    }
    host.innerHTML = DOMPurify.sanitize(new XMLSerializer().serializeToString(parsed.documentElement), { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['image', 'a'], FORBID_ATTR: ['href', 'xlink:href'] });
    onError(null);
  } catch (error) {
    onError(error.message || String(error));
  }
}
