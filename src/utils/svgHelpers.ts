import { SvgFormat } from '../types';

export const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="space-grad" cx="20%" cy="20%" r="100%" fx="20%" fy="20%">
      <stop offset="0%" stop-color="#312e81" />
      <stop offset="50%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>
    <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="5" result="coloredBlur" />
      <feMerge>
        <feMergeNode in="coloredBlur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="star-dim" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.5" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#space-grad)" />
  <g fill="#ffffff" opacity="0.3" filter="url(#star-dim)">
    <circle cx="120" cy="100" r="2" />
    <circle cx="420" cy="80" r="3" />
    <circle cx="380" cy="400" r="2" />
    <circle cx="80" cy="420" r="2" />
    <circle cx="250" cy="60" r="1.5" />
    <circle cx="50" cy="250" r="2" />
    <circle cx="460" cy="280" r="1.5" />
  </g>
  <g transform="translate(256, 256)" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#ffffff" stroke-width="2" opacity="0.3" stroke-dasharray="6 4">
      <path d="M0 0 L0 -130" />
      <path d="M0 0 L112.6 65" />
      <path d="M0 0 L-112.6 65" />
    </g>
    <rect x="-10" y="-10" width="20" height="20" fill="#0e7490" opacity="0.6" filter="url(#node-glow)" />
    <g stroke="#ffffff" stroke-width="4" fill="none">
      <path d="M0 -130 L112.6 -65 L112.6 65 L0 130 L-112.6 65 L-112.6 -65 Z" />
      <path d="M0 0 L0 130" />
      <path d="M0 0 L112.6 -65" />
      <path d="M0 0 L-112.6 -65" />
    </g>
    <g fill="#06b6d4" stroke="none" filter="url(#node-glow)">
      <rect x="-12" y="-142" width="24" height="24" />
      <rect x="100.6" y="-77" width="24" height="24" />
      <rect x="-124.6" y="-77" width="24" height="24" />
      <rect x="-124.6" y="53" width="24" height="24" />
      <rect x="100.6" y="53" width="24" height="24" />
      <rect x="-12" y="118" width="24" height="24" />
    </g>
    <g filter="url(#node-glow)">
      <rect x="-16" y="-16" width="32" height="32" fill="#22d3ee" stroke="#ffffff" stroke-width="2" />
    </g>
  </g>
</svg>`;

export const parseSvgContent = (content: string): Document | null => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'image/svg+xml');
    const errorNode = doc.querySelector('parsererror');
    if (errorNode) return null;
    return doc;
  } catch (e) {
    return null;
  }
};

const camelCaseAttr = (attr: string) => {
  if (attr === 'class') return 'className';
  if (attr === 'for') return 'htmlFor';
  if (attr === 'xmlns:xlink') return 'xmlnsXlink';
  if (attr.startsWith('aria-') || attr.startsWith('data-')) return attr;
  
  return attr.replace(/[-:]([a-z])/g, (g) => g[1].toUpperCase());
};

const styleStringToObject = (styleStr: string): string => {
  if (!styleStr) return '';
  const styles = styleStr.split(';').reduce((acc: string[], style) => {
    const [prop, value] = style.split(':');
    if (prop && value) {
      const key = prop.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
      acc.push(`${key}: "${value.trim().replace(/"/g, "'")}"`);
    }
    return acc;
  }, []);
  if (styles.length === 0) return '';
  return `{{ ${styles.join(', ')} }}`;
};

export const generateReactComponent = (svgContent: string): string => {
  const doc = parseSvgContent(svgContent);
  if (!doc) return `// Invalid SVG content`;

  const processNode = (node: Element, indent: string): string => {
    const tagName = node.tagName;
    let props = '';
    
    Array.from(node.attributes).forEach(attr => {
      const name = camelCaseAttr(attr.name);
      const value = attr.value;
      
      if (attr.name === 'style') {
        const styleObj = styleStringToObject(value);
        if (styleObj) props += ` style=${styleObj}`;
      } else {
         props += ` ${name}="${value}"`;
      }
    });

    if (tagName === 'svg') {
      props += ' {...props}';
    }

    let children = '';
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === 1) { 
        const res = processNode(child as Element, indent + '  ');
        if (res) children += '\n' + res;
      } else if (child.nodeType === 3) { 
         const text = child.textContent?.trim();
         if (text) children += `\n${indent}  ${text}`;
      }
    });

    if (!children.trim()) return `${indent}<${tagName}${props} />`;
    return `${indent}<${tagName}${props}>${children}\n${indent}</${tagName}>`;
  };

  const svgRoot = doc.querySelector('svg');
  if (!svgRoot) return `// No SVG root found`;

  const jsxContent = processNode(svgRoot, '  ');

  return `import * as React from "react";
const SVGComponent = (props) => (
${jsxContent}
);
export default SVGComponent;`;
};

