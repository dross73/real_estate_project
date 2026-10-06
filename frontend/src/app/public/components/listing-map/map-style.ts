import type { StyleSpecification, StyleSwapOptions } from 'maplibre-gl';
import type { PublicTheme } from '../../../services/public-theme.service';

/** Keep OpenFreeMap data/attribution intact while improving dark label contrast. */
export function navyMapStyle(style: StyleSpecification): StyleSpecification {
  return { ...style, layers: style.layers.map(layer => {
    if (layer.type === 'background') return { ...layer, paint: { ...layer.paint, 'background-color': '#0d1020' } };
    if (layer.type === 'symbol' && layer.layout?.['text-field']) {
      return { ...layer, paint: { ...layer.paint, 'text-color': '#bdc1d9', 'text-halo-color': '#0d1020', 'text-halo-width': 1.5 } };
    }
    if (layer.type === 'fill') {
      const color = layer.id.includes('water') ? '#192c49' : /park|wood|grass/.test(layer.id) ? '#19332f' : layer.id.includes('building') ? '#2b3350' : '#181d32';
      return { ...layer, paint: { ...layer.paint, 'fill-color': color } };
    }
    if (layer.type === 'line') {
      const color = layer.id.includes('water') ? '#315379' : /casing|outline/.test(layer.id) ? '#30394f' : '#737e9e';
      return { ...layer, paint: { ...layer.paint, 'line-color': color } };
    }
    return layer;
  }) };
}

export function mapStyleOptions(theme: PublicTheme): StyleSwapOptions {
  return { transformStyle: (_previous, next) => theme === 'dark' ? navyMapStyle(next) : next };
}