export const generateReactNativeComponent = (svgContent: string): string => {
  const doc = parseSvgContent(svgContent);
  if (!doc) return `// Invalid SVG content`;
  
  const usedComponents = new Set<string>();
  const supportedTags: Record<string, string> = {
    'svg': 'Svg', 'g': 'G', 'path': 'Path', 'circle': 'Circle', 'rect': 'Rect',
    'polygon': 'Polygon', 'polyline': 'Polyline', 'line': 'Line', 'text': 'Text',
    'tspan': 'TSpan', 'defs': 'Defs', 'use': 'Use', 'image': 'Image',
    'stop': 'Stop', 'linearGradient': 'LinearGradient', 'radialGradient': 'RadialGradient',
    'mask': 'Mask', 'pattern': 'Pattern', 'clipPath': 'ClipPath', 'ellipse': 'Ellipse',
    'symbol': 'Symbol', 'marker': 'Marker'
  };

  const processNode = (node: Element, indent: string): string => {
    const tagName = node.tagName.toLowerCase();
    
    if (tagName === 'metadata' || tagName === 'title' || tagName === 'desc' || tagName === 'style' || tagName === 'script') return '';
    
    const rnTag = supportedTags[tagName];
    if (!rnTag) return '';
    
    usedComponents.add(rnTag);
    
    let props = '';
    Array.from(node.attributes).forEach(attr => {
      let name = attr.name;
      const value = attr.value;
      
      if (name === 'class' || name.startsWith('data-') || name === 'style' || name.startsWith('aria-')) return;
      if (name === 'xmlns' || name.startsWith('xmlns:')) {
         if (tagName !== 'svg') return; 
      }

      name = camelCaseAttr(name);
      props += ` ${name}="${value}"`;
    });
    
    if (rnTag === 'Svg') {
        props += ' {...props}';
    }

    let children = '';
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === 1) { 
        const res = processNode(child as Element, indent + '  ');
        if (res) children += '\n' + res;
      } else if (child.nodeType === 3) { 
        const text = child.textContent?.trim();
        if (text && (rnTag === 'Text' || rnTag === 'TSpan')) {
           children += `\n${indent}  ${text}`;
        }
      }
    });
    
    if (!children.trim()) return `${indent}<${rnTag}${props} />`;
    
    return `${indent}<${rnTag}${props}>${children}\n${indent}</${rnTag}>`;
  };
  
  const svgRoot = doc.querySelector('svg');
  if (!svgRoot) return `// No SVG root found`;
  
  const componentBody = processNode(svgRoot, '  ');
  
  const imports = Array.from(usedComponents).filter(c => c !== 'Svg').sort().join(', ');
  const importStmt = imports ? `import Svg, { ${imports} } from "react-native-svg";` : `import Svg from "react-native-svg";`;

  return `import * as React from "react";
${importStmt}
/* SVGR has dropped some elements not supported by react-native-svg: metadata */
const SVGComponent = (props) => (
${componentBody}
);
export default SVGComponent;`;
};

export const convertToFormat = (svgContent: string, format: SvgFormat): string => {
  if (format === 'svg') return svgContent;
  if (format === 'jsx' || format === 'tsx') return generateReactComponent(svgContent);
  return svgContent;
};

export const updateSvgElement = (
  svgContent: string, 
  elementId: string, 
  attributes: Record<string, string>
): string => {
  const doc = parseSvgContent(svgContent);
  if (!doc) return svgContent;

  const el = doc.getElementById(elementId);
  if (el) {
    Object.entries(attributes).forEach(([key, value]) => {
      el.setAttribute(key, value);
      const style = el.getAttribute('style');
      if (style) {
        const cssProp = key.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
        const styleRules = style.split(';').map(s => s.trim()).filter(Boolean);
        const newRules = styleRules.filter(rule => !rule.startsWith(`${cssProp}:`));
        if (newRules.length !== styleRules.length) {
          if (newRules.length > 0) el.setAttribute('style', newRules.join('; '));
          else el.removeAttribute('style');
        }
      }
    });
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }

  return svgContent;
};

export const getNextId = (doc: Document, tagName: string): string => {
  let counter = 1;
  let id = `${tagName}-${counter}`;
  while (doc.getElementById(id)) {
    counter++;
    id = `${tagName}-${counter}`;
  }
  return id;
};

export const injectIdToSvg = (
  svgContent: string, 
  tagName: string, 
  index: number
): { newContent: string; newId: string } | null => {
  const doc = parseSvgContent(svgContent);
  if (!doc) return null;

  const elements = doc.querySelectorAll(tagName);
  const el = elements[index];
  
  if (el) {
    let newId = el.getAttribute('id');
    if (!newId) {
       newId = getNextId(doc, tagName);
       el.setAttribute('id', newId);
    }
    const serializer = new XMLSerializer();
    return {
      newContent: serializer.serializeToString(doc),
      newId
    };
  }
  return null;
};

export const addIdsToElements = (svgContent: string): { content: string; count: number } => {
  const doc = parseSvgContent(svgContent);
  if (!doc) return { content: svgContent, count: 0 };

  const elements = doc.querySelectorAll('rect, circle, ellipse, line, polyline, polygon, path, text, g, image');
  let count = 0;
  const counters: Record<string, number> = {};

  elements.forEach((el) => {
    if (!el.getAttribute('id')) {
      const tagName = el.tagName.toLowerCase();
      if (!counters[tagName]) counters[tagName] = 1;
      let id = `${tagName}-${counters[tagName]}`;
      while (doc.getElementById(id)) {
        counters[tagName]++;
        id = `${tagName}-${counters[tagName]}`;
      }
      el.setAttribute('id', id);
      counters[tagName]++;
      count++;
    }
  });

  if (count > 0) {
    const serializer = new XMLSerializer();
    return { content: serializer.serializeToString(doc), count };
  }
  return { content: svgContent, count: 0 };
};

export const downloadBlob = (content: Blob | string, filename: string, mimeType: string) => {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const isPointInPolygon = (point: {x: number, y: number}, vs: {x: number, y: number}[]) => {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        
        let intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

export const decomposePath = (d: string): string[] => {
  const tokenizer = /([a-zA-Z])|([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/g;
  const tokens = d.match(tokenizer);
  if (!tokens) return [d];

  interface SubPath {
    tokens: string[];
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
    polygon: {x: number, y: number}[];
    startPoint: {x: number, y: number};
  }
  
  const subPaths: SubPath[] = [];
  let currentTokens: string[] = [];
  let currentBBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  let currentPolygon: {x: number, y: number}[] = [];
  
  let cursorX = 0, cursorY = 0;
  let startX = 0, startY = 0;
  let currentCommand = '';
  
  const paramCounts: Record<string, number> = {
    M: 2, m: 2, L: 2, l: 2, H: 1, h: 1, V: 1, v: 1,
    C: 6, c: 6, S: 4, s: 4, Q: 4, q: 4, T: 2, t: 2,
    A: 7, a: 7, Z: 0, z: 0
  };

  const updateBBox = (x: number, y: number) => {
    if (x < currentBBox.minX) currentBBox.minX = x;
    if (x > currentBBox.maxX) currentBBox.maxX = x;
    if (y < currentBBox.minY) currentBBox.minY = y;
    if (y > currentBBox.maxY) currentBBox.maxY = y;
  };

  const addPointToPolygon = (x: number, y: number) => {
    currentPolygon.push({ x, y });
  };

  const finalizeSubPath = () => {
    if (currentTokens.length > 0) {
      if (currentBBox.minX === Infinity) {
          currentBBox = { minX: cursorX, minY: cursorY, maxX: cursorX, maxY: cursorY };
      }
      const mX = parseFloat(currentTokens[1]);
      const mY = parseFloat(currentTokens[2]);

      subPaths.push({ 
        tokens: currentTokens, 
        bbox: currentBBox,
        polygon: currentPolygon,
        startPoint: { x: isNaN(mX) ? 0 : mX, y: isNaN(mY) ? 0 : mY }
      });
    }
    currentTokens = [];
    currentPolygon = [];
    currentBBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  };

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    
    if (/[a-zA-Z]/.test(token)) {
      const cmd = token;
      
      if ((cmd === 'M' || cmd === 'm') && currentTokens.length > 0) {
        finalizeSubPath();
      }

      if (cmd === 'm' && currentTokens.length === 0) {
        if (i + 2 < tokens.length) {
           const dx = parseFloat(tokens[i+1]);
           const dy = parseFloat(tokens[i+2]);
           const absX = cursorX + dx;
           const absY = cursorY + dy;
           
           currentTokens.push('M', absX.toString(), absY.toString());
           
           cursorX = absX; cursorY = absY;
           startX = cursorX; startY = cursorY;
           updateBBox(cursorX, cursorY);
           addPointToPolygon(cursorX, cursorY);
           
           currentCommand = 'm_converted'; 
           i += 3;
           continue; 
        }
      }

      currentCommand = cmd;
      currentTokens.push(cmd);
      i++;

      if (cmd.toLowerCase() === 'z') {
        cursorX = startX;
        cursorY = startY;
      }
    } else {
      if (currentCommand === 'm_converted') {
          currentTokens.push('l');
          currentCommand = 'l';
      }

      let effectiveCommand = currentCommand;
      if (currentCommand === 'M') effectiveCommand = 'L';
      else if (currentCommand === 'm') effectiveCommand = 'l';
      
      if (currentCommand.toLowerCase() === 'z') {
         i++; 
         continue; 
      }

      const paramsNeeded = paramCounts[effectiveCommand] || 0;
      const params: number[] = [];
      
      for (let k = 0; k < paramsNeeded; k++) {
         const rawVal = tokens[i+k];
         const val = parseFloat(rawVal || '0');
         params.push(val);
         currentTokens.push(rawVal || '0');
      }
      i += paramsNeeded;
      
      const isRel = effectiveCommand === effectiveCommand.toLowerCase();
      const getX = (val: number) => isRel ? cursorX + val : val;
      const getY = (val: number) => isRel ? cursorY + val : val;

      let nextX = cursorX;
      let nextY = cursorY;
      const upperCmd = effectiveCommand.toUpperCase();

      switch(upperCmd) {
         case 'M':
            nextX = getX(params[0]);
            nextY = getY(params[1]);
            startX = nextX; startY = nextY;
            updateBBox(nextX, nextY);
            addPointToPolygon(nextX, nextY);
            break;
         case 'L':
            nextX = getX(params[0]);
            nextY = getY(params[1]);
            updateBBox(nextX, nextY);
            addPointToPolygon(nextX, nextY);
            break;
         case 'H':
            nextX = getX(params[0]);
            updateBBox(nextX, cursorY);
            addPointToPolygon(nextX, cursorY);
            break;
         case 'V':
            nextY = getY(params[0]);
            updateBBox(cursorX, nextY);
            addPointToPolygon(cursorX, nextY);
            break;
         case 'C':
            updateBBox(getX(params[0]), getY(params[1])); 
            updateBBox(getX(params[2]), getY(params[3])); 
            nextX = getX(params[4]);
            nextY = getY(params[5]);
            updateBBox(nextX, nextY);
            addPointToPolygon(nextX, nextY);
            break;
         case 'S':
            updateBBox(getX(params[0]), getY(params[1])); 
            nextX = getX(params[2]);
            nextY = getY(params[3]);
            updateBBox(nextX, nextY);
            addPointToPolygon(nextX, nextY);
            break;
         case 'Q':
            updateBBox(getX(params[0]), getY(params[1])); 
            nextX = getX(params[2]);
            nextY = getY(params[3]);
            updateBBox(nextX, nextY);
            addPointToPolygon(nextX, nextY);
            break;
         case 'T':
            nextX = getX(params[0]);
            nextY = getY(params[1]);
            updateBBox(nextX, nextY);
            addPointToPolygon(nextX, nextY);
            break;
         case 'A':
            nextX = getX(params[5]);
            nextY = getY(params[6]);
            updateBBox(nextX, nextY);
            addPointToPolygon(nextX, nextY);
            break;
      }
      
      cursorX = nextX;
      cursorY = nextY;
    }
  }

  finalizeSubPath();
  
  subPaths.sort((a, b) => {
     const areaA = (a.bbox.maxX - a.bbox.minX) * (a.bbox.maxY - a.bbox.minY);
     const areaB = (b.bbox.maxX - b.bbox.minX) * (b.bbox.maxY - b.bbox.minY);
     return areaB - areaA;
  });

  interface Cluster {
    subPaths: SubPath[];
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
    polygon: {x: number, y: number}[];
  }
  
  const clusters: Cluster[] = [];
  
  const boxContains = (container: any, item: any) => {
    return (
      container.minX <= item.minX &&
      container.maxX >= item.maxX &&
      container.minY <= item.minY &&
      container.maxY >= item.maxY
    );
  };
  
  for (const sp of subPaths) {
    let assigned = false;
    for (const cluster of clusters) {
       if (boxContains(cluster.bbox, sp.bbox)) {
          if (isPointInPolygon(sp.startPoint, cluster.polygon)) {
             cluster.subPaths.push(sp);
             assigned = true;
             break;
          }
       }
    }
    
    if (!assigned) {
       clusters.push({ subPaths: [sp], bbox: sp.bbox, polygon: sp.polygon });
    }
  }

  return clusters.map(c => c.subPaths.map(sp => sp.tokens.join(' ')).join(' '));
};

export const smartAnalyzeSvg = (svgContent: string): { content: string, count: number } => {
  const doc = parseSvgContent(svgContent);
  if (!doc) return { content: svgContent, count: 0 };
  
  let changeCount = 0;
  const counters: Record<string, number> = {};

  const getNextLocalId = (tagName: string) => {
    if (!counters[tagName]) counters[tagName] = 1;
    let id = `${tagName}-${counters[tagName]}`;
    while (doc.getElementById(id)) {
      counters[tagName]++;
      id = `${tagName}-${counters[tagName]}`;
    }
    return id;
  };

  const paths = Array.from(doc.querySelectorAll('path'));
  paths.forEach(path => {
     const d = path.getAttribute('d');
     if (d) {
        const parts = decomposePath(d);
        if (parts.length > 1) {
           parts.forEach(partD => {
              const newPath = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
              Array.from(path.attributes).forEach(attr => {
                 if (attr.name !== 'd' && attr.name !== 'id') {
                    newPath.setAttribute(attr.name, attr.value);
                 }
              });
              newPath.setAttribute('d', partD);
              
              const newId = getNextLocalId('path');
              newPath.setAttribute('id', newId);
              counters['path']++;

              path.parentNode?.insertBefore(newPath, path);
           });
           path.parentNode?.removeChild(path);
           changeCount++;
        }
     }
  });

  const elements = doc.querySelectorAll('rect, circle, ellipse, line, polyline, polygon, path, text, g, image');
  elements.forEach((el) => {
    if (!el.getAttribute('id')) {
      const tagName = el.tagName.toLowerCase();
      const newId = getNextLocalId(tagName);
      el.setAttribute('id', newId);
      counters[tagName]++;
      changeCount++;
    }
  });

  const serializer = new XMLSerializer();
  return {
     content: serializer.serializeToString(doc),
     count: changeCount
  };
};

export const hexToHsv = (hex: string) => {
  let r = 0, g = 0, b = 0;
  hex = hex.replace('#', '');
  
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
};

export const hsvToHex = (h: number, s: number, v: number): string => {
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s / 100);
  const q = v * (1 - f * s / 100);
  const t = v * (1 - (1 - f) * s / 100);
  
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  
  const toHex = (x: number) => {
    const hex = Math.round(x * 2.55).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const hsvToRgb = (h: number, s: number, v: number) => {
    const hex = hsvToHex(h, s, v);
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return { r, g, b };
}

export const rgbToHex = (color: string): string => {
  if (!color || color === 'none' || color === 'transparent') return '#ffffff';
  if (color.trim().match(/^url\(/i) || color.trim().startsWith('var(')) return '#000000';
  
  if (color.startsWith('#')) {
    if (color.length === 4) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }
    return color;
  }
  
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#ffffff';
  ctx.fillStyle = color;
  return ctx.fillStyle;
};

export const isColorRed = (color: string): boolean => {
  const hex = rgbToHex(color);
  const { h, s, v } = hexToHsv(hex);
  const isRedHue = (h >= 0 && h <= 25) || (h >= 335 && h <= 360);
  const isSaturated = s > 20;
  const hasValue = v > 20;
  return isRedHue && isSaturated && hasValue;
};

export interface GradientStop {
  offset: string;
  color: string;
  opacity?: string;
}

export interface GradientData {
  id: string;
  type: 'linear' | 'radial';
  coords: Record<string, string>;
  stops: GradientStop[];
  units?: string;
}

export const getGradientData = (svgContent: string, id: string): GradientData | null => {
  const doc = parseSvgContent(svgContent);
  if (!doc) return null;
  
  const el = doc.getElementById(id);
  if (!el) return null;

  const type = el.tagName === 'linearGradient' ? 'linear' : el.tagName === 'radialGradient' ? 'radial' : null;
  if (!type) return null;

  const coords: Record<string, string> = {};
  const attrs = type === 'linear' 
    ? ['x1', 'y1', 'x2', 'y2'] 
    : ['cx', 'cy', 'r', 'fx', 'fy'];
  
  attrs.forEach(attr => {
    const val = el.getAttribute(attr);
    if (val) coords[attr] = val;
  });

  let stopElements = Array.from(el.querySelectorAll('stop'));
  if (stopElements.length === 0) {
    const href = el.getAttribute('href') || el.getAttribute('xlink:href');
    if (href && href.startsWith('#')) {
      const linkedEl = doc.getElementById(href.substring(1));
      if (linkedEl) {
        stopElements = Array.from(linkedEl.querySelectorAll('stop'));
      }
    }
  }

  const stops: GradientStop[] = stopElements.map(stop => ({
    offset: stop.getAttribute('offset') || '0%',
    color: stop.getAttribute('stop-color') || '#000000',
    opacity: stop.getAttribute('stop-opacity') || undefined
  }));

  return {
    id,
    type,
    coords,
    stops,
    units: el.getAttribute('gradientUnits') || 'objectBoundingBox'
  };
};

export const upsertGradient = (svgContent: string, data: GradientData): string => {
  const doc = parseSvgContent(svgContent);
  if (!doc) return svgContent;

  let defs = doc.querySelector('defs');
  if (!defs) {
    defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs');
    doc.querySelector('svg')?.prepend(defs);
  }

  let el: Element | null = doc.getElementById(data.id);
  if (el && ((data.type === 'linear' && el.tagName !== 'linearGradient') || (data.type === 'radial' && el.tagName !== 'radialGradient'))) {
    el.parentNode?.removeChild(el);
    el = null;
  }

  if (!el) {
    el = doc.createElementNS('http://www.w3.org/2000/svg', data.type === 'linear' ? 'linearGradient' : 'radialGradient');
    el.setAttribute('id', data.id);
    defs?.appendChild(el);
  }

  ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy'].forEach(a => el!.removeAttribute(a));
  Object.entries(data.coords).forEach(([key, val]) => {
    if (val) el!.setAttribute(key, val);
  });

  if (data.units) el.setAttribute('gradientUnits', data.units);

  el.innerHTML = '';
  data.stops.forEach(stop => {
    const s = doc.createElementNS('http://www.w3.org/2000/svg', 'stop');
    s.setAttribute('offset', stop.offset);
    s.setAttribute('stop-color', stop.color);
    if (stop.opacity) s.setAttribute('stop-opacity', stop.opacity);
    el!.appendChild(s);
  });

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
};

export const generateUniqueId = (svgContent: string, prefix: string = 'grad'): string => {
  let id = `${prefix}-${Math.floor(Math.random() * 10000)}`;
  while (svgContent.includes(`id="${id}"`)) {
    id = `${prefix}-${Math.floor(Math.random() * 10000)}`;
  }
  return id;
};